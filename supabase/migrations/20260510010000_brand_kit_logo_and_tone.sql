alter table public.brand_kits
  add column if not exists tone text,
  add column if not exists logo_url text;
