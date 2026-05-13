-- Safely repair production gallery schema drift.
--
-- The repository already includes the original gallery migration
-- (20260511000000_community_gallery_marketplace.sql), but production can drift
-- when that migration was not applied or when PostgREST still has an old schema
-- cache. This migration is intentionally idempotent: it creates missing gallery
-- objects without dropping tables or truncating data, reapplies RLS/policies,
-- restores indexes/triggers/functions, and asks PostgREST to reload its schema.

create extension if not exists "pgcrypto";

-- Shared helper used by gallery triggers. Keep this here so the repair can run
-- even if the original initial schema helper was not present in a drifted DB.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Ensure enum types exist before any repaired tables/columns reference them.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'gallery_item_kind' and typnamespace = 'public'::regnamespace) then
    create type public.gallery_item_kind as enum ('image', 'marketing');
  end if;

  if not exists (select 1 from pg_type where typname = 'gallery_visibility' and typnamespace = 'public'::regnamespace) then
    create type public.gallery_visibility as enum ('public', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'gallery_report_status' and typnamespace = 'public'::regnamespace) then
    create type public.gallery_report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
  end if;

  if not exists (select 1 from pg_type where typname = 'moderation_status' and typnamespace = 'public'::regnamespace) then
    create type public.moderation_status as enum ('clean', 'flagged', 'removed');
  end if;
end $$;

-- Create gallery tables only when absent. CREATE TABLE IF NOT EXISTS preserves
-- any existing production data and avoids replacing partially populated tables.
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  source_image_generation_id uuid references public.image_generations(id) on delete set null,
  source_marketing_generation_id uuid references public.marketing_generations(id) on delete set null,
  kind public.gallery_item_kind not null,
  visibility public.gallery_visibility not null default 'private',
  title text not null check (char_length(title) between 3 and 140),
  description text,
  prompt text not null check (char_length(prompt) between 10 and 4000),
  reusable_prompt text not null check (char_length(reusable_prompt) between 10 and 4000),
  category text not null default 'Campaign',
  tags text[] not null default '{}',
  image_storage_path text,
  image_signed_url text,
  marketing_output jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  featured boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  like_count integer not null default 0 check (like_count >= 0),
  copy_count integer not null default 0 check (copy_count >= 0),
  remix_count integer not null default 0 check (remix_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  moderation_status public.moderation_status not null default 'clean',
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_items_one_source check (
    (kind = 'image' and source_image_generation_id is not null and source_marketing_generation_id is null) or
    (kind = 'marketing' and source_marketing_generation_id is not null and source_image_generation_id is null)
  )
);

create table if not exists public.gallery_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gallery_item_id)
);

create table if not exists public.gallery_reports (
  id uuid primary key default gen_random_uuid(),
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 80),
  details text,
  status public.gallery_report_status not null default 'open',
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill columns used by later gallery/admin code if a drifted table exists
-- with an older shape. These ALTERs do not delete or overwrite existing rows.
alter table public.gallery_items
  add column if not exists moderation_status public.moderation_status not null default 'clean',
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null;

