-- ============================================================
-- Fix: creating a family failed with "new row violates row-level
-- security policy for table families" (Postgres error 42501).
--
-- Cause: the single "for all" policy on families used only a USING
-- clause (id in (select auth_user_family_ids())). For INSERT, Postgres
-- applies that expression as the WITH CHECK - but at creation time the
-- new family is not yet in the creator's memberships (the membership
-- row is inserted immediately afterwards). Chicken-and-egg: you could
-- never create the first family.
--
-- Fix: split the policy by command. Any authenticated user may CREATE
-- a family (with check true). Reading, updating and deleting stay
-- restricted to members of that family - the security boundary for
-- existing data is unchanged.
-- ============================================================

drop policy "members can access their family" on families;

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
