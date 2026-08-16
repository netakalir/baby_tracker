/**
 * Central unit-of-measure conversion module (feeding amounts).
 *
 * This module is the single source of conversion truth per the decided spec
 * (Documentation/unit-of-measure-spec.md). It owns the ONLY copy of the
 * ml<->fl-oz constant; no conversion constant or ad-hoc conversion math may
 * exist anywhere else in the codebase.
 *
 * Rules enforced here:
 * - `amount_ml` (integer) is the sole source of truth for all math/aggregation.
 * - The original entry is preserved verbatim for source fidelity; viewing in the
 *   entry unit never converts or rounds.
 * - Rounding happens only at the presentation layer, exactly once, and always
 *   from `amount_ml` — conversions are never chained.
 * - Aggregations sum `amount_ml` first, then convert/round the total once.
 */

/** 1 US fluid ounce in millilitres. The single source of conversion truth. */
const ML_PER_FL_OZ = 29.5735295625

export type Unit = 'ml' | 'oz'

/** Canonical feeding amount as stored in events.metadata (post-migration shape). */
export interface FeedingAmount {
  /** Integer canonical source of truth. */
  amount_ml: number
  /** Verbatim source fidelity — exactly what the user entered. */
  entered: { value: number; unit: Unit }
}

/** value in `unit` -> integer canonical ml, round-half-up. */
export function toCanonicalMl(value: number, unit: Unit): number {
  const ml = unit === 'oz' ? value * ML_PER_FL_OZ : value
  return Math.round(ml)
}

/** canonical ml -> value in `unit`, FULL precision, no rounding. */
export function fromCanonicalMl(amountMl: number, unit: Unit): number {
  return unit === 'oz' ? amountMl / ML_PER_FL_OZ : amountMl
}

/** stepper increment for a unit: ml -> 5, oz -> 0.5 (spec §Input UX). */
export function stepFor(unit: Unit): number {
  return unit === 'oz' ? 0.5 : 5
}

/** snap a value to its unit's step grid: ml -> nearest 5, oz -> nearest 0.5. */
export function snapToGrid(value: number, unit: Unit): number {
  const step = stepFor(unit)
  return Math.round(value / step) * step
}

/** Build the canonical FeedingAmount from a user entry (helper for write path). */
export function makeFeedingAmount(value: number, unit: Unit): FeedingAmount {
  return { amount_ml: toCanonicalMl(value, unit), entered: { value, unit } }
}

/**
 * Format a single record for display in `viewUnit`.
 *
 * If `viewUnit` equals the entry unit, the entered value is returned verbatim
 * (no conversion, no rounding). Otherwise the value is converted from
 * `amount_ml`, snapped to the target grid, and formatted. Returns the
 * numeric-string only (e.g. "120" or "3.5"); callers add the unit label.
 */
export function formatForDisplay(record: FeedingAmount, viewUnit: Unit): string {
  if (viewUnit === record.entered.unit) {
    return formatNumber(record.entered.value)
  }
  const converted = fromCanonicalMl(record.amount_ml, viewUnit)
  return formatNumber(snapToGrid(converted, viewUnit))
}

/** Aggregate display: convert the summed ml ONCE, round/snap ONCE. */
export function formatTotal(totalMl: number, viewUnit: Unit): string {
  const converted = fromCanonicalMl(totalMl, viewUnit)
  return formatNumber(snapToGrid(converted, viewUnit))
}

/** Format a snapped/entered value as a plain numeric string without trailing zeros. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}
