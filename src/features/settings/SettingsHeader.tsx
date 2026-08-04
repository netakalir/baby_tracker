import { useNavigate } from 'react-router-dom'

interface SettingsHeaderProps {
  title: string
  /** Where the back arrow returns to. Defaults to the previous screen. */
  backTo?: string
}

/**
 * Shared top bar for the Settings hub and its sub-screens: a back arrow on the
 * start side (RTL: points to the end, i.e. "forward" in Hebrew reading order)
 * and the screen title. Keeps every settings page on one consistent header
 * rhythm, matching the rest of the app.
 */
export function SettingsHeader({ title, backTo }: SettingsHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        aria-label="חזרה"
        className="-ms-2 flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {/* RTL: the "back" chevron points to the start (right) edge. */}
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
          <path
            d="m15 6-6 6 6 6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
    </header>
  )
}
