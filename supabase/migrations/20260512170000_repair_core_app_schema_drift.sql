-- Repair production drift for core application tables.
--
-- Some production databases were created from an earlier schema shape where:
--   - brand_kits only had jsonb colors/fonts and no voice/tone/default fields
--   - projects used title instead of name and had no brand_kit_id/status
--   - marketing_generations only stored prompt/image_url
--   - image_generations lacked signed_url/brand_kit_id compatibility columns
--   - profiles and paypal webhook events predated billing/admin additions
--
-- Keep this migration idempotent so it can safely run against both fresh local
-- databases and drifted production databases without dropping user data.

create extension if not exists "pgcrypto";

-- Ensure shared enum types exist before columns reference them.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_plan' and typnamespace = 'public'::regnamespace) then
    create type public.app_plan as enum ('free', 'pro', 'agency');
  end if;

  if not exists (select 1 from pg_type where typname = 'generation_status' and typnamespace = 'public'::regnamespace) then
    create type public.generation_status as enum ('queued', 'processing', 'completed', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_role' and typnamespace = 'public'::regnamespace) then
    create type public.admin_role as enum ('user', 'moderator', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'moderation_status' and typnamespace = 'public'::regnamespace) then
    create type public.moderation_status as enum ('clean', 'flagged', 'removed');
  end if;
end $$;

-- Profiles: add billing, admin, moderation, and activity columns used by the app.
alter table public.profiles
  add column if not exists plan public.app_plan default 'free',
  add column if not exists paypal_customer_id text,
  add column if not exists paypal_subscription_id text,
  add column if not exists paypal_plan_id text,
  add column if not exists subscription_status text default 'free',
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at timestamptz,
  add column if not exists admin_role public.admin_role default 'user',
  add column if not exists creator_verified boolean default false,
  add column if not exists moderation_status public.moderation_status default 'clean',
  add column if not exists last_active_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.profiles
set
  plan = coalesce(plan, 'free'),
  subscription_status = coalesce(subscription_status, 'free'),
  admin_role = coalesce(admin_role, 'user'),
  creator_verified = coalesce(creator_verified, false),
  moderation_status = coalesce(moderation_status, 'clean'),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.profiles
  alter column plan set default 'free',
  alter column subscription_status set default 'free',
  alter column admin_role set default 'user',
  alter column creator_verified set default false,
  alter column moderation_status set default 'clean',
  alter column updated_at set default now();

create or replace function pg_temp.jsonb_text_array(input jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(value), '{}'::text[])
  from jsonb_array_elements_text(coalesce(input, '[]'::jsonb)) as value;
$$;

-- Brand kits: add current app fields and normalize colors/fonts from jsonb drift
-- to text[] arrays expected by current write/read paths.
alter table public.brand_kits
  add column if not exists voice text,
  add column if not exists tone text,
  add column if not exists products jsonb default '[]'::jsonb,
  add column if not exists guidelines text,
  add column if not exists is_default boolean default false,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brand_kits'
      and column_name = 'colors'
      and data_type = 'jsonb'
  ) then
    alter table public.brand_kits
      alter column colors drop default,
      alter column colors type text[] using pg_temp.jsonb_text_array(colors),
      alter column colors set default '{}'::text[];
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brand_kits'
      and column_name = 'fonts'
      and data_type = 'jsonb'
  ) then
    alter table public.brand_kits
      alter column fonts drop default,
      alter column fonts type text[] using pg_temp.jsonb_text_array(fonts),
      alter column fonts set default '{}'::text[];
  end if;
end $$;

alter table public.brand_kits
  alter column colors set default '{}'::text[],
  alter column fonts set default '{}'::text[],
  alter column products set default '[]'::jsonb,
  alter column is_default set default false,
  alter column updated_at set default now();

update public.brand_kits
set
  colors = coalesce(colors, '{}'::text[]),
  fonts = coalesce(fonts, '{}'::text[]),
  products = coalesce(products, '[]'::jsonb),
  is_default = coalesce(is_default, false),
  updated_at = coalesce(updated_at, created_at, now());

-- Projects: current app uses name, brand_kit_id, and status. Preserve legacy title.
alter table public.projects
  add column if not exists name text,
  add column if not exists brand_kit_id uuid,
  add column if not exists status text default 'active',
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'title'
  ) then
    update public.projects
    set
      name = coalesce(name, title, 'Untitled project'),
      status = coalesce(status, 'active'),
      updated_at = coalesce(updated_at, created_at, now());
  else
    update public.projects
    set
      name = coalesce(name, 'Untitled project'),
      status = coalesce(status, 'active'),
      updated_at = coalesce(updated_at, created_at, now());
  end if;
