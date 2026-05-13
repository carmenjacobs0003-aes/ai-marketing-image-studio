-- Repair production drift where image_generations.project_id is missing.
-- Keep the column nullable so existing rows are preserved, and add the foreign
-- key as NOT VALID so production data with historical orphans does not block
-- the repair while new writes are still protected.

alter table public.image_generations
  add column if not exists project_id uuid;

alter table public.image_generations
  alter column project_id drop not null;

do $$
begin
  if to_regclass('public.projects') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.image_generations'::regclass
        and conname = 'image_generations_project_id_fkey'
    )
    and not exists (
      select 1
      from pg_constraint constraint_info
      join pg_attribute constrained_column
        on constrained_column.attrelid = constraint_info.conrelid
       and constrained_column.attnum = any (constraint_info.conkey)
      join pg_attribute referenced_column
        on referenced_column.attrelid = constraint_info.confrelid
       and referenced_column.attnum = any (constraint_info.confkey)
      where constraint_info.conrelid = 'public.image_generations'::regclass
        and constraint_info.confrelid = 'public.projects'::regclass
        and constraint_info.contype = 'f'
        and constrained_column.attname = 'project_id'
        and referenced_column.attname = 'id'
    ) then
    alter table public.image_generations
      add constraint image_generations_project_id_fkey
      foreign key (project_id)
      references public.projects(id)
      on delete set null
      not valid;
  end if;
end $$;

create index if not exists image_generations_project_id_idx
  on public.image_generations(project_id);

alter table public.image_generations enable row level security;

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
