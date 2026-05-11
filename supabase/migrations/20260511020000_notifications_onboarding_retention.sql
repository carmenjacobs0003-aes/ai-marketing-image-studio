create type public.notification_kind as enum (
  'welcome',
  'tutorial',
  'upgrade',
  'usage_warning',
  'saved_generation',
  'creator_activity',
  'gallery_interaction',
  'profile_completion',
  'achievement',
  'weekly_digest',
  'system'
);

create type public.notification_tone as enum ('info', 'success', 'warning', 'error');

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app boolean not null default true,
  email boolean not null default false,
  weekly_digest boolean not null default true,
  creator_activity boolean not null default true,
  gallery_interactions boolean not null default true,
  usage_warnings boolean not null default true,
  product_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind public.notification_kind not null,
  tone public.notification_tone not null default 'info',
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 800),
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_steps text[] not null default '{}',
  dismissed_welcome_at timestamptz,
  first_project_completed_at timestamptz,
  first_generation_completed_at timestamptz,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  title text not null,
  description text,
  earned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create table public.weekly_digest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_week date not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, digest_week)
);

create index notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);
create index notifications_actor_id_created_at_idx on public.notifications(actor_id, created_at desc) where actor_id is not null;
create index notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index user_achievements_user_id_earned_at_idx on public.user_achievements(user_id, earned_at desc);
create index weekly_digest_runs_user_id_week_idx on public.weekly_digest_runs(user_id, digest_week desc);

create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
create trigger onboarding_progress_set_updated_at before update on public.onboarding_progress for each row execute function public.set_updated_at();
create trigger weekly_digest_runs_set_updated_at before update on public.weekly_digest_runs for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.user_achievements enable row level security;
alter table public.weekly_digest_runs enable row level security;

create policy "Notification preferences are readable by owner" on public.notification_preferences for select using (auth.uid() = user_id);
create policy "Notification preferences are insertable by owner" on public.notification_preferences for insert with check (auth.uid() = user_id);
create policy "Notification preferences are updatable by owner" on public.notification_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Notifications are readable by owner" on public.notifications for select using (auth.uid() = user_id);
create policy "Notifications are insertable by owner" on public.notifications for insert with check (auth.uid() = user_id);
create policy "Notifications are updatable by owner" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Onboarding progress is readable by owner" on public.onboarding_progress for select using (auth.uid() = user_id);
create policy "Onboarding progress is insertable by owner" on public.onboarding_progress for insert with check (auth.uid() = user_id);
create policy "Onboarding progress is updatable by owner" on public.onboarding_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Achievements are readable by owner" on public.user_achievements for select using (auth.uid() = user_id);
create policy "Achievements are insertable by owner" on public.user_achievements for insert with check (auth.uid() = user_id);
create policy "Achievements are updatable by owner" on public.user_achievements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Weekly digests are readable by owner" on public.weekly_digest_runs for select using (auth.uid() = user_id);
create policy "Weekly digests are insertable by owner" on public.weekly_digest_runs for insert with check (auth.uid() = user_id);
create policy "Weekly digests are updatable by owner" on public.weekly_digest_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.seed_retention_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.onboarding_progress (user_id, completed_steps) values (new.id, array['welcome']) on conflict (user_id) do nothing;
  insert into public.notifications (user_id, kind, tone, title, body, href)
  values (new.id, 'welcome', 'success', 'Welcome to AIStudio', 'Start the guided onboarding flow to create your first project and campaign asset.', '/dashboard?onboarding=1')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_retention after insert on auth.users for each row execute function public.seed_retention_for_new_user();
