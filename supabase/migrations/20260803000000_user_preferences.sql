-- ============================================================
-- Per-user application preferences (settings screen, spec §4.1).
--
-- Unlike every other table in this app, `user_preferences` is scoped
-- to a single AUTH USER, not to a family: display name, UI language,
-- theme, and notification toggles are personal to the logged-in
-- person and must never be shared with the other parent. So the RLS
-- boundary here is `user_id = auth.uid()` directly, NOT the usual
-- `auth_user_family_ids()` family-membership helper.
--
-- The primary key IS `user_id` (one row per user), with an
-- ON DELETE CASCADE FK to auth.users so the row is cleaned up
-- automatically when the account is deleted. There is deliberately
-- no DELETE policy: a user never deletes their own preferences row
-- on its own; it disappears with the account via the cascade.
--
-- language/theme are constrained with CHECK rather than an enum type
-- so future allowed values can be added with a plain column-check
-- migration instead of an enum alter. Defaults ('he', 'system')
-- match the app's Hebrew-first, OS-following defaults.
--
-- Not added to supabase_realtime: a user's own settings do not need
-- to be pushed live to any other session, so realtime is
-- intentionally omitted here.
-- ============================================================

create table user_preferences (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  language            text    not null default 'he'     check (language in ('he', 'en')),
  theme               text    not null default 'system' check (theme in ('light', 'dark', 'system')),
  notif_feeding       boolean not null default false,
  notif_sleep         boolean not null default false,
  notif_daily_summary boolean not null default false,
  updated_at          timestamp with time zone not null default now()
);

-- ============================================================
-- RLS ENABLE
-- ============================================================

alter table user_preferences enable row level security;

-- ============================================================
-- GRANTS (required in addition to RLS for API access)
-- ============================================================

grant select, insert, update, delete on user_preferences to authenticated;

-- ============================================================
-- POLICIES (per-command, own-row only: user_id = auth.uid())
--
-- No `for delete` policy on purpose (see header). Written
-- idempotently so the migration applies over partial prior state.
-- ============================================================

drop policy if exists "users can view their own preferences"   on user_preferences;
drop policy if exists "users can insert their own preferences"  on user_preferences;
drop policy if exists "users can update their own preferences"  on user_preferences;

create policy "users can view their own preferences"
  on user_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can insert their own preferences"
  on user_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own preferences"
  on user_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
