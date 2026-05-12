-- Repair production drift for the image generation write path.
--
-- The backend creates image_generations rows with this insert payload:
--   user_id, project_id, brand_kit_id, prompt, model, status, metadata
-- and later updates:
--   status, storage_path, signed_url, error_message, metadata, project_id
-- Some production databases were created before the current image generation
-- model stabilized, so add every column the current code can read or write in
-- one idempotent migration instead of surfacing schema-cache misses one at a
-- time.

create extension if not exists "pgcrypto";

create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid()
);

alter table public.image_generations
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists project_id uuid,
  add column if not exists brand_kit_id uuid,
  add column if not exists prompt text,
  add column if not exists model text,
  add column if not exists status text default 'queued',
  add column if not exists storage_path text,
  add column if not exists signed_url text,
  add column if not exists image_url text,
  add column if not exists error_message text,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.image_generations
  alter column id set default gen_random_uuid(),
  alter column status set default 'queued',
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column brand_kit_id drop not null,
  alter column project_id drop not null,
  alter column storage_path drop not null,
  alter column signed_url drop not null,
  alter column image_url drop not null,
  alter column error_message drop not null,
  alter column metadata drop not null;

update public.image_generations
set
  id = coalesce(id, gen_random_uuid()),
  status = coalesce(status, 'queued'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.image_generations
  alter column id set not null,
  alter column status set not null,
  alter column created_at set not null,
  alter column updated_at set not null;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.image_generations'::regclass
      and contype = 'p'
  ) then
    alter table public.image_generations
      add constraint image_generations_pkey
      primary key (id);
  end if;
end $$;

do $$
begin
  if to_regclass('auth.users') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.image_generations'::regclass
        and conname = 'image_generations_user_id_fkey'
    ) then
      alter table public.image_generations
        add constraint image_generations_user_id_fkey
        foreign key (user_id)
        references auth.users(id)
        on delete cascade
        not valid;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.projects') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.image_generations'::regclass
        and conname = 'image_generations_project_id_fkey'
    ) then
    alter table public.image_generations
      add constraint image_generations_project_id_fkey
      foreign key (project_id)
      references public.projects(id)
      on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.brand_kits') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.image_generations'::regclass
        and conname = 'image_generations_brand_kit_id_fkey'
    ) then
    alter table public.image_generations
      add constraint image_generations_brand_kit_id_fkey
      foreign key (brand_kit_id)
      references public.brand_kits(id)
      on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.image_generations'::regclass
      and conname = 'image_generations_status_check'
  ) then
    alter table public.image_generations
      add constraint image_generations_status_check
      check (status in ('queued', 'processing', 'completed', 'failed'))
      not valid;
  end if;
end $$;

create index if not exists image_generations_user_id_created_at_idx
  on public.image_generations(user_id, created_at desc);

create index if not exists image_generations_project_id_idx
  on public.image_generations(project_id);

create index if not exists image_generations_brand_kit_id_idx
  on public.image_generations(brand_kit_id);

alter table public.image_generations enable row level security;

drop policy if exists "Image generations are readable by owner"
  on public.image_generations;

create policy "Image generations are readable by owner"
  on public.image_generations
  for select
  using (auth.uid() = user_id);

drop policy if exists "Image generations are insertable by owner"
  on public.image_generations;

create policy "Image generations are insertable by owner"
  on public.image_generations
  for insert
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1
        from public.projects
        where projects.id = image_generations.project_id
          and projects.user_id = auth.uid()
      )
    )
    and (
      brand_kit_id is null
      or exists (
        select 1
        from public.brand_kits
        where brand_kits.id = image_generations.brand_kit_id
          and brand_kits.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Image generations are updatable by owner"
  on public.image_generations;

create policy "Image generations are updatable by owner"
  on public.image_generations
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1
        from public.projects
        where projects.id = image_generations.project_id
          and projects.user_id = auth.uid()
      )
    )
    and (
      brand_kit_id is null
      or exists (
        select 1
        from public.brand_kits
        where brand_kits.id = image_generations.brand_kit_id
          and brand_kits.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
