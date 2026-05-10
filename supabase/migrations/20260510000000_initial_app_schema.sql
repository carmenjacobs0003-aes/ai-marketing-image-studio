create extension if not exists "pgcrypto";

create type public.app_plan as enum ('free', 'pro', 'agency');
create type public.generation_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan public.app_plan not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  voice text,
  tone text,
  logo_url text,
  colors text[] not null default '{}',
  fonts text[] not null default '{}',
  products jsonb not null default '[]'::jsonb,
  guidelines text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  prompt text not null check (char_length(prompt) between 10 and 4000),
  content_type text not null default 'campaign',
  model text not null,
  output jsonb not null default '{}'::jsonb,
  status public.generation_status not null default 'queued',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  prompt text not null check (char_length(prompt) between 10 and 2000),
  model text not null,
  status public.generation_status not null default 'queued',
  storage_path text,
  signed_url text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  marketing_generations integer not null default 0 check (marketing_generations >= 0),
  image_generations integer not null default 0 check (image_generations >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create unique index brand_kits_one_default_per_user_idx on public.brand_kits(user_id) where is_default;
create index brand_kits_user_id_created_at_idx on public.brand_kits(user_id, created_at desc);
create index projects_user_id_created_at_idx on public.projects(user_id, created_at desc);
create index projects_brand_kit_id_idx on public.projects(brand_kit_id);
create index marketing_generations_user_id_created_at_idx on public.marketing_generations(user_id, created_at desc);
create index marketing_generations_project_id_idx on public.marketing_generations(project_id);
create index marketing_generations_brand_kit_id_idx on public.marketing_generations(brand_kit_id);
create index image_generations_user_id_created_at_idx on public.image_generations(user_id, created_at desc);
create index image_generations_project_id_idx on public.image_generations(project_id);
create index image_generations_brand_kit_id_idx on public.image_generations(brand_kit_id);
create index daily_usage_user_id_usage_date_idx on public.daily_usage(user_id, usage_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger brand_kits_set_updated_at before update on public.brand_kits for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger marketing_generations_set_updated_at before update on public.marketing_generations for each row execute function public.set_updated_at();
create trigger image_generations_set_updated_at before update on public.image_generations for each row execute function public.set_updated_at();
create trigger daily_usage_set_updated_at before update on public.daily_usage for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.increment_daily_usage(
  p_user_id uuid,
  p_usage_date date,
  p_kind text,
  p_quantity integer default 1
)
returns public.daily_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_row public.daily_usage;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Cannot increment usage for another user';
  end if;

  if p_quantity < 1 then
    raise exception 'Quantity must be positive';
  end if;

  if p_kind not in ('marketing_generations', 'image_generations') then
    raise exception 'Unsupported usage kind: %', p_kind;
  end if;

  insert into public.daily_usage (user_id, usage_date)
  values (p_user_id, p_usage_date)
  on conflict (user_id, usage_date) do nothing;

  if p_kind = 'marketing_generations' then
    update public.daily_usage
    set marketing_generations = marketing_generations + p_quantity
    where user_id = p_user_id and usage_date = p_usage_date
    returning * into usage_row;
  else
    update public.daily_usage
    set image_generations = image_generations + p_quantity
    where user_id = p_user_id and usage_date = p_usage_date
    returning * into usage_row;
  end if;

  return usage_row;
end;
$$;

alter table public.profiles enable row level security;
alter table public.brand_kits enable row level security;
alter table public.projects enable row level security;
alter table public.marketing_generations enable row level security;
alter table public.image_generations enable row level security;
alter table public.daily_usage enable row level security;

create policy "Profiles are readable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Profiles are updatable by owner" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Brand kits are readable by owner" on public.brand_kits for select using (auth.uid() = user_id);
create policy "Brand kits are insertable by owner" on public.brand_kits for insert with check (auth.uid() = user_id);
create policy "Brand kits are updatable by owner" on public.brand_kits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Brand kits are deletable by owner" on public.brand_kits for delete using (auth.uid() = user_id);

create policy "Projects are readable by owner" on public.projects for select using (auth.uid() = user_id);
create policy "Projects are insertable by owner" on public.projects for insert with check (auth.uid() = user_id and (brand_kit_id is null or exists (select 1 from public.brand_kits where brand_kits.id = projects.brand_kit_id and brand_kits.user_id = auth.uid())));
create policy "Projects are updatable by owner" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id and (brand_kit_id is null or exists (select 1 from public.brand_kits where brand_kits.id = projects.brand_kit_id and brand_kits.user_id = auth.uid())));
create policy "Projects are deletable by owner" on public.projects for delete using (auth.uid() = user_id);

create policy "Marketing generations are readable by owner" on public.marketing_generations for select using (auth.uid() = user_id);
create policy "Marketing generations are insertable by owner" on public.marketing_generations for insert with check (auth.uid() = user_id and (project_id is null or exists (select 1 from public.projects where projects.id = marketing_generations.project_id and projects.user_id = auth.uid())) and (brand_kit_id is null or exists (select 1 from public.brand_kits where brand_kits.id = marketing_generations.brand_kit_id and brand_kits.user_id = auth.uid())));
create policy "Marketing generations are updatable by owner" on public.marketing_generations for update using (auth.uid() = user_id) with check (auth.uid() = user_id and (project_id is null or exists (select 1 from public.projects where projects.id = marketing_generations.project_id and projects.user_id = auth.uid())) and (brand_kit_id is null or exists (select 1 from public.brand_kits where brand_kits.id = marketing_generations.brand_kit_id and brand_kits.user_id = auth.uid())));

create policy "Image generations are readable by owner" on public.image_generations for select using (auth.uid() = user_id);
create policy "Image generations are insertable by owner" on public.image_generations for insert with check (auth.uid() = user_id and (project_id is null or exists (select 1 from public.projects where projects.id = image_generations.project_id and projects.user_id = auth.uid())) and (brand_kit_id is null or exists (select 1 from public.brand_kits where brand_kits.id = image_generations.brand_kit_id and brand_kits.user_id = auth.uid())));
create policy "Image generations are updatable by owner" on public.image_generations for update using (auth.uid() = user_id) with check (auth.uid() = user_id and (project_id is null or exists (select 1 from public.projects where projects.id = image_generations.project_id and projects.user_id = auth.uid())) and (brand_kit_id is null or exists (select 1 from public.brand_kits where brand_kits.id = image_generations.brand_kit_id and brand_kits.user_id = auth.uid())));

create policy "Daily usage is readable by owner" on public.daily_usage for select using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-images', 'generated-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their generated images" on storage.objects for select using (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can upload their generated images" on storage.objects for insert with check (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can update their generated images" on storage.objects for update using (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their generated images" on storage.objects for delete using (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);
