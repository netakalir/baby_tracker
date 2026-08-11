import type { MeasurementUnit } from '../types/database'

/**
 * Amounts are stored canonically in millilitres (see the move_units migration and
 * CLAUDE.md). Converting ml -> fl oz for display is therefore a lossless, per-viewer
 * choice driven by the user's `units` preference - the stored value never changes.
 */
const ML_PER_FL_OZ = 29.5735

/**
 * Short Hebrew unit labels. 'מ״ל' mirrors the ml option in DisplayScreen's
 * UNIT_OPTIONS; 'אונ׳' is the compact abbreviation of that screen's 'אונקיות'
 * (fluid ounces), kept short so it fits inline next to a number.
 */
const UNIT_LABELS: Record<MeasurementUnit, string> = {
  ml: 'מ״ל',
  oz: 'אונ׳',
}

/** Rounds a fluid-ounce value to one decimal, dropping a trailing ".0" (e.g. 4 → "4", 4.06 → "4.1"). */
function formatOzValue(oz: number): string {
  return String(Math.round(oz * 10) / 10)
}

/**
 * Formats a canonical millilitre amount as a short Hebrew display string in the
 * viewer's chosen unit, e.g. `formatAmount(120, 'ml')` → "120 מ״ל" and
 * `formatAmount(120, 'oz')` → "4.1 אונ׳". Display-only: the stored ml value is
 * never mutated.
 */
export function formatAmount(amountMl: number, unit: MeasurementUnit): string {
  if (unit === 'oz') {
    return `${formatOzValue(amountMl / ML_PER_FL_OZ)} ${UNIT_LABELS.oz}`
  }
  return `${amountMl} ${UNIT_LABELS.ml}`
}
