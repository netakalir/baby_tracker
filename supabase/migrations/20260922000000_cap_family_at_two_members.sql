-- ------------------------------------------------------------
-- Cap a family at two members (the MVP "two parents" product rule).
--
-- Hiding the invite button in the UI once a family has two members is a
-- convenience only, not enforcement: an invite link generated while the
-- family still had one member stays single-use and valid for
-- INVITE_VALIDITY_DAYS, so without a server-side cap a third user could
-- still consume it and gain full parent-level access to the family's
-- children and events.
--
-- This adds that cap inside the existing atomic join_family_by_token
-- transaction (see 20260903000000_harden_invite_and_membership_flow.sql).
-- The new check runs after "already in a family" and before the invite is
-- marked used / the membership is inserted, so a rejected join burns
-- nothing. The typed error `family_full` maps 1:1 to a new client code.
--
-- The function is otherwise unchanged; it is recreated in full because
-- Postgres has no way to patch a function body in place.
-- ------------------------------------------------------------

create or replace function join_family_by_token(p_token text)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_invite family_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Row-lock the invite so two people racing on the same token cannot both
  -- claim it: the second waits here, then sees used_at set below.
  select * into v_invite
  from family_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  if v_invite.used_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  -- MVP: a user belongs to exactly one family.
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'already_in_family' using errcode = 'P0001';
  end if;

  -- MVP: a family holds at most two parents. The invite row is already locked
  -- above, and two racing joiners for the same family would each hold a lock
  -- on their own distinct invite row, so serialize on the family itself: lock
  -- the existing members before counting, so a concurrent join blocks here and
  -- re-counts once the first has committed rather than both reading "1".
  perform 1 from family_members where family_id = v_invite.family_id for update;
  if (select count(*) from family_members where family_id = v_invite.family_id) >= 2 then
    raise exception 'family_full' using errcode = 'P0001';
  end if;

  update family_invites
    set used_at = now(),
        used_by = auth.uid()
    where id = v_invite.id;

  insert into family_members (family_id, user_id, role)
    values (v_invite.family_id, auth.uid(), 'parent');

  return v_invite.family_id;
end;
$$;

revoke all on function join_family_by_token(text) from public;
grant execute on function join_family_by_token(text) to authenticated;
