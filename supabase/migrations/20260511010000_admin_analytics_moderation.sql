create type public.admin_role as enum ('user', 'moderator', 'admin');
create type public.moderation_status as enum ('clean', 'flagged', 'removed');
create type public.audit_severity as enum ('info', 'warning', 'critical');

alter table public.profiles
  add column if not exists admin_role public.admin_role not null default 'user',
  add column if not exists creator_verified boolean not null default false,
  add column if not exists moderation_status public.moderation_status not null default 'clean',
  add column if not exists last_active_at timestamptz;

alter table public.gallery_items
  add column if not exists moderation_status public.moderation_status not null default 'clean',
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null;

alter table public.gallery_reports
  add column if not exists handled_by uuid references auth.users(id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists resolution_note text;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 160),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id uuid,
  severity public.audit_severity not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_admin_role_idx on public.profiles(admin_role);
create index if not exists profiles_last_active_at_idx on public.profiles(last_active_at desc);
create index if not exists profiles_creator_verified_idx on public.profiles(creator_verified) where creator_verified = true;
create index if not exists gallery_items_moderation_status_idx on public.gallery_items(moderation_status, report_count desc, created_at desc);
create index if not exists gallery_reports_status_idx on public.gallery_reports(status, created_at desc);
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs(target_type, target_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and admin_role in ('admin', 'moderator')
  );
$$;

create policy "Admins can read audit logs" on public.admin_audit_logs for select using (public.is_platform_admin());
create policy "Admins can create audit logs" on public.admin_audit_logs for insert with check (public.is_platform_admin());

create policy "Admins can read all profiles" on public.profiles for select using (public.is_platform_admin());
create policy "Admins can update all profiles" on public.profiles for update using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Admins can read all gallery reports" on public.gallery_reports for select using (public.is_platform_admin());
create policy "Admins can update gallery reports" on public.gallery_reports for update using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Admins can moderate gallery items" on public.gallery_items for update using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.mark_gallery_report_handled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status is distinct from new.status then
    new.handled_at = coalesce(new.handled_at, now());
    new.handled_by = coalesce(new.handled_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_reports_mark_handled on public.gallery_reports;
create trigger gallery_reports_mark_handled before update on public.gallery_reports for each row execute function public.mark_gallery_report_handled();
