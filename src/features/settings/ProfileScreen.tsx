import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Banner } from '../../components/ui/Banner'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { supabase } from '../../lib/supabase'
import type { UserPreferences } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { useSignOut } from '../auth/useSignOut'
import { SettingsHeader } from './SettingsHeader'

/**
 * The query key for the signed-in user's private preferences row. Keyed by
 * user id so a different account never reads another user's cached settings.
 */
function userPreferencesKey(userId: string): [string, string] {
  return ['user-preferences', userId]
}

/**
 * Reads the signed-in user's `user_preferences` row. The row may not exist yet
 * (it is created lazily on first save), so a missing row resolves to `null`
 * rather than an error.
 */
async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<UserPreferences>()

  if (error) throw error
  return data
}

/**
 * Persists only the display name for the current user via upsert keyed by
 * user_id. Sending just `user_id` + `display_name` leaves the other preference
 * columns untouched (DB defaults on first insert, unchanged on later updates),
 * so this never clobbers language/theme/notification settings.
 */
async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim()
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, display_name: trimmed === '' ? null : trimmed }, { onConflict: 'user_id' })

  if (error) throw error
}

/**
 * "Leave only" account deletion (spec §6): removes the user's family membership
 * and their private preferences row, but never the shared family / child /
 * events. A true auth-user delete needs the service role, so it is left to a
 * future Edge Function; here we detach + sign out.
 */
async function leaveAndDeleteAccount(userId: string): Promise<void> {
  const { error: membershipError } = await supabase
    .from('family_members')
    .delete()
    .eq('user_id', userId)
  if (membershipError) throw membershipError

  const { error: preferencesError } = await supabase
    .from('user_preferences')
    .delete()
    .eq('user_id', userId)
  if (preferencesError) throw preferencesError

  // TODO(settings): deleting the auth.users row itself requires the service role
  // and cannot run safely from the client. Add a Supabase Edge Function to
  // complete the hard delete; for now we detach the user and sign them out.
}

/**
 * "Profile & account" settings sub-screen (spec §3.1 and §6). Shows the editable
 * per-user display name, the read-only auth email, and the two destructive
 * actions — log out (single confirm) and delete account (double confirm,
 * "leave only" semantics that keep shared data for the other parent).
 */
export function ProfileScreen() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const signOutMutation = useSignOut()

  const preferencesQuery = useQuery({
    queryKey: userPreferencesKey(userId),
    queryFn: () => fetchUserPreferences(userId),
    enabled: userId !== '',
  })

  const [displayName, setDisplayName] = useState('')
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)

  // Seed the editable field once the stored preferences arrive.
  useEffect(() => {
    setDisplayName(preferencesQuery.data?.display_name ?? '')
  }, [preferencesQuery.data])

  const saveNameMutation = useMutation({
    mutationFn: () => updateDisplayName(userId, displayName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userPreferencesKey(userId) })
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => leaveAndDeleteAccount(userId),
    onSuccess: () => {
      queryClient.clear()
      void supabase.auth.signOut()
    },
  })

  const storedName = preferencesQuery.data?.display_name ?? ''
  const isNameDirty = displayName.trim() !== storedName.trim()

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="פרופיל וחשבון" backTo="/settings" />

        <div className="mt-6 space-y-6">
          {preferencesQuery.isError && (
            <Banner variant="error" message={toFriendlyDbErrorMessage(preferencesQuery.error)} />
          )}

          {/* Display name (per-user, editable). */}
          <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
            <Label htmlFor="display-name">שם תצוגה</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="איך לקרוא לך?"
              maxLength={60}
              autoComplete="name"
            />
            <p className="mt-2 text-xs text-neutral-500">השם הזה פרטי לחשבון שלך.</p>

            {saveNameMutation.isError && (
              <div className="mt-3">
                <Banner variant="error" message={toFriendlyDbErrorMessage(saveNameMutation.error)} />
              </div>
            )}

            <button
              type="button"
              onClick={() => saveNameMutation.mutate()}
              disabled={!isNameDirty || saveNameMutation.isPending || userId === ''}
              className="mt-3 flex w-full items-center justify-center rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-neutral-0 transition-colors duration-fast hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              {saveNameMutation.isPending ? 'רגע...' : 'שמירה'}
            </button>
          </section>

          {/* Email (read-only, from the auth user). */}
          <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
            <Label htmlFor="account-email">אימייל</Label>
            <p id="account-email" className="text-sm text-neutral-900" dir="ltr">
              {user?.email ?? '—'}
            </p>
            <p className="mt-2 text-xs text-neutral-500">כתובת האימייל לא ניתנת לעריכה.</p>
          </section>

          {/* Log out (single confirm). */}
          <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
            {confirmingSignOut ? (
              <>
                <p className="text-sm font-medium text-neutral-900">להתנתק מהחשבון?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => signOutMutation.mutate()}
                    disabled={signOutMutation.isPending}
                    className="flex flex-1 items-center justify-center rounded-md border border-neutral-200 bg-neutral-0 px-4 py-2.5 text-sm font-medium text-error-500 transition-colors duration-fast hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {signOutMutation.isPending ? 'רגע...' : 'התנתקות'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingSignOut(false)}
                    className="flex flex-1 items-center justify-center rounded-md border border-neutral-200 bg-neutral-0 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors duration-fast hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    ביטול
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSignOut(true)}
                className="flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-error-500 transition-colors duration-fast hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                התנתקות
              </button>
            )}
          </section>

          {/* Delete account (double confirm, "leave only"). */}
          <section className="rounded-lg border border-error-500 bg-error-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-error-500">מחיקת חשבון</p>
            <p className="mt-1 text-xs text-neutral-700">
              מחיקת החשבון מסירה אותך מהמשפחה בלבד. הנתונים המשותפים — התינוק והרישומים — נשמרים
              עבור ההורה השני.
            </p>

            {deleteAccountMutation.isError && (
              <div className="mt-3">
                <Banner variant="error" message={toFriendlyDbErrorMessage(deleteAccountMutation.error)} />
              </div>
            )}

            {deleteStep === 0 && (
              <button
                type="button"
                onClick={() => setDeleteStep(1)}
                className="mt-3 flex w-full items-center justify-center rounded-md border border-error-500 bg-neutral-0 px-4 py-2.5 text-sm font-medium text-error-500 transition-colors duration-fast hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
              >
                מחיקת חשבון
              </button>
            )}

            {deleteStep === 1 && (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium text-neutral-900">
                  להסיר אותך מהמשפחה ולמחוק את החשבון?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="flex flex-1 items-center justify-center rounded-md border border-error-500 bg-neutral-0 px-4 py-2.5 text-sm font-medium text-error-500 transition-colors duration-fast hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
                  >
                    להמשיך
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="flex flex-1 items-center justify-center rounded-md border border-neutral-200 bg-neutral-0 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors duration-fast hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium text-neutral-900">
                  זו הפעולה האחרונה — לא ניתן לבטל אותה. למחוק את החשבון?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => deleteAccountMutation.mutate()}
                    disabled={deleteAccountMutation.isPending || userId === ''}
                    className="flex flex-1 items-center justify-center rounded-md bg-error-500 px-4 py-2.5 text-sm font-medium text-neutral-0 transition-opacity duration-fast hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleteAccountMutation.isPending ? 'רגע...' : 'מחיקה סופית'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    disabled={deleteAccountMutation.isPending}
                    className="flex flex-1 items-center justify-center rounded-md border border-neutral-200 bg-neutral-0 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors duration-fast hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
