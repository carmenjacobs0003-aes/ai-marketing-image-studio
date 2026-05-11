create type public.gallery_item_kind as enum ('image', 'marketing');
create type public.gallery_visibility as enum ('public', 'private');
create type public.gallery_report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.gallery_items (
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
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_items_one_source check (
    (kind = 'image' and source_image_generation_id is not null and source_marketing_generation_id is null) or
    (kind = 'marketing' and source_marketing_generation_id is not null and source_image_generation_id is null)
  )
);

create table public.gallery_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gallery_item_id)
);

create table public.gallery_reports (
  id uuid primary key default gen_random_uuid(),
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 80),
  details text,
  status public.gallery_report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gallery_items_public_discovery_idx on public.gallery_items(visibility, published_at desc) where visibility = 'public';
create index gallery_items_trending_idx on public.gallery_items(visibility, like_count desc, view_count desc, published_at desc) where visibility = 'public';
create index gallery_items_featured_idx on public.gallery_items(visibility, featured, published_at desc) where visibility = 'public';
create index gallery_items_creator_idx on public.gallery_items(creator_id, created_at desc);
create index gallery_items_tags_idx on public.gallery_items using gin(tags);
create index gallery_reports_item_idx on public.gallery_reports(gallery_item_id, created_at desc);

create trigger gallery_items_set_updated_at before update on public.gallery_items for each row execute function public.set_updated_at();
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

alter table public.gallery_items enable row level security;
alter table public.gallery_favorites enable row level security;
alter table public.gallery_reports enable row level security;

create policy "Public gallery items are readable" on public.gallery_items for select using (visibility = 'public' or auth.uid() = creator_id);
create policy "Gallery items are insertable by owner" on public.gallery_items for insert with check (auth.uid() = creator_id);
create policy "Gallery items are updatable by owner" on public.gallery_items for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "Gallery items are deletable by owner" on public.gallery_items for delete using (auth.uid() = creator_id);

create policy "Favorites are readable by owner" on public.gallery_favorites for select using (auth.uid() = user_id);
create policy "Favorites are insertable by owner" on public.gallery_favorites for insert with check (auth.uid() = user_id);
create policy "Favorites are deletable by owner" on public.gallery_favorites for delete using (auth.uid() = user_id);

create policy "Reports are insertable by authenticated users" on public.gallery_reports for insert with check (auth.uid() = reporter_id);
create policy "Reports are readable by reporter" on public.gallery_reports for select using (auth.uid() = reporter_id);

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

create trigger gallery_reports_increment_count after insert on public.gallery_reports for each row execute function public.increment_gallery_report_count();
create policy "Public gallery creators are readable" on public.profiles for select using (exists (select 1 from public.gallery_items where gallery_items.creator_id = profiles.id and gallery_items.visibility = 'public'));
