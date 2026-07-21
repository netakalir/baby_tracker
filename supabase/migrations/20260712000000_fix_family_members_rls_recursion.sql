-- ============================================================
-- Fix: "infinite recursion detected in policy for relation
-- family_members" (Postgres error 42P17).
--
-- Cause: every family-scoped policy resolved membership with
--   (select family_id from family_members where user_id = auth.uid())
-- Because that subquery reads family_members, it re-triggered the
-- SELECT policy ON family_members, which ran the subquery again -> loop.
--
-- Fix: resolve the current user's family_ids through a single
-- SECURITY DEFINER helper. The function runs with the definer's
-- rights, so reading family_members inside it does NOT re-evaluate
-- the table's RLS policy - which breaks the recursion. The access
-- boundary is UNCHANGED: the function still returns only the rows
-- where user_id = auth.uid(), i.e. only the caller's own families.
-- ============================================================

create or replace function auth_user_family_ids()
  returns setof uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select family_id from family_members where user_id = auth.uid()
$$;

revoke all on function auth_user_family_ids() from public;
grant execute on function auth_user_family_ids() to authenticated;

-- ============================================================
-- Rewrite every family-scoped policy to use the helper instead of
-- an inline self-referencing subquery. Same rule, no recursion.
-- ============================================================

-- families
drop policy "members can access their family" on families;
create policy "members can access their family"
  on families for all
  using (id in (select auth_user_family_ids()));

-- family_members (this was the direct source of the recursion)
drop policy "members can view their family's members" on family_members;
create policy "members can view their family's members"
  on family_members for select
  using (family_id in (select auth_user_family_ids()));

-- children
drop policy "members can access their family's children" on children;
create policy "members can access their family's children"
  on children for all
  using (family_id in (select auth_user_family_ids()));

-- events
drop policy "members can access events for their family's children" on events;
create policy "members can access events for their family's children"
  on events for all
  using (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
  );

-- family_invites (create + list-by-membership; the read-by-token
-- policy is left untouched)
drop policy "members can create invites for their family" on family_invites;
create policy "members can create invites for their family"
  on family_invites for insert
  with check (family_id in (select auth_user_family_ids()));

drop policy "members can view their family's invites" on family_invites;
create policy "members can view their family's invites"
  on family_invites for select
  using (family_id in (select auth_user_family_ids()));
