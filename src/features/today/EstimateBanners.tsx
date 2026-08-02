interface EstimateRow {
  label: string
  message: string
  emoji: string
  iconSurface: string
}

/*
 * The two estimate cards below the clock. The actual "next feeding" / "next
 * sleep" calculations (personal average + age norms / wake window) are a later
 * slice, so for now each card shows the honest not-enough-data placeholder from
 * error-handling-spec (a positive "coming soon", never an error).
 */
const ESTIMATE_ROWS: readonly EstimateRow[] = [
  {
    label: 'צפי האכלה הבאה',
    message: 'עוד אין מספיק נתונים',
    emoji: '🍼',
    iconSurface: 'bg-feeding-50',
  },
  {
    label: 'צפי שינה הבאה',
    message: 'עוד אין מספיק נתונים',
    emoji: '🌙',
    iconSurface: 'bg-sleep-50',
  },
]

/** Two thin information cards below the clock. Not interactive - info only. */
export function EstimateBanners() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ESTIMATE_ROWS.map((row) => (
        <div
          key={row.label}
          className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2.5 shadow-sm"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${row.iconSurface}`}
            aria-hidden="true"
          >
            {row.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-neutral-800">{row.label}</p>
            <p className="truncate text-xs text-neutral-500">{row.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
