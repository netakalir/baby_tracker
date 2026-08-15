import type { BreastSide, FeedingMetadata } from '../../types/database'
import { formatForDisplay, stepFor, type FeedingAmount, type Unit } from '../../lib/units'

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

/** Hebrew unit labels appended after a numeric feeding amount, per display unit. */
const UNIT_LABELS: Record<Unit, string> = {
  ml: 'מ״ל',
  oz: 'אונקיות',
}

/**
 * Bottle amount presets offered as a scroll list when a bottle feed is stopped,
 * expressed in the viewer's display unit and stepped so values stay "clean" in
 * that unit (spec Input UX): 10-300 ml in 10 ml steps, or 0.5-10 oz in
 * `stepFor('oz')` (0.5) steps - the practical range for a baby bottle.
 */
export function bottleAmountOptions(unit: Unit): readonly number[] {
  if (unit === 'oz') {
    return Array.from({ length: 20 }, (_, index) => (index + 1) * stepFor('oz'))
  }
  return Array.from({ length: 30 }, (_, index) => (index + 1) * 10)
}

/** Formats a raw amount already expressed in `unit` as a short Hebrew label. */
export function formatAmountInUnit(value: number, unit: Unit): string {
  return `${value} ${UNIT_LABELS[unit]}`
}

/** Formats a stored canonical feeding amount as a Hebrew label in the viewer's unit. */
export function formatFeedingAmount(amount: FeedingAmount, viewUnit: Unit): string {
  return `${formatForDisplay(amount, viewUnit)} ${UNIT_LABELS[viewUnit]}`
}

/** Narrows a `metadata` object to the canonical {@link FeedingAmount} shape, or null. */
function readFeedingAmount(metadata: Record<string, unknown>): FeedingAmount | null {
  const amountMl = metadata.amount_ml
  if (typeof amountMl !== 'number') return null
  const entered = metadata.entered
  if (typeof entered === 'object' && entered !== null) {
    const record = entered as Record<string, unknown>
    const value = record.value
    const unit = record.unit
    if (typeof value === 'number' && (unit === 'ml' || unit === 'oz')) {
      return { amount_ml: amountMl, entered: { value, unit } }
    }
  }
  // Defensive fallback for records missing a valid `entered`: treat the canonical
  // millilitre value as the entry, so an amount still displays rather than blanks.
  return { amount_ml: amountMl, entered: { value: amountMl, unit: 'ml' } }
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
export function feedingDetailLabel(
  metadata: Record<string, unknown> | null,
  displayUnit: Unit,
): string | null {
  if (!metadata) return null
  const feedingType = metadata.feeding_type
  if (feedingType === 'bottle') {
    const amount = readFeedingAmount(metadata)
    return amount ? `בקבוק · ${formatFeedingAmount(amount, displayUnit)}` : 'בקבוק'
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
