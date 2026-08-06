-- ============================================================
-- RPC: family_members_with_identity(p_family_id)
--
-- Settings → "Baby & family" needs to show the OTHER parent's real
-- name + email. Plain RLS on `family_members` only exposes
-- `user_id` + `role`; the identifying columns live in two places a
-- normal member cannot read for anyone but themselves:
--   - the email in `auth.users` (not exposed to the API role), and
--   - the display name in another user's `user_preferences` row
--     (that table's RLS is own-row-only: user_id = auth.uid()).
--
-- So this is exposed through a single SECURITY DEFINER function that
-- returns the joined identity for the members of a family the caller
-- actually belongs to. The access boundary is preserved by gating on
-- `auth_user_family_ids()` (the same helper every family-scoped
-- policy uses): if the caller is not a member of `p_family_id`, the
-- function returns zero rows — it never leaks another family's
-- members, names, or emails.
--
-- SECURITY DEFINER + a pinned `search_path` is the established
-- pattern in this project (see auth_user_family_ids in
-- 20260712000000). EXECUTE is granted only to `authenticated`, and
-- revoked from PUBLIC, so anon cannot call it.
-- ============================================================

create or replace function family_members_with_identity(p_family_id uuid)
  returns table (
    id           uuid,
    user_id      uuid,
    role         text,
    display_name text,
    email        text
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    fm.id,
    fm.user_id,
    fm.role,
    up.display_name,
    u.email::text
  from family_members fm
    join auth.users u on u.id = fm.user_id
    left join user_preferences up on up.user_id = fm.user_id
  where fm.family_id = p_family_id
    -- Gate: only members of this family (i.e. the caller) get any rows.
    and p_family_id in (select auth_user_family_ids())
  order by fm.id;
$$;

revoke all on function family_members_with_identity(uuid) from public;
grant execute on function family_members_with_identity(uuid) to authenticated;