alter table public.gallery_reports
  add column if not exists handled_by uuid references auth.users(id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists resolution_note text;

-- Indexes required by gallery discovery, owner lists, moderation, and reports.
create index if not exists gallery_items_public_discovery_idx on public.gallery_items(visibility, published_at desc) where visibility = 'public';
create index if not exists gallery_items_trending_idx on public.gallery_items(visibility, like_count desc, view_count desc, published_at desc) where visibility = 'public';
create index if not exists gallery_items_featured_idx on public.gallery_items(visibility, featured, published_at desc) where visibility = 'public';
create index if not exists gallery_items_creator_idx on public.gallery_items(creator_id, created_at desc);
create index if not exists gallery_items_tags_idx on public.gallery_items using gin(tags);
create index if not exists gallery_items_moderation_status_idx on public.gallery_items(moderation_status, report_count desc, created_at desc);
create index if not exists gallery_reports_item_idx on public.gallery_reports(gallery_item_id, created_at desc);
create index if not exists gallery_reports_status_idx on public.gallery_reports(status, created_at desc);

-- Triggers/functions can be safely replaced so existing DBs converge on the
-- expected behavior without touching table contents.
drop trigger if exists gallery_items_set_updated_at on public.gallery_items;
create trigger gallery_items_set_updated_at before update on public.gallery_items for each row execute function public.set_updated_at();

drop trigger if exists gallery_reports_set_updated_at on public.gallery_reports;
create trigger gallery_reports_set_updated_at before update on public.gallery_reports for each row execute function public.set_updated_at();

create or replace function public.increment_gallery_metric(p_gallery_item_id uuid, p_metric text, p_quantity integer default 1)
returns public.gallery_items
language plpgsql
security definer
set search_path = public
as $$
declare item public.gallery_items;
begin
  if p_quantity < 0 then
    raise exception 'Quantity must be positive';
  end if;

  if p_metric = 'view' then
    update public.gallery_items set view_count = view_count + p_quantity where id = p_gallery_item_id and visibility = 'public' returning * into item;
  elsif p_metric = 'copy' then
    update public.gallery_items set copy_count = copy_count + p_quantity where id = p_gallery_item_id and visibility = 'public' returning * into item;
  elsif p_metric = 'remix' then
    update public.gallery_items set remix_count = remix_count + p_quantity where id = p_gallery_item_id and visibility = 'public' returning * into item;
  else
    raise exception 'Unsupported gallery metric: %', p_metric;
  end if;

  return item;
end;
$$;

create or replace function public.increment_gallery_like(p_gallery_item_id uuid, p_quantity integer)
returns public.gallery_items
language plpgsql
security definer
set search_path = public
as $$
declare item public.gallery_items;
begin
  update public.gallery_items
  set like_count = greatest(0, like_count + p_quantity)
  where id = p_gallery_item_id and visibility = 'public'
  returning * into item;
  return item;
end;
$$;

create or replace function public.increment_gallery_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gallery_items set report_count = report_count + 1 where id = new.gallery_item_id;
  return new;
end;
$$;

drop trigger if exists gallery_reports_increment_count on public.gallery_reports;
create trigger gallery_reports_increment_count after insert on public.gallery_reports for each row execute function public.increment_gallery_report_count();

create or replace function public.mark_gallery_report_handled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status is distinct from new.status then
    new.handled_at = coalesce(new.handled_at, now());
    new.handled_by = coalesce(new.handled_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_reports_mark_handled on public.gallery_reports;
create trigger gallery_reports_mark_handled before update on public.gallery_reports for each row execute function public.mark_gallery_report_handled();

alter table public.gallery_items enable row level security;
alter table public.gallery_favorites enable row level security;
alter table public.gallery_reports enable row level security;

-- Recreate required policies to avoid duplicates and to restore the intended
-- RLS behavior if production has drifted.
drop policy if exists "Public gallery items are readable" on public.gallery_items;
create policy "Public gallery items are readable" on public.gallery_items for select using (visibility = 'public' or auth.uid() = creator_id);

drop policy if exists "Gallery items are insertable by owner" on public.gallery_items;
create policy "Gallery items are insertable by owner" on public.gallery_items for insert with check (auth.uid() = creator_id);

drop policy if exists "Gallery items are updatable by owner" on public.gallery_items;
create policy "Gallery items are updatable by owner" on public.gallery_items for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "Gallery items are deletable by owner" on public.gallery_items;
create policy "Gallery items are deletable by owner" on public.gallery_items for delete using (auth.uid() = creator_id);

drop policy if exists "Favorites are readable by owner" on public.gallery_favorites;
create policy "Favorites are readable by owner" on public.gallery_favorites for select using (auth.uid() = user_id);

drop policy if exists "Favorites are insertable by owner" on public.gallery_favorites;
create policy "Favorites are insertable by owner" on public.gallery_favorites for insert with check (auth.uid() = user_id);

drop policy if exists "Favorites are deletable by owner" on public.gallery_favorites;
create policy "Favorites are deletable by owner" on public.gallery_favorites for delete using (auth.uid() = user_id);

drop policy if exists "Reports are insertable by authenticated users" on public.gallery_reports;
create policy "Reports are insertable by authenticated users" on public.gallery_reports for insert with check (auth.uid() = reporter_id);

drop policy if exists "Reports are readable by reporter" on public.gallery_reports;
create policy "Reports are readable by reporter" on public.gallery_reports for select using (auth.uid() = reporter_id);

-- Restore admin/moderation policies only when the admin helper exists or can be
-- created from the current profiles shape.
do $$
begin
  if to_regclass('public.profiles') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'admin_role') then
    execute $fn$
      create or replace function public.is_platform_admin()
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $body$
        select exists (
          select 1 from public.profiles
          where id = auth.uid()
            and admin_role in ('admin', 'moderator')
        );
      $body$;
    $fn$;

    execute 'drop policy if exists "Admins can read all gallery reports" on public.gallery_reports';
    execute 'create policy "Admins can read all gallery reports" on public.gallery_reports for select using (public.is_platform_admin())';

    execute 'drop policy if exists "Admins can update gallery reports" on public.gallery_reports';
    execute 'create policy "Admins can update gallery reports" on public.gallery_reports for update using (public.is_platform_admin()) with check (public.is_platform_admin())';

    execute 'drop policy if exists "Admins can moderate gallery items" on public.gallery_items';
    execute 'create policy "Admins can moderate gallery items" on public.gallery_items for update using (public.is_platform_admin()) with check (public.is_platform_admin())';
  end if;
end $$;

-- Allow creator profile cards for public gallery items when profiles exists.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "Public gallery creators are readable" on public.profiles';
    execute 'create policy "Public gallery creators are readable" on public.profiles for select using (exists (select 1 from public.gallery_items where gallery_items.creator_id = profiles.id and gallery_items.visibility = ''public''))';
  end if;
end $$;

-- Force PostgREST to discover repaired tables/functions immediately.
notify pgrst, 'reload schema';
