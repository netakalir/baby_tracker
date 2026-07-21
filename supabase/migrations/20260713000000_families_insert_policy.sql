-- ============================================================
-- Fix: creating a family failed with "new row violates row-level
-- security policy for table families" (Postgres error 42501).
--
-- The single "for all" policy on families used only a USING clause,
-- which Postgres also applies as the INSERT WITH CHECK. At creation
-- time the new family is not yet in the creator's memberships, so the
-- check failed - you could never create a family.
--
-- Split the policy by command: any authenticated user may CREATE a
-- family; reading, updating and deleting stay restricted to members.
-- Written idempotently (drop ... if exists) so it applies cleanly
-- regardless of what earlier partial migrations left in place.
-- ============================================================

drop policy if exists "members can access their family" on families;
drop policy if exists "authenticated users can create a family" on families;
drop policy if exists "members can view their family" on families;
drop policy if exists "members can update their family" on families;
drop policy if exists "members can delete their family" on families;

create policy "authenticated users can create a family"
  on families for insert
  to authenticated
  with check (true);

create policy "members can view their family"
  on families for select
  using (id in (select auth_user_family_ids()));

create policy "members can update their family"
  on families for update
  using (id in (select auth_user_family_ids()));

create policy "members can delete their family"
  on families for delete
  using (id in (select auth_user_family_ids()));