end $$;

alter table public.projects
  alter column status set default 'active',
  alter column updated_at set default now();

-- Marketing generations: add current generation tracking payload columns.
alter table public.marketing_generations
  add column if not exists project_id uuid,
  add column if not exists brand_kit_id uuid,
  add column if not exists content_type text default 'campaign',
  add column if not exists model text default 'unknown',
  add column if not exists output jsonb default '{}'::jsonb,
  add column if not exists status text default 'queued',
  add column if not exists error_message text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_generations'
      and column_name = 'image_url'
  ) then
    update public.marketing_generations
    set
      content_type = coalesce(content_type, 'campaign'),
      model = coalesce(model, 'unknown'),
      output = coalesce(output, case when image_url is not null then jsonb_build_object('image_url', image_url) else '{}'::jsonb end),
      status = coalesce(status, 'completed'),
      metadata = coalesce(metadata, '{}'::jsonb),
      updated_at = coalesce(updated_at, created_at, now());
  else
    update public.marketing_generations
    set
      content_type = coalesce(content_type, 'campaign'),
      model = coalesce(model, 'unknown'),
      output = coalesce(output, '{}'::jsonb),
      status = coalesce(status, 'completed'),
      metadata = coalesce(metadata, '{}'::jsonb),
      updated_at = coalesce(updated_at, created_at, now());
  end if;
end $$;

alter table public.marketing_generations
  alter column content_type set default 'campaign',
  alter column model set default 'unknown',
  alter column output set default '{}'::jsonb,
  alter column status set default 'queued',
  alter column metadata set default '{}'::jsonb,
  alter column updated_at set default now();

-- Image generations: keep compatibility with both legacy provider payload columns
-- and current storage/signed URL columns.
alter table public.image_generations
  add column if not exists brand_kit_id uuid,
  add column if not exists signed_url text,
  add column if not exists storage_path text,
  add column if not exists model text,
  add column if not exists status text default 'queued',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'image_generations'
      and column_name = 'provider'
  ) then
    update public.image_generations
    set
      model = coalesce(model, provider, 'unknown'),
      status = coalesce(status, 'queued'),
      metadata = coalesce(metadata, '{}'::jsonb),
      updated_at = coalesce(updated_at, created_at, now());
  else
    update public.image_generations
    set
      model = coalesce(model, 'unknown'),
      status = coalesce(status, 'queued'),
      metadata = coalesce(metadata, '{}'::jsonb),
      updated_at = coalesce(updated_at, created_at, now());
  end if;
end $$;

alter table public.image_generations
  alter column status set default 'queued',
  alter column metadata set default '{}'::jsonb,
  alter column updated_at set default now();

-- PayPal webhook events: add fields used by deduplication and subscription sync.
alter table public.paypal_webhook_events
  add column if not exists paypal_subscription_id text,
  add column if not exists processed_at timestamptz default now();

update public.paypal_webhook_events
set processed_at = coalesce(processed_at, created_at, now());

alter table public.paypal_webhook_events
  alter column processed_at set default now();

-- Constraints and indexes are guarded so drifted databases can converge without
-- failing if equivalent objects already exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_brand_kit_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_brand_kit_id_fkey
      foreign key (brand_kit_id)
      references public.brand_kits(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketing_generations'::regclass
      and conname = 'marketing_generations_project_id_fkey'
  ) then
    alter table public.marketing_generations
      add constraint marketing_generations_project_id_fkey
      foreign key (project_id)
      references public.projects(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketing_generations'::regclass
      and conname = 'marketing_generations_brand_kit_id_fkey'
  ) then
    alter table public.marketing_generations
      add constraint marketing_generations_brand_kit_id_fkey
      foreign key (brand_kit_id)
      references public.brand_kits(id)
      on delete set null
      not valid;
  end if;
end $$;

create unique index if not exists brand_kits_one_default_per_user_idx on public.brand_kits(user_id) where is_default;
create index if not exists brand_kits_user_id_created_at_idx on public.brand_kits(user_id, created_at desc);
create index if not exists projects_user_id_created_at_idx on public.projects(user_id, created_at desc);
create index if not exists projects_brand_kit_id_idx on public.projects(brand_kit_id);
create index if not exists marketing_generations_user_id_created_at_idx on public.marketing_generations(user_id, created_at desc);
create index if not exists marketing_generations_project_id_idx on public.marketing_generations(project_id);
create index if not exists marketing_generations_brand_kit_id_idx on public.marketing_generations(brand_kit_id);
create index if not exists paypal_webhook_events_subscription_idx on public.paypal_webhook_events(paypal_subscription_id) where paypal_subscription_id is not null;

notify pgrst, 'reload schema';
