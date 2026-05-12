-- Backfill production databases that were created before image generations
-- carried brand kit attribution. The column is intentionally nullable so image
-- generation can continue when the user has no selected/default brand kit.
alter table public.image_generations
  add column if not exists brand_kit_id uuid;

alter table public.image_generations
  alter column brand_kit_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.image_generations'::regclass
      and conname = 'image_generations_brand_kit_id_fkey'
  ) then
    alter table public.image_generations
      add constraint image_generations_brand_kit_id_fkey
      foreign key (brand_kit_id)
      references public.brand_kits(id)
      on delete set null;
  end if;
end $$;

create index if not exists image_generations_brand_kit_id_idx
  on public.image_generations(brand_kit_id);

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
