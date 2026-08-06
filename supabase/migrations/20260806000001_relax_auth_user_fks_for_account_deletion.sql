-- ============================================================
-- Relax the auth.users foreign keys so account deletion is
-- "leave only" (settings spec §6): deleting a parent's auth user
-- must NOT delete the shared family / child / events, and must NOT
-- be blocked by rows that merely REFERENCE that user.
--
-- Today three FKs point at auth.users with the default NO ACTION
-- (restrict) rule, so a hard `auth.admin.deleteUser` would fail as
-- soon as the user had logged any event or created any invite:
--   - events.created_by            (NOT NULL)
--   - family_invites.invited_by    (NOT NULL)
--   - family_invites.used_by       (nullable)
-- family_members.user_id and user_preferences.user_id already
-- CASCADE, which is what we want (the membership + private prefs go
-- away with the account); those are left unchanged.
--
-- Fix: switch these three to ON DELETE SET NULL and make the two
-- NOT NULL columns nullable, so the shared rows SURVIVE the author's
-- deletion — they simply lose the author link (created_by / invited_by
-- become null). This matches "leave only": the data stays for the
-- remaining parent.
--
-- Idempotent: drop the constraint if present, relax nullability,
-- re-add the constraint with the SET NULL rule.
-- ============================================================

-- events.created_by ------------------------------------------------
alter table events alter column created_by drop not null;

alter table events drop constraint if exists events_created_by_fkey;
alter table events
  add constraint events_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- family_invites.invited_by ---------------------------------------
alter table family_invites alter column invited_by drop not null;

alter table family_invites drop constraint if exists family_invites_invited_by_fkey;
alter table family_invites
  add constraint family_invites_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;

-- family_invites.used_by (already nullable) -----------------------
alter table family_invites drop constraint if exists family_invites_used_by_fkey;
alter table family_invites
  add constraint family_invites_used_by_fkey
  foreign key (used_by) references auth.users(id) on delete set null;
