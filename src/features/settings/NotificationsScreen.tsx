import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type { UserPreferences, UserPreferencesUpsert } from '../../types/database'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { ErrorScreen } from '../../components/ui/ErrorScreen'
import { SettingsHeader } from './SettingsHeader'

/**
 * The three notification toggles are stored per-user in `user_preferences` but
 * NOT yet acted on: push delivery, permission prompts and service-worker wiring
 * are deliberately deferred (see CLAUDE.md). A future delivery layer will read
 * these flags to decide which reminders to send; today they are preferences only.
 */
type NotificationKey = 'notif_feeding' | 'notif_sleep' | 'notif_daily_summary'

interface NotificationToggle {
  key: NotificationKey
  label: string
  description: string
}

const notificationToggles: readonly NotificationToggle[] = [
  {
    key: 'notif_feeding',
    label: 'תזכורות האכלה',
    description: 'תזכורת כשמתקרב הזמן להאכלה הבאה',
  },
  {
    key: 'notif_sleep',
    label: 'תזכורות שינה',
    description: 'תזכורת כשמתקרב חלון השינה הבא',
  },
  {
    key: 'notif_daily_summary',
    label: 'סיכום יומי',
    description: 'סיכום קצר של היום בסוף כל יום',
  },
]

/** Preference defaults used until the user's own row exists in the database. */
const defaultPreferences: UserPreferencesUpsert = {
  user_id: '',
  display_name: null,
  language: 'he',
  theme: 'system',
  notif_feeding: false,
  notif_sleep: false,
  notif_daily_summary: false,
}

const userPreferencesKey = ['user-preferences'] as const

/** Resolves the signed-in user's id, or throws if there is no session. */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error

  const userId = data.user?.id
  if (!userId) {
    throw new Error('Cannot read notification preferences without an authenticated user')
  }
  return userId
}

/**
 * Reads the current user's preferences row. A missing row is not an error - the
 * row is created lazily on the first toggle - so it resolves to sensible
 * defaults keyed to the current user.
 */
async function fetchUserPreferences(): Promise<UserPreferencesUpsert> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<UserPreferences>()

  if (error) throw error
  if (!data) return { ...defaultPreferences, user_id: userId }

  return {
    user_id: data.user_id,
    display_name: data.display_name,
    language: data.language,
    theme: data.theme,
    notif_feeding: data.notif_feeding,
    notif_sleep: data.notif_sleep,
    notif_daily_summary: data.notif_daily_summary,
  }
}

/**
 * Persists the full preferences row via upsert keyed by `user_id`, so it creates
 * the row on the first change and updates it thereafter. The other (display /
 * language) fields are carried through untouched so a notification toggle never
 * clobbers a preference owned by another settings screen.
 */
async function saveUserPreferences(next: UserPreferencesUpsert): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(next, { onConflict: 'user_id' })

  if (error) throw error
}

/**
 * The Notifications sub-screen (spec section 3.4): three per-user reminder
 * toggles persisted to `user_preferences`. MVP is preferences-only - no push is
 * delivered yet.
 */
export function NotificationsScreen() {
  const queryClient = useQueryClient()

  const preferencesQuery = useQuery({
    queryKey: userPreferencesKey,
    queryFn: fetchUserPreferences,
  })

  const saveMutation = useMutation<void, unknown, UserPreferencesUpsert>({
    mutationFn: saveUserPreferences,
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(userPreferencesKey, variables)
    },
  })

  if (preferencesQuery.isPending) return <LoadingScreen />
  if (preferencesQuery.isError) {
    return <ErrorScreen onRetry={() => void preferencesQuery.refetch()} />
  }

  const preferences = preferencesQuery.data

  const handleToggle = (key: NotificationKey) => {
    saveMutation.mutate({ ...preferences, [key]: !preferences[key] })
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="התראות" backTo="/settings" />

        {saveMutation.isError && (
          <div className="mt-6">
            <Banner message={toFriendlyDbErrorMessage(saveMutation.error)} variant="error" />
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <ul>
            {notificationToggles.map((toggle, index) => {
              const isOn = preferences[toggle.key]
              return (
                <li key={toggle.key}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    onClick={() => handleToggle(toggle.key)}
                    disabled={saveMutation.isPending}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:opacity-60 ${
                      index > 0 ? 'border-t border-neutral-100' : ''
                    }`}
                  >
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-neutral-900">
                        {toggle.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {toggle.description}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors duration-fast ${
                        isOn ? 'justify-end bg-brand-500' : 'justify-start bg-neutral-300'
                      }`}
                    >
                      <span className="inline-block h-5 w-5 rounded-full bg-neutral-0 shadow-sm" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="mt-4 px-1 text-xs text-neutral-500">
          התזכורות עדיין לא נשלחות - ההעדפות נשמרות ויופעלו כשמנגנון ההתראות יתווסף.
        </p>
      </div>
    </div>
  )
}
