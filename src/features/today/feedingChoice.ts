import type { BreastSide, FeedingMetadata } from '../../types/database'

/**
 * The quick-pick options shown when starting a feeding: two breast sides and a
 * bottle. Each carries the exact `metadata` written to the feeding event, so the
 * breast/bottle split stays a detail of one "feeding" event (no new EventType).
 */
export interface FeedingChoice {
  id: string
  emoji: string
  label: string
  /** Announced to screen readers and used when remembering the last side. */
  side?: BreastSide
  /**
   * The `metadata` written to the feeding event. Typed as a plain record so it
   * threads through the generic insert path; each literal is still validated
   * against `FeedingMetadata` via `satisfies`.
   */
  metadata: Record<string, unknown>
}

export const FEEDING_CHOICES: readonly FeedingChoice[] = [
  {
    id: 'breast-left',
    emoji: '🤱',
    label: 'הנקה שמאל',
    side: 'left',
    metadata: { feeding_type: 'breast', side: 'left' } satisfies FeedingMetadata,
  },
  {
    id: 'breast-right',
    emoji: '🤱',
    label: 'הנקה ימין',
    side: 'right',
    metadata: { feeding_type: 'breast', side: 'right' } satisfies FeedingMetadata,
  },
  {
    id: 'bottle',
    emoji: '🍼',
    label: 'בקבוק',
    metadata: { feeding_type: 'bottle' } satisfies FeedingMetadata,
  },
]

const LAST_SIDE_KEY = 'baby-tracker:feeding:last-side'

const SIDE_LABELS: Record<BreastSide, string> = { left: 'שמאל', right: 'ימין' }

/**
 * Bottle amount presets in millilitres, offered as a scroll list when a bottle
 * feed is stopped. Covers 10-300 ml in 10 ml steps - the practical range for a
 * baby bottle - so the parent scrolls to the amount instead of typing it.
 */
export const BOTTLE_AMOUNT_OPTIONS_ML: readonly number[] = Array.from(
  { length: 30 },
  (_, index) => (index + 1) * 10,
)

/** Formats a millilitre amount as a short Hebrew label, e.g. "120 מ״ל". */
export function formatMilliliters(amount: number): string {
  return `${amount} מ״ל`
}

/** Human-readable Hebrew label for a breast side (for the "last side" hint). */
export function breastSideLabel(side: BreastSide): string {
  return SIDE_LABELS[side]
}

/**
 * A short Hebrew detail for a feeding event's metadata - e.g. "הנקה · ימין" or
 * "בקבוק" - or null when the metadata predates the breast/bottle split. Used to
 * enrich the feeding event's label without turning it into a separate type.
 */
export function feedingDetailLabel(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null
  const feedingType = metadata.feeding_type
  if (feedingType === 'bottle') {
    const amount = metadata.amount
    return typeof amount === 'number' ? `בקבוק · ${formatMilliliters(amount)}` : 'בקבוק'
  }
  if (feedingType === 'breast') {
    const side = metadata.side
    return side === 'left' || side === 'right' ? `הנקה · ${SIDE_LABELS[side]}` : 'הנקה'
  }
  return null
}

/**
 * Reads the breast side used for the last breastfeed on this device, so the UI
 * can hint which side comes next (parents alternate sides). Bottle feeds don't
 * change it. Returns null when nothing is stored or storage is unavailable.
 */
export function readLastBreastSide(): BreastSide | null {
  try {
    const value = localStorage.getItem(LAST_SIDE_KEY)
    return value === 'left' || value === 'right' ? value : null
  } catch {
    // Storage disabled / private mode - the hint is advisory, so treat as "unknown".
    return null
  }
}

/** Persists the breast side of the most recent breastfeed. No-op if storage fails. */
export function writeLastBreastSide(side: BreastSide): void {
  try {
    localStorage.setItem(LAST_SIDE_KEY, side)
  } catch {
    // Private mode / storage disabled - the hint is advisory, so ignore.
  }
}
