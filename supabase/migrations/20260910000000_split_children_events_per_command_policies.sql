-- ============================================================
-- R1 (CR round 2): split the `children` and `events` RLS policies
-- from a single `for all` into explicit per-command policies.
--
-- Both tables still carry the `for all` policies created in
-- 20260712000000_fix_family_members_rls_recursion.sql:
--   children -> using (family_id in (select auth_user_family_ids()))
--   events   -> using (child_id in (select ... children ... family))
--
-- Why this matters (not merely cosmetic): a `for all ... using (...)`
-- policy reuses its USING expression as the INSERT WITH CHECK. For these
-- two tables the USING expression happens to also hold for a freshly
-- inserted row (the family/child link exists before the insert), so row
-- creation was not actually broken here — which is exactly why it went
-- unaudited. But it is inconsistent with the project's established
-- rls-policy-pattern (every other table splits select/insert/update/
-- delete, each with its own using / with check) and it leaves the INSERT
-- and UPDATE write-side checks implicit rather than stated. An implicit,
-- reused check is a latent footgun: any future change to the read rule
-- silently changes the write rule too.
--
-- This migration replaces both `for all` policies with the four explicit
-- per-command policies, preserving IDENTICAL access semantics: a family
-- member may select / insert / update / delete rows for children in
-- families they belong to (membership resolved through the
-- auth_user_family_ids() SECURITY DEFINER helper, same as every other
-- post-recursion-fix policy). No grant, RLS-enable, or realtime change is
-- needed — those are already in place from the initial schema.
--
-- Idempotent: each policy is dropped-if-exists before being (re)created.
-- ============================================================

-- ------------------------------------------------------------
-- children — direct family_id column
-- ------------------------------------------------------------

-- Remove the combined policy (named exactly as created in the recursion fix).
drop policy if exists "members can access their family's children" on children;

drop policy if exists "members can view their family's children" on children;
create policy "members can view their family's children"
  on children for select
  using (family_id in (select auth_user_family_ids()));

drop policy if exists "members can insert children for their family" on children;
create policy "members can insert children for their family"
  on children for insert
  with check (family_id in (select auth_user_family_ids()));

drop policy if exists "members can update their family's children" on children;
create policy "members can update their family's children"
  on children for update
  using (family_id in (select auth_user_family_ids()))
  with check (family_id in (select auth_user_family_ids()));

drop policy if exists "members can delete their family's children" on children;
create policy "members can delete their family's children"
  on children for delete
  using (family_id in (select auth_user_family_ids()));

-- ------------------------------------------------------------
-- events — indirect: child_id -> children -> family
-- ------------------------------------------------------------

-- Remove the combined policy (named exactly as created in the recursion fix).
drop policy if exists "members can access events for their family's children" on events;

drop policy if exists "members can view their family's events" on events;
create policy "members can view their family's events"
  on events for select
  using (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
  );

drop policy if exists "members can insert events for their family" on events;
create policy "members can insert events for their family"
  on events for insert
  with check (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
  );

drop policy if exists "members can update their family's events" on events;
create policy "members can update their family's events"
  on events for update
  using (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
  )
  with check (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
  );

drop policy if exists "members can delete their family's events" on events;
create policy "members can delete their family's events"
  on events for delete
  using (
    child_id in (
      select id from children where family_id in (select auth_user_family_ids())
    )
  );
