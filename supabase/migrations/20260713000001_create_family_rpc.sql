-- ============================================================
-- Atomic family creation.
--
-- Problem: the client created a family with
--   insert into families ... returning *
-- then inserted the membership separately. Two issues:
--   1. The RETURNING read is subject to the families SELECT policy,
--      which only lets members read their family - but the creator
--      is not a member yet, so the read-back was rejected (42501)
--      even though the insert itself was allowed.
--   2. If the membership insert failed after the family insert, the
--      family was left orphaned (no members, unreachable by anyone).
--
-- Fix: a single SECURITY DEFINER function that inserts the family and
-- the creator's membership in one transaction and returns the new id.
-- SECURITY DEFINER lets it return the id without tripping the SELECT
-- policy; the membership is created for auth.uid() only, so the access
-- boundary is unchanged (the caller can only ever make themselves a
-- parent of a family they just created).
-- ============================================================

create or replace function create_family(family_name text)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into families (name)
    values (family_name)
    returning id into new_family_id;

  insert into family_members (family_id, user_id, role)
    values (new_family_id, auth.uid(), 'parent');

  return new_family_id;
end;
$$;

revoke all on function create_family(text) from public;
grant execute on function create_family(text) to authenticated;

-- Clean up any orphan families (no members) left behind by the old
-- broken flow / manual testing. A family with no members is
-- unreachable through RLS, so this only removes dead rows.
delete from families f
where not exists (
  select 1 from family_members m where m.family_id = f.id
);
