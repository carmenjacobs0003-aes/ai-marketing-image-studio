alter table public.profiles
  add column if not exists paypal_customer_id text,
  add column if not exists paypal_subscription_id text unique,
  add column if not exists paypal_plan_id text,
  add column if not exists subscription_status text not null default 'free' check (subscription_status in ('free', 'approval_pending', 'active', 'suspended', 'cancelled', 'expired', 'past_due')),
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at timestamptz;

create index if not exists profiles_paypal_subscription_id_idx on public.profiles(paypal_subscription_id);
create index if not exists profiles_subscription_status_idx on public.profiles(subscription_status);

create table if not exists public.paypal_webhook_events (
  id text primary key,
  event_type text not null,
  paypal_subscription_id text,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.paypal_webhook_events enable row level security;

create or replace function public.sync_profile_subscription(
  p_user_id uuid,
  p_plan public.app_plan,
  p_subscription_status text,
  p_paypal_subscription_id text default null,
  p_paypal_plan_id text default null,
  p_paypal_customer_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
begin
  if p_subscription_status not in ('free', 'approval_pending', 'active', 'suspended', 'cancelled', 'expired', 'past_due') then
    raise exception 'Unsupported subscription status: %', p_subscription_status;
  end if;

  update public.profiles
  set
    plan = p_plan,
    subscription_status = p_subscription_status,
    paypal_subscription_id = p_paypal_subscription_id,
    paypal_plan_id = p_paypal_plan_id,
    paypal_customer_id = p_paypal_customer_id,
    subscription_current_period_end = p_current_period_end,
    subscription_cancel_at = p_cancel_at
  where id = p_user_id
  returning * into profile_row;

  if profile_row is null then
    raise exception 'Profile not found for user %', p_user_id;
  end if;

  return profile_row;
end;
$$;

revoke update (plan, paypal_customer_id, paypal_subscription_id, paypal_plan_id, subscription_status, subscription_current_period_end, subscription_cancel_at)
  on public.profiles from anon, authenticated;
