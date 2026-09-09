-- ============================================================
-- Harden the family-invite / membership security boundary.
--
-- This closes four overlapping holes in the invite → join flow. RLS is
-- this project's ONLY access-control layer, so each of these is a real
-- authorization bug, not a theoretical one:
--
--   S1 (critical) — the "users can insert their own membership" INSERT
--     policy on family_members was `with check (user_id = auth.uid())`
--     only (initial scaffold). It was never tied to a valid invite, so
--     ANY authenticated user could insert a membership row into ANY
--     family_id and gain full read/write on that family's children and
--     events. Membership must only ever be created against a real family
--     (create_family) or a real, valid invite (join_family_by_token).
--
--   S2 (critical) — the "anyone can read a single invite by token" SELECT
--     policy was `using (true)` plus `grant select ... to anon`. The
--     inline comment assumed "the app always filters by token so it's
--     safe" — but a client-side filter is not enforcement. Any anon
--     caller could list EVERY invite: every token, family_id, and
--     inviter/used_by id. (It also violates the project rule against
--     `using (true)`.) Pre-signup validation is replaced by
--     get_invite_by_token, which returns a single, non-sensitive row.
--
--   S3 (high) — the direct claim UPDATE policy
--     (`using (used_at is null and expires_at > now())`) let any
--     authenticated user burn ANY unused invite (griefing / DoS), because
--     the USING clause was not bound to a specific token and — via S2 —
--     every invite id was enumerable. Claiming is now done exclusively
--     inside join_family_by_token, under a row lock, in one transaction.
--
--   S4 (high) — joinFamilyByToken (client) claimed the invite and then
--     separately inserted the membership. If the insert failed after the
--     claim, the invite was permanently burned and the parent locked out.
--     create_family was already made an atomic SECURITY DEFINER RPC for
--     exactly this reason; join now gets the same treatment.
--
-- After this migration, family_members rows are created ONLY by the two
-- SECURITY DEFINER RPCs (create_family, join_family_by_token). Both run
-- with the definer's rights and bypass RLS for their own inserts, so no
-- client-facing INSERT policy on family_members is needed or wanted.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove the insecure, over-broad policies (S1, S2, S3)
-- ------------------------------------------------------------

-- S1: drop the open self-insert membership policy.
drop policy if exists "users can insert their own membership" on family_members;

-- S2: drop the `using (true)` read-any-invite policy.
drop policy if exists "anyone can read a single invite by token" on family_invites;

-- S3: drop the direct client-facing claim UPDATE policy (folded into the RPC).
drop policy if exists "authenticated users can claim an unused invite" on family_invites;

-- S2: remove the anon table grant that backed the open read. anon now
-- reaches invites ONLY through get_invite_by_token (execute granted below).
revoke select on family_invites from anon;

-- Defense in depth: authenticated no longer has any direct UPDATE path on
-- invites (claiming is RPC-only). Revoke the unused UPDATE grant so the
-- table cannot be written to outside the RPC. SELECT + INSERT remain, used
-- by the member-scoped policies (list / create your own family's invites).
revoke update on family_invites from authenticated;

-- The member-scoped policies are intentionally kept:
--   "members can view their family's invites"   (SELECT)
--   "members can create invites for their family" (INSERT)
-- A family member still lists and creates invites for their own family.

-- ------------------------------------------------------------
-- 2. get_invite_by_token — safe pre-signup validation
--
-- Returns ONLY the single matching invite's non-sensitive fields (the
-- target family's id + name, and whether the invite is currently valid).
-- It never returns the token, inviter, or used_by, and never a list. Being
-- SECURITY DEFINER with a pinned search_path, it can look up the invite
-- without a table SELECT grant; EXECUTE is granted to anon so an invited
-- parent can validate a link before creating an account.
--
-- NOTE: this RPC is the safe replacement for the dropped `using (true)`
-- policy and backs the "validate a single invite by token before signup"
-- capability that CLAUDE.md documents. That pre-signup validation screen is
-- not built yet, so the RPC currently has no caller in src/ — it is retained
-- deliberately (not dead code); wiring it up is tracked separately.
-- ------------------------------------------------------------

create or replace function get_invite_by_token(p_token text)
  returns table (
    family_id   uuid,
    family_name text,
    is_valid    boolean
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    fi.family_id,
    f.name as family_name,
    (fi.used_at is null and fi.expires_at > now()) as is_valid
  from family_invites fi
    join families f on f.id = fi.family_id
  where fi.token = p_token;
$$;

revoke all on function get_invite_by_token(text) from public;
grant execute on function get_invite_by_token(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. join_family_by_token — atomic, validated join (S3 + S4)
--
-- In ONE transaction: row-lock the invite, re-validate it server-side
-- (unused AND unexpired), enforce the MVP "one family per user" rule, mark
-- it used, and insert the caller's membership. Either the whole join
-- happens or none of it does — an invite is never burned without the
-- membership being created. Typed errors map 1:1 to the client's
-- JoinFamilyErrorCode set; the check order matches the previous client
-- precedence (invalid → used → expired → already-in-family).
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

-- ------------------------------------------------------------
-- 4. Realtime: drop family_invites from the publication.
--
-- Invites are now read only through get_invite_by_token (a function call,
-- which realtime cannot stream) or the member-scoped list policy. No client
-- subscribes to invite changes, and keeping a table published only widens
-- the surface, so remove it. `events`, `children`, `families` and
-- `family_members` remain published for live parent-to-parent sync.
-- ------------------------------------------------------------

alter publication supabase_realtime drop table family_invites;
