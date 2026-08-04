-- ============================================================
-- Per-family settings (Task 12b, screen-settings-spec.md §4.2).
--
-- One row per family holding UI/behaviour preferences shared by
-- both parents:
--   * units    - 'ml' | 'oz' for feeding amounts
--   * day_start- the day-boundary hour used by the Today screen.
--     Stored as a bare `time` (no zone). Per the CLAUDE.md timezone
--     principle, "what counts as today" is computed client-side in
--     Israel local time; this migration only STORES the chosen hour,
--     it does not apply any timezone conversion in the database.
--
-- Lazy creation: the row is created with defaults either when the
-- family is created OR on first read/write from the client. We do
-- NOT add a trigger or seed rows here - the INSERT policy below lets
-- any family member lazily create their family's row, which keeps
-- this migration free of data backfill and avoids coupling to the
-- create_family() RPC. (Extending create_family() to also insert a
-- defaults row is a valid future option, but is intentionally left
-- out of this migration - see report.)
--
-- Follows the project's family-scoped RLS pattern: membership is
-- resolved via the security-definer helper auth_user_family_ids()
-- (NOT an inline family_members subquery, which recurses), and
-- policies are split per command so the INSERT WITH CHECK is explicit
-- and a fresh row can actually be created.
--
-- No realtime: family_settings is deliberately NOT added to the
-- supabase_realtime publication for the MVP - settings changes do not
-- need live parent-to-parent push.
-- ============================================================

create table family_settings (
  family_id  uuid primary key references families(id) on delete cascade,
  units      text not null default 'ml' check (units in ('ml', 'oz')),
  day_start  time not null default '00:00',
  updated_at timestamp with time zone not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table family_settings enable row level security;

drop policy if exists "members can view their family's settings"   on family_settings;
drop policy if exists "members can insert their family's settings"  on family_settings;
drop policy if exists "members can update their family's settings"  on family_settings;

create policy "members can view their family's settings"
  on family_settings for select
  using (family_id in (select auth_user_family_ids()));

create policy "members can insert their family's settings"
  on family_settings for insert
  with check (family_id in (select auth_user_family_ids()));

create policy "members can update their family's settings"
  on family_settings for update
  using (family_id in (select auth_user_family_ids()))
  with check (family_id in (select auth_user_family_ids()));

-- No delete policy: settings rows live and die with their family
-- (ON DELETE CASCADE handles removal). Members cannot delete the
-- row directly, which prevents a family losing its settings row.

-- ============================================================
-- GRANTS (RLS is not enough on its own - the role also needs table
-- privileges). No delete grant, matching the absence of a delete policy.
-- ============================================================

grant select, insert, update on family_settings to authenticated;

-- ============================================================
-- REALTIME: intentionally omitted (see header). Do NOT add
-- family_settings to supabase_realtime for the MVP.
-- ============================================================
