import { useNavigate } from 'react-router-dom'
import { useSignOut } from '../auth/useSignOut'
import { SettingsHeader } from './SettingsHeader'

interface SettingsRow {
  to: string
  icon: string
  label: string
}

/**
 * The four drill-in destinations of the Settings hub. Each navigates to its own
 * route; the actual screens are built in later slices (12d-12g). One consistent
 * color per row is intentionally avoided here - the settings list is neutral, not
 * event-typed.
 */
const settingsRows: readonly SettingsRow[] = [
  { to: '/settings/profile', icon: '👤', label: 'פרופיל וחשבון' },
  { to: '/settings/baby-family', icon: '👶', label: 'תינוק ומשפחה' },
  { to: '/settings/display', icon: '🎨', label: 'תצוגה ושפה' },
  { to: '/settings/notifications', icon: '🔔', label: 'התראות' },
]

/**
 * The Settings hub: an iOS-Settings-style drill-in list reached from the Today
 * header (a pushed screen, not a bottom-nav tab). A back arrow returns to Today,
 * and a "log out" action sits below the list.
 */
export function SettingsScreen() {
  const navigate = useNavigate()
  const signOutMutation = useSignOut()

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="הגדרות" backTo="/today" />

        <nav className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <ul>
            {settingsRows.map((row, index) => (
              <li key={row.to}>
                <button
                  type="button"
                  onClick={() => navigate(row.to)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors duration-fast hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
                    index > 0 ? 'border-t border-neutral-100' : ''
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base"
                    aria-hidden="true"
                  >
                    {row.icon}
                  </span>
                  <span className="flex-1 text-sm font-medium text-neutral-900">{row.label}</span>
                  {/* RTL: the "drill-in" chevron points to the start (left) edge. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4 shrink-0 text-neutral-400 rtl:-scale-x-100"
                    aria-hidden="true"
                  >
                    <path
                      d="m9 6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
          className="mt-6 flex w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-3.5 text-sm font-medium text-error-500 shadow-sm transition-colors duration-fast hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signOutMutation.isPending ? 'רגע...' : 'התנתקות'}
        </button>
      </div>
    </div>
  )
}
