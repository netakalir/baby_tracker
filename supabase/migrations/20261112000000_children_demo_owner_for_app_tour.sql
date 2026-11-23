-- ============================================================
-- Practice ("demo") children for the interactive app tour.
--
-- The tour has the user log REAL events (diaper / sleep / mood) against
-- a temporary practice child that lives in the same tables as real data
-- ("flagged demo data in the same DB"). The child is deleted when the
-- tour ends, and its events go with it through the existing
-- events.child_id ... on delete cascade.
--
-- The flag is `children.demo_owner_id`:
--   null      -> a real child, shared by every member of the family
--                (all existing rows; nothing is backfilled)
--   non-null  -> a practice child, PRIVATE to that one user
--
-- Why "private to the owner" and not just "visible to the family": the
-- children and events tables are both in the supabase_realtime
-- publication, so without an RLS change the OTHER parent would see a
-- stranger child appear in their child selector, and watch tour events
-- land on their clock live, while their partner is doing the tour.
--
-- FK rule — ON DELETE CASCADE, deliberately NOT the SET NULL rule that
-- 20260806000001_relax_auth_user_fks_for_account_deletion.sql chose for
-- events.created_by / family_invites.*: those columns are AUTHOR links on
-- SHARED data, which must survive the author leaving. demo_owner_id is
-- an OWNERSHIP link on PRIVATE data — the same category as
-- family_members.user_id and user_preferences.user_id, which that
-- migration explicitly left on CASCADE. SET NULL here would actively be
-- a bug: deleting the account would turn a leftover practice child into
-- a "real" child and suddenly reveal it (and its events) to the
-- remaining parent.
--
-- Gotchas this migration closes:
--   1. events policies reach `children` through a plain subquery that is
--      itself subject to the children SELECT policy, so they would
--      inherit the owner-only rule implicitly. That is fragile — if the
--      subquery is ever moved into a SECURITY DEFINER helper (as was done
--      for family_members), RLS on children stops applying and practice
--      events leak. The events policies therefore state the owner rule
--      explicitly instead of relying on policy composition.
--   2. RLS WITH CHECK only sees the NEW row, so it cannot express "this
--      column must not change". WITH CHECK alone would still let a parent
--      flip a REAL child into their own practice child — silently hiding
--      it (and its whole history) from the other parent. A BEFORE UPDATE
--      trigger makes demo_owner_id immutable after insert: a child is born
--      either real or practice and stays that way.
--
-- No grant / RLS-enable / realtime change: both tables already have all
-- three (initial schema). Realtime postgres_changes INSERT/UPDATE payloads
-- are filtered by these same SELECT policies, so the other parent does
-- not receive practice rows.
--
-- Idempotent: add column / index if not exists, create or replace the
-- trigger function, drop-if-exists before every trigger and policy.
-- ============================================================

-- ------------------------------------------------------------
-- Column
-- ------------------------------------------------------------

alter table children
  add column if not exists demo_owner_id uuid references auth.users(id) on delete cascade;

-- Partial index: practice children are rare and short-lived, so index only
-- them. Serves the tour's leftover sweep
--   delete from children where demo_owner_id = auth.uid()
-- and the ON DELETE CASCADE lookup when an auth user is deleted (an
-- unindexed FK would force a full scan of children per deleted user).
create index if not exists children_demo_owner_id_idx
  on children (demo_owner_id)
  where demo_owner_id is not null;

-- ------------------------------------------------------------
-- Immutability of demo_owner_id
-- ------------------------------------------------------------

create or replace function prevent_children_demo_owner_change()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if new.demo_owner_id is distinct from old.demo_owner_id then
    raise exception 'demo_owner_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists children_demo_owner_immutable on children;
create trigger children_demo_owner_immutable
  before update of demo_owner_id on children
  for each row
  execute function prevent_children_demo_owner_change();

-- ------------------------------------------------------------
-- children — family member AND (real child OR my practice child)
--
-- `(select auth.uid())` rather than bare auth.uid(): the sub-select is
-- evaluated once per statement instead of once per row.
-- ------------------------------------------------------------

drop policy if exists "members can view their family's children" on children;
create policy "members can view their family's children"
  on children for select
  using (
    family_id in (select auth_user_family_ids())
    and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
  );

-- Nobody can create a practice child owned by someone else.
drop policy if exists "members can insert children for their family" on children;
create policy "members can insert children for their family"
  on children for insert
  with check (
    family_id in (select auth_user_family_ids())
    and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
  );

-- WITH CHECK repeats the owner rule as defense in depth; the trigger above
-- is what actually forbids changing demo_owner_id (see gotcha 2).
drop policy if exists "members can update their family's children" on children;
create policy "members can update their family's children"
  on children for update
  using (
    family_id in (select auth_user_family_ids())
    and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
  )
  with check (
    family_id in (select auth_user_family_ids())
    and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
  );

drop policy if exists "members can delete their family's children" on children;
create policy "members can delete their family's children"
  on children for delete
  using (
    family_id in (select auth_user_family_ids())
    and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
  );

-- ------------------------------------------------------------
-- events — child_id -> children (family member AND visible to me)
--
-- The owner rule is stated explicitly in the subquery (see gotcha 1).
-- ------------------------------------------------------------

drop policy if exists "members can view their family's events" on events;
create policy "members can view their family's events"
  on events for select
  using (
    child_id in (
      select id from children
      where family_id in (select auth_user_family_ids())
        and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
    )
  );

drop policy if exists "members can insert events for their family" on events;
create policy "members can insert events for their family"
  on events for insert
  with check (
    child_id in (
      select id from children
      where family_id in (select auth_user_family_ids())
        and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
    )
  );

drop policy if exists "members can update their family's events" on events;
create policy "members can update their family's events"
  on events for update
  using (
    child_id in (
      select id from children
      where family_id in (select auth_user_family_ids())
        and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
    )
  )
  with check (
    child_id in (
      select id from children
      where family_id in (select auth_user_family_ids())
        and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
    )
  );

drop policy if exists "members can delete their family's events" on events;
create policy "members can delete their family's events"
  on events for delete
  using (
    child_id in (
      select id from children
      where family_id in (select auth_user_family_ids())
        and (demo_owner_id is null or demo_owner_id = (select auth.uid()))
    )
  );
