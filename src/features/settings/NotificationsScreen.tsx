import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type { UserPreferences, UserPreferencesUpsert } from '../../types/database'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { ErrorScreen } from '../../components/ui/ErrorScreen'
import { useAuth } from '../auth/useAuth'
import { SettingsHeader } from './SettingsHeader'
import { useUpsertUserPreferences, useUserPreferences } from './useUserPreferences'

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

/**
 * Builds the full upsert row from the stored preferences (or the DB-matching
 * defaults when no row exists yet), keyed to the current user. Sending the whole
 * row means a notification toggle never clobbers a preference owned by another
 * settings screen (display name / language / theme / units).
 */
function toUpsertRow(userId: string, stored: UserPreferences | null): UserPreferencesUpsert {
  return {
    user_id: userId,
    display_name: stored?.display_name ?? null,
    language: stored?.language ?? 'he',
    theme: stored?.theme ?? 'system',
    units: stored?.units ?? 'ml',
    notif_feeding: stored?.notif_feeding ?? false,
    notif_sleep: stored?.notif_sleep ?? false,
    notif_daily_summary: stored?.notif_daily_summary ?? false,
  }
}

/**
 * The Notifications sub-screen (spec section 3.4): three per-user reminder
 * toggles persisted to `user_preferences`. MVP is preferences-only - no push is
 * delivered yet.
 */
export function NotificationsScreen() {
  const { user } = useAuth()
  const userId = user?.id

  const preferencesQuery = useUserPreferences(userId)
  const saveMutation = useUpsertUserPreferences()

  if (preferencesQuery.isPending) return <LoadingScreen />
  if (preferencesQuery.isError) {
    return <ErrorScreen onRetry={() => void preferencesQuery.refetch()} />
  }

  const preferences = toUpsertRow(userId ?? '', preferencesQuery.data)

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
