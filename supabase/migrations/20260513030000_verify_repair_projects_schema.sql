-- Full /projects production schema verification and safe repair.
--
-- This migration converges drifted production databases on the columns,
-- foreign keys, indexes, and PostgREST schema cache entries required by the
-- /projects Server Component queries. All repairs are idempotent and preserve
-- existing rows by keeping project links nullable and adding drift-repair
-- foreign keys as NOT VALID when historical orphaned rows might exist.

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects
  add column if not exists brand_kit_id uuid,
  add column if not exists status text default 'active',
  add column if not exists updated_at timestamptz default now();

alter table public.projects
  alter column brand_kit_id drop not null,
  alter column status set default 'active',
  alter column updated_at set default now();

update public.projects
set
  status = coalesce(status, 'active'),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.marketing_generations
  add column if not exists project_id uuid;

alter table public.marketing_generations
  alter column project_id drop not null;

alter table public.image_generations
  add column if not exists project_id uuid;

alter table public.image_generations
  alter column project_id drop not null;

create or replace function public.projects_schema_has_fk(
  p_table regclass,
  p_column text,
  p_referenced_table regclass,
  p_referenced_column text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_constraint constraint_info
    join pg_attribute constrained_column
      on constrained_column.attrelid = constraint_info.conrelid
     and constrained_column.attnum = any (constraint_info.conkey)
    join pg_attribute referenced_column
      on referenced_column.attrelid = constraint_info.confrelid
     and referenced_column.attnum = any (constraint_info.confkey)
    where constraint_info.contype = 'f'
      and constraint_info.conrelid = p_table
      and constraint_info.confrelid = p_referenced_table
      and constraint_info.confdeltype = 'n'
      and constrained_column.attname = p_column
      and referenced_column.attname = p_referenced_column
  );
$$;

do $$
begin
  if to_regclass('public.brand_kits') is not null
    and not public.projects_schema_has_fk(
      'public.projects'::regclass,
      'brand_kit_id',
      'public.brand_kits'::regclass,
      'id'
    ) then
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
    elsif not exists (
      select 1 from pg_constraint
      where conrelid = 'public.projects'::regclass
        and conname = 'projects_brand_kit_id_schema_repair_fkey'
    ) then
      alter table public.projects
        add constraint projects_brand_kit_id_schema_repair_fkey
        foreign key (brand_kit_id)
        references public.brand_kits(id)
        on delete set null
        not valid;
    end if;
  end if;

  if not public.projects_schema_has_fk(
    'public.marketing_generations'::regclass,
    'project_id',
    'public.projects'::regclass,
    'id'
  ) then
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
    elsif not exists (
      select 1 from pg_constraint
      where conrelid = 'public.marketing_generations'::regclass
        and conname = 'marketing_generations_project_id_schema_repair_fkey'
    ) then
      alter table public.marketing_generations
        add constraint marketing_generations_project_id_schema_repair_fkey
        foreign key (project_id)
        references public.projects(id)
        on delete set null
        not valid;
    end if;
  end if;

  if not public.projects_schema_has_fk(
    'public.image_generations'::regclass,
    'project_id',
    'public.projects'::regclass,
    'id'
  ) then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.image_generations'::regclass
        and conname = 'image_generations_project_id_fkey'
    ) then
      alter table public.image_generations
        add constraint image_generations_project_id_fkey
        foreign key (project_id)
        references public.projects(id)
        on delete set null
        not valid;
    elsif not exists (
      select 1 from pg_constraint
      where conrelid = 'public.image_generations'::regclass
        and conname = 'image_generations_project_id_schema_repair_fkey'
    ) then
      alter table public.image_generations
        add constraint image_generations_project_id_schema_repair_fkey
        foreign key (project_id)
        references public.projects(id)
        on delete set null
        not valid;
    end if;
  end if;
end $$;

create index if not exists projects_brand_kit_id_idx
  on public.projects(brand_kit_id);

create index if not exists marketing_generations_project_id_idx
  on public.marketing_generations(project_id);

create index if not exists image_generations_project_id_idx
  on public.image_generations(project_id);

create or replace function public.verify_projects_schema_repair()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  checks jsonb;
  failed_checks jsonb;
begin
  with check_results(label, ok) as (
    values
      (
        'projects table exists',
        to_regclass('public.projects') is not null
      ),
      (
        'brand_kits table exists for listBrandKits',
        to_regclass('public.brand_kits') is not null
      ),
      (
        'image_generations table exists',
        to_regclass('public.image_generations') is not null
      ),
      (
        'marketing_generations table exists',
        to_regclass('public.marketing_generations') is not null
      ),
      (
        'projects.brand_kit_id column exists',
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'projects'
            and column_name = 'brand_kit_id'
            and data_type = 'uuid'
        )
      ),
      (
        'image_generations.project_id column exists',
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'image_generations'
            and column_name = 'project_id'
            and data_type = 'uuid'
            and is_nullable = 'YES'
        )
      ),
      (
        'marketing_generations.project_id column exists',
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'marketing_generations'
            and column_name = 'project_id'
            and data_type = 'uuid'
            and is_nullable = 'YES'
        )
      ),
      (
        'projects.brand_kit_id foreign key targets brand_kits(id) with on delete set null',
        to_regclass('public.brand_kits') is not null
        and public.projects_schema_has_fk(
          'public.projects'::regclass,
          'brand_kit_id',
          'public.brand_kits'::regclass,
          'id'
        )
      ),
      (
        'image_generations.project_id foreign key targets projects(id) with on delete set null',
        public.projects_schema_has_fk(
          'public.image_generations'::regclass,
          'project_id',
          'public.projects'::regclass,
          'id'
        )
      ),
      (
        'marketing_generations.project_id foreign key targets projects(id) with on delete set null',
        public.projects_schema_has_fk(
          'public.marketing_generations'::regclass,
          'project_id',
          'public.projects'::regclass,
          'id'
        )
      ),
      (
        'projects.brand_kit_id index exists',
        exists (
          select 1
          from pg_index i
          join pg_attribute a
            on a.attrelid = i.indrelid
           and a.attnum = any (i.indkey)
          where i.indrelid = 'public.projects'::regclass
            and a.attname = 'brand_kit_id'
        )
      ),
      (
        'image_generations.project_id index exists',
        exists (
          select 1
          from pg_index i
          join pg_attribute a
            on a.attrelid = i.indrelid
           and a.attnum = any (i.indkey)
          where i.indrelid = 'public.image_generations'::regclass
            and a.attname = 'project_id'
        )
      ),
      (
        'marketing_generations.project_id index exists',
        exists (
          select 1
          from pg_index i
          join pg_attribute a
            on a.attrelid = i.indrelid
           and a.attnum = any (i.indkey)
          where i.indrelid = 'public.marketing_generations'::regclass
            and a.attname = 'project_id'
        )
      )
  )
  select
    coalesce(jsonb_object_agg(label, ok), '{}'::jsonb),
    coalesce(jsonb_agg(label) filter (where not ok), '[]'::jsonb)
  into checks, failed_checks
  from check_results;

  return jsonb_build_object(
    'ok', jsonb_array_length(failed_checks) = 0,
    'checks', checks,
    'failed_checks', failed_checks
  );
end;
$$;

notify pgrst, 'reload schema';
