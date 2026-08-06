import { supabase } from '../../lib/supabase'
import type {
  Child,
  FamilyInvite,
  FamilyMemberIdentity,
  UserPreferences,
  UserPreferencesUpsert,
} from '../../types/database'

/**
 * Data layer for the Settings feature. Every Supabase call the four settings
 * sub-screens make lives here (mirroring `features/today/api.ts`), so the screen
 * components stay presentational and the React Query hooks in the sibling
 * `use*.ts` files wrap these pure functions. Each function follows the project's
 * error pattern: check the Supabase `error` explicitly and throw it, never
 * return partial data on failure.
 */

/** Resolves the signed-in user's id, or throws if there is no session. */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error

  const userId = data.user?.id
  if (!userId) {
    throw new Error('Cannot read settings without an authenticated user')
  }
  return userId
}

// --- user preferences (per-user) -----------------------------------------

/**
 * Reads the signed-in user's `user_preferences` row. The row is created lazily
 * on first save, so a missing row resolves to `null` (not an error).
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<UserPreferences>()

  if (error) throw error
  return data
}

/**
 * Upserts the full preferences row (keyed by `user_id`), creating it on the
 * first save and updating it thereafter. Callers pass the complete row so
 * changing one field never clears the others.
 */
export async function upsertUserPreferences(
  row: UserPreferencesUpsert,
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single<UserPreferences>()

  if (error) throw error
  return data
}

/**
 * Persists only the display name via a partial upsert keyed by `user_id`.
 * Sending just `user_id` + `display_name` leaves the other preference columns
 * untouched (DB defaults on first insert, unchanged on later updates), so this
 * never clobbers language/theme/notification settings.
 */
export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<UserPreferences> {
  const trimmed = displayName.trim()
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, display_name: trimmed === '' ? null : trimmed },
      { onConflict: 'user_id' },
    )
    .select()
    .single<UserPreferences>()

  if (error) throw error
  return data
}

// --- baby & family -------------------------------------------------------

/**
 * Updates the child's name and birth date (per-child, spec §3.2). RLS restricts
 * the update to children in the caller's family.
 */
export async function updateBabyDetails(
  childId: string,
  input: { name: string; birthDate: string },
): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .update({ name: input.name, birth_date: input.birthDate })
    .eq('id', childId)
    .select()
    .single<Child>()

  if (error) throw error
  return data
}

/**
 * Fetches the family's members with their real identity (display name + email)
 * via the `family_members_with_identity` RPC. Plain RLS on `family_members`
 * exposes only `user_id` + `role`; the SECURITY DEFINER RPC additionally joins
 * `auth.users` and `user_preferences` for the other parent, while still gating
 * on the caller's own family membership (see the RPC migration).
 */
export async function fetchFamilyMembers(
  familyId: string,
): Promise<FamilyMemberIdentity[]> {
  const { data, error } = await supabase.rpc('family_members_with_identity', {
    p_family_id: familyId,
  })

  if (error) throw error
  return (data ?? []) as FamilyMemberIdentity[]
}

/** Days an invite link stays valid. Matches the onboarding invite lifetime. */
export const INVITE_VALIDITY_DAYS = 7

/**
 * Creates a single-use family invite (per-family, spec §3.2), reusing the
 * onboarding invite mechanism: the `token` column defaults to a DB-generated
 * uuid and the resulting link is consumed by the existing `/join?token=` screen.
 */
export async function createFamilyInvite(
  familyId: string,
  invitedBy: string,
): Promise<FamilyInvite> {
  const expiresAt = new Date(
    Date.now() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data, error } = await supabase
    .from('family_invites')
    .insert({ family_id: familyId, invited_by: invitedBy, expires_at: expiresAt })
    .select()
    .single<FamilyInvite>()

  if (error) throw error
  return data
}

// --- account deletion ("leave only", spec §6) ----------------------------

/**
 * Deletes the signed-in user's account (spec §6, "leave only"). The `delete-user`
 * Edge Function hard-deletes the auth user with the service role; the FK cascade
 * from `auth.users` then removes the user's `family_members` membership and their
 * private `user_preferences` row, while the shared family / child / events survive
 * (their `created_by`/`invited_by` links are relaxed to `SET NULL`). The client
 * never holds the service role, so the deletion must run in the Edge Function.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-user', { method: 'POST' })
  if (error) throw error
}
