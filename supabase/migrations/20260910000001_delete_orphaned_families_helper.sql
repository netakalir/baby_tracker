-- ============================================================
-- D1 (CR round 2): clean up families orphaned by account deletion.
--
-- Account deletion is "leave only" (settings spec §6): the delete-user
-- Edge Function hard-deletes the caller's auth user, which CASCADEs to
-- their family_members row. The shared family / children / events are
-- intentionally preserved for the REMAINING parent (author FKs were
-- relaxed to ON DELETE SET NULL in 20260806000001).
--
-- The gap: when the departing user was the family's LAST (or only)
-- member, cascading away their membership leaves the family with zero
-- members. Such a family is unreachable through RLS (every family policy
-- is scoped to auth_user_family_ids()), so it — and its children and
-- events — becomes dead, undeletable, orphaned data. create_family's
-- one-off cleanup (20260713000001) only swept pre-existing orphans; it
-- does not run on deletion.
--
-- Fix: a SECURITY DEFINER helper the Edge Function calls (with the
-- departing user's family ids, captured BEFORE the auth user is deleted)
-- to delete ONLY those families that now have no members. Deleting a
-- family cascades to its children, events, members and invites (initial
-- schema FKs). The `not exists (... family_members ...)` guard means a
-- family that still has ANOTHER member is never touched — so a two-parent
-- family survives one parent leaving, exactly as required.
--
-- Execution model / ordering (see delete-user/index.ts): the function is
-- designed to run AFTER the auth user is deleted (so the departing
-- membership is already gone and the zero-member condition is accurate),
-- scoped to the specific family ids that user belonged to. It never scans
-- or deletes families outside that set. EXECUTE is granted to service_role
-- only — this is an admin cleanup path invoked from the Edge Function with
-- the service key, never reachable by a normal authenticated client.
-- ============================================================

create or replace function delete_orphaned_families(p_family_ids uuid[])
  returns void
  language sql
  security definer
  set search_path = public
as $$
  delete from families f
  where f.id = any(p_family_ids)
    and not exists (
      select 1 from family_members m where m.family_id = f.id
    );
$$;

revoke all on function delete_orphaned_families(uuid[]) from public;
grant execute on function delete_orphaned_families(uuid[]) to service_role;
