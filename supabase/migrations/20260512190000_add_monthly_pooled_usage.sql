-- Replace per-kind daily quota tracking with one pooled monthly generation counter.
create table if not exists public.monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_month date not null default date_trunc('month', now())::date,
  total_generations integer not null default 0 check (total_generations >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_month)
);

create index if not exists monthly_usage_user_id_usage_month_idx
  on public.monthly_usage(user_id, usage_month desc);

alter table public.monthly_usage enable row level security;

drop trigger if exists monthly_usage_set_updated_at on public.monthly_usage;
create trigger monthly_usage_set_updated_at
  before update on public.monthly_usage
  for each row execute function public.set_updated_at();

drop policy if exists "Monthly usage is readable by owner" on public.monthly_usage;
create policy "Monthly usage is readable by owner"
  on public.monthly_usage for select
  using (auth.uid() = user_id);

insert into public.monthly_usage (user_id, usage_month, total_generations)
select
  user_id,
  date_trunc('month', usage_date)::date as usage_month,
  sum(marketing_generations + image_generations)::integer as total_generations
from public.daily_usage
group by user_id, date_trunc('month', usage_date)::date
on conflict (user_id, usage_month) do update
  set total_generations = greatest(
    public.monthly_usage.total_generations,
    excluded.total_generations
  );

create or replace function public.increment_monthly_usage(
  p_user_id uuid,
  p_usage_month date default date_trunc('month', now())::date,
  p_quantity integer default 1
)
returns public.monthly_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_row public.monthly_usage;
  effective_usage_month date := coalesce(p_usage_month, date_trunc('month', now())::date);
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Cannot increment usage for another user';
  end if;

  if p_quantity < 1 then
    raise exception 'Quantity must be positive';
  end if;

  insert into public.monthly_usage (user_id, usage_month, total_generations)
  values (p_user_id, effective_usage_month, p_quantity)
  on conflict (user_id, usage_month) do update
    set total_generations = public.monthly_usage.total_generations + excluded.total_generations
  returning * into usage_row;

  return usage_row;
end;
$$;
