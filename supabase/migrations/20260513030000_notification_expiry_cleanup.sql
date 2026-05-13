alter table public.notifications
  add column if not exists expires_at timestamptz;

create index if not exists notifications_user_expires_at_idx
  on public.notifications(user_id, expires_at, created_at desc);

create or replace function public.delete_expired_notifications(p_before timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.notifications
  where expires_at is not null
    and expires_at < p_before;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
