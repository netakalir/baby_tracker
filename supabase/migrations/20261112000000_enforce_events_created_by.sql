-- ============================================================
-- Enforce events.created_by: a member can only author events as
-- themselves, and nobody can rewrite authorship afterwards.
--
-- The gap: events.created_by defaults to auth.uid(), but a default
-- is only a suggestion — a client that sends created_by explicitly
-- overrides it. Two holes followed:
--
--   1. INSERT: "members can insert events for their family"
--      (20260910000000_split_children_events_per_command_policies.sql)
--      only checks that child_id belongs to the caller's family. A
--      member could insert a row with created_by = the OTHER parent's
--      id (or null), i.e. log an event in someone else's name.
--   2. UPDATE: "members can update their family's events" lets a
--      member change any column, so authorship (and created_at) of
--      an existing event could be rewritten after the fact.
--
-- This violates the rls-policy-pattern rule that created_by is set
-- by the server, never trusted from client input. Nothing in the app
-- relies on either hole: integ's src/features/today/api.ts still
-- sends `created_by: userId` on insert, but userId comes from
-- supabase.auth.getUser() and therefore equals auth.uid(), so those
-- inserts keep passing. The app's only events UPDATE (stopTimerEvent)
-- writes end_time and metadata; nothing upserts events.
--
-- ------------------------------------------------------------
-- Fix 1 — INSERT: add `created_by = auth.uid()` to the WITH CHECK.
-- Null is deliberately NOT allowed: the column default stamps
-- auth.uid(), so a legitimate insert that omits created_by always
-- passes; accepting null would only let a client create anonymous,
-- unattributable rows. (Null still legitimately appears later, via
-- the account-deletion FK below — that path is not an INSERT.)
--
-- Fix 2 — UPDATE: make id, created_by and created_at non-updatable
-- for clients with COLUMN-LEVEL privileges: revoke the table-wide
-- UPDATE grant, then grant UPDATE only on the mutable columns
-- (child_id, type, start_time, end_time, metadata). An UPDATE that
-- touches any other column is rejected with 42501 (permission
-- denied) before RLS is even evaluated. The update RLS policy itself
-- is unchanged — it still decides WHICH rows a member may update.
--
-- Why column grants instead of a BEFORE UPDATE trigger that rejects
-- changes to created_by:
--   - events.created_by has `foreign key ... on delete set null`
--     (20260806000001_relax_auth_user_fks_for_account_deletion.sql).
--     When an account is deleted, that FK action is itself an UPDATE
--     of created_by. A naive "created_by must not change" trigger
--     would therefore break account deletion, or need a fragile
--     role-sniffing / "new value is null" exception (which a client
--     could then exploit to blank out authorship).
--   - Column privileges do not touch that path: referential actions
--     run as the table owner, and service_role is unaffected, so
--     account deletion and the delete-user Edge Function keep
--     working unchanged.
--   - They are declarative (visible in the catalog, no PL/pgSQL to
--     audit) and FAIL-CLOSED: a column added later is NOT updatable
--     by clients until a migration explicitly grants it.
--
-- MUST REMEMBER for future migrations: when adding a column to
-- events that the app needs to UPDATE, add it to the column grant,
--   grant update (<new_column>) on events to authenticated;
-- or the app's update will fail with "permission denied for table
-- events". INSERT, SELECT and DELETE remain table-level grants and
-- are unaffected by this. Likewise, never run a blanket
-- `grant all on all tables in schema public to authenticated` (or a
-- table-level `grant update on events`): it would silently restore
-- UPDATE on created_by and reopen this gap.
--
-- anon: the UPDATE revoke is also applied to anon for completeness.
-- No migration grants anon anything on events, but older Supabase
-- projects shipped default privileges that granted anon on every
-- public table; revoking a privilege that is not held is a no-op.
--
-- Realtime: unaffected. The events table stays in the
-- supabase_realtime publication; privileges and policies change who
-- may write, not how committed changes are broadcast.
--
-- Idempotent: the policy is dropped-if-exists before being
-- recreated; revoking table-level UPDATE also clears any column-level
-- UPDATE grants, so the revoke + grant pair converges to the same
-- end state on every run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. INSERT: family check (unchanged) AND author is the caller.
-- ------------------------------------------------------------

drop policy if exists "members can insert events for their family" on events;
create policy "members can insert events for their family"
  on events for insert
  with check (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
    and created_by = auth.uid()
  );

-- ------------------------------------------------------------
-- 2. UPDATE: only the mutable columns are updatable by clients.
--    id, created_by and created_at are write-once.
-- ------------------------------------------------------------

revoke update on events from authenticated;
revoke update on events from anon;

grant update (child_id, type, start_time, end_time, metadata) on events to authenticated;
