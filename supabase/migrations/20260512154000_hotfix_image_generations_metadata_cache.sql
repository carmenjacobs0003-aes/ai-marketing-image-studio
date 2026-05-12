-- Production hotfix for PostgREST schema-cache drift on image_generations.
-- Adds the columns required by the image generation insert payload and forces
-- PostgREST to reload its schema cache immediately after the DDL completes.

alter table public.image_generations
  add column if not exists metadata jsonb null;

alter table public.image_generations
  add column if not exists brand_kit_id uuid null;

notify pgrst, 'reload schema';
