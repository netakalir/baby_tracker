-- ============================================================
-- Harden the invite-claim policy: also enforce expiry at the DB level.
--
-- The previous policy (20260716000000) let an authenticated user claim
-- any invite that was still unused (used_at is null). But expiry
-- (expires_at) was only ever checked in client-side JavaScript
-- (joinFamilyByToken). Since RLS is this project's only real security
-- boundary, a crafted API request could bypass the client check and
-- claim an EXPIRED-but-unused invite, then join the family.
--
-- Add `expires_at > now()` to the USING clause so the database itself
-- refuses to let an expired invite be claimed, regardless of the client.
-- ============================================================

drop policy if exists "authenticated users can claim an unused invite" on family_invites;

create policy "authenticated users can claim an unused invite"
  on family_invites for update
  to authenticated
  using (used_at is null and expires_at > now())
  with check (used_by = auth.uid());
