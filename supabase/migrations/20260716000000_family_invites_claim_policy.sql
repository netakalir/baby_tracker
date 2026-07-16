-- ============================================================
-- Fix: a second parent could never join a family via an invite.
--
-- Claiming an invite marks it used (UPDATE family_invites SET used_at,
-- used_by ...). But family_invites had no UPDATE policy, and with RLS
-- enabled an UPDATE with no permissive policy matches zero rows. The
-- join code (joinFamilyByToken) treats "zero rows updated" as "invite
-- already used", so every join attempt failed with the message
-- "ההזמנה הזו כבר נוצלה" - the core family-sharing flow was broken.
--
-- The person claiming the invite is not yet a member of the family, so
-- a member-scoped policy cannot apply to them. Allow any authenticated
-- user to claim an invite that is still unused (used_at is null), and
-- require that they mark it used by themselves (used_by = auth.uid()).
-- The app additionally guards the update with `.is('used_at', null)` for
-- optimistic concurrency, so two people racing on the same token cannot
-- both join. Reading the invite by token is already permitted by the
-- existing "anyone can read a single invite by token" select policy.
-- ============================================================

drop policy if exists "authenticated users can claim an unused invite" on family_invites;

create policy "authenticated users can claim an unused invite"
  on family_invites for update
  to authenticated
  using (used_at is null)
  with check (used_by = auth.uid());
