import type { Estimate } from './estimates'
import { useEstimates } from './useEstimates'

/**
 * The two estimate cards below the clock ("next feeding" / "next sleep"). Data
 * comes from the `estimates` Edge Function via `useEstimates`; the prediction
 * itself is computed server-side (contract §2), the frontend only renders the
 * four UI states (contract §3): Loading, Unavailable, Ready.
 */

interface EstimateCardConfig {
  key: 'feeding' | 'sleep'
  label: string
  emoji: string
  iconSurface: string
}

const CARDS: readonly EstimateCardConfig[] = [
  { key: 'feeding', label: 'צפי האכלה הבאה', emoji: '🍼', iconSurface: 'bg-feeding-50' },
  { key: 'sleep', label: 'צפי שינה הבאה', emoji: '🌙', iconSurface: 'bg-sleep-50' },
]

/** Copy for the `basis` bucket — same instant, different reason for the estimate. */
const BASIS_TEXT: Record<'personal' | 'age_norm', string> = {
  personal: 'לפי הקצב של התינוק',
  age_norm: 'לפי המקובל בגיל הזה',
}

/**
 * Honest positive placeholder (error-handling-spec tone) shown both when the
 * server has too little data and when the fetch errors — never a red error.
 */
const UNAVAILABLE_TEXT = 'עוד אין מספיק נתונים'
const LOADING_TEXT = 'מחשב…'

/** Wall-clock time in the device timezone (contract §3), e.g. "בסביבות 15:30". */
const timeFormatter = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' })

interface EstimateLines {
  primary: string
  secondary?: string
}

/** Maps query state + the contract estimate to the card's two text lines. */
function describeEstimate(
  estimate: Estimate | undefined,
  isLoading: boolean,
  isError: boolean,
): EstimateLines {
  if (isLoading) return { primary: LOADING_TEXT }
  if (isError || !estimate || estimate.status === 'not_enough_data') {
    return { primary: UNAVAILABLE_TEXT }
  }
  return {
    primary: `בסביבות ${timeFormatter.format(new Date(estimate.predicted_at))}`,
    secondary: BASIS_TEXT[estimate.basis],
  }
}

interface EstimateBannersProps {
  childId: string
  /** The child's day boundary, so estimates re-scope with the Today clock. */
  dayStart: string
}

/** Two thin information cards below the clock. Not interactive - info only. */
export function EstimateBanners({ childId, dayStart }: EstimateBannersProps) {
  const { data, isLoading, isError } = useEstimates(childId, dayStart)

  return (
    <div className="grid grid-cols-2 gap-3">
      {CARDS.map((card) => {
        const lines = describeEstimate(data?.[card.key], isLoading, isError)

        return (
          <div
            key={card.key}
            className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2.5 shadow-sm"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${card.iconSurface}`}
              aria-hidden="true"
            >
              {card.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-neutral-800">{card.label}</p>
              <p className="truncate text-xs text-neutral-500">{lines.primary}</p>
              {lines.secondary && (
                <p className="truncate text-xs text-neutral-400">{lines.secondary}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
