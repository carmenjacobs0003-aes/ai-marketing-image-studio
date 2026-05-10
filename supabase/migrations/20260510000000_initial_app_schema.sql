create extension if not exists "pgcrypto";

create type public.app_plan as enum ('free', 'pro', 'team');
create type public.image_generation_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.usage_event_type as enum ('image_generation', 'image_upload', 'api_request');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan public.app_plan not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  prompt text not null check (char_length(prompt) between 10 and 2000),
  model text not null,
  status public.image_generation_status not null default 'queued',
  storage_path text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type public.usage_event_type not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index projects_user_id_created_at_idx on public.projects(user_id, created_at desc);
create index image_generations_user_id_created_at_idx on public.image_generations(user_id, created_at desc);
create index image_generations_project_id_idx on public.image_generations(project_id);
create index usage_events_user_id_created_at_idx on public.usage_events(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger image_generations_set_updated_at
  before update on public.image_generations
  for each row execute function public.set_updated_at();

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace view public.usage_totals_current_month
with (security_invoker = true) as
select
  user_id,
  event_type,
  coalesce(sum(quantity), 0)::integer as total_quantity
from public.usage_events
where created_at >= date_trunc('month', now())
group by user_id, event_type;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.image_generations enable row level security;
alter table public.usage_events enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Projects are readable by owner"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Projects are insertable by owner"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Projects are updatable by owner"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Projects are deletable by owner"
  on public.projects for delete
  using (auth.uid() = user_id);

create policy "Image generations are readable by owner"
  on public.image_generations for select
  using (auth.uid() = user_id);

create policy "Image generations are insertable by owner"
  on public.image_generations for insert
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects
        where projects.id = image_generations.project_id
          and projects.user_id = auth.uid()
      )
    )
  );

create policy "Image generations are updatable by owner"
  on public.image_generations for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects
        where projects.id = image_generations.project_id
          and projects.user_id = auth.uid()
      )
    )
  );

create policy "Usage events are readable by owner"
  on public.usage_events for select
  using (auth.uid() = user_id);

create policy "Usage events are insertable by owner"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-images', 'generated-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their generated images"
  on storage.objects for select
  using (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload their generated images"
  on storage.objects for insert
  with check (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their generated images"
  on storage.objects for update
  using (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their generated images"
  on storage.objects for delete
  using (bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]);
