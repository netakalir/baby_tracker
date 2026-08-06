/**
 * Hardcoded age-norm constants for the estimate fallbacks. No external AI/search
 * call is made here — that is deferred; the norms live in code (per the task).
 *
 * SOURCE-OF-TRUTH CAVEAT: the exact age-norms table lives in the missing
 * `estimate-contract.md` §2. The brackets below are widely-accepted,
 * Huckleberry-style placeholder values and MUST be replaced with the contract's
 * exact numbers before this is considered final. They are isolated in this one
 * file precisely so that reconciliation is a single, contained edit.
 *
 * - `feeding_interval_minutes`: typical gap between feeds for the age bracket,
 *   used only when the child has fewer than the personal-average threshold of
 *   feedings on record.
 * - `wake_window_minutes`: age-appropriate awake stretch between sleeps, added to
 *   the end of the last completed sleep to predict the next sleep onset.
 */

/** A single age bracket. `max_age_months` is exclusive; the last bracket is open-ended. */
export interface AgeNorm {
  /** Inclusive lower bound of the bracket, in whole months. */
  min_age_months: number
  /** Exclusive upper bound in whole months, or null for the open-ended top bracket. */
  max_age_months: number | null
  feeding_interval_minutes: number
  wake_window_minutes: number
}

/**
 * PLACEHOLDER age-norms table — reconcile with estimate-contract.md §2.
 * Ordered by ascending age; brackets are contiguous and non-overlapping.
 */
export const AGE_NORMS: readonly AgeNorm[] = [
  { min_age_months: 0, max_age_months: 1, feeding_interval_minutes: 120, wake_window_minutes: 45 },
  { min_age_months: 1, max_age_months: 2, feeding_interval_minutes: 150, wake_window_minutes: 60 },
  { min_age_months: 2, max_age_months: 4, feeding_interval_minutes: 180, wake_window_minutes: 75 },
  { min_age_months: 4, max_age_months: 6, feeding_interval_minutes: 210, wake_window_minutes: 120 },
  { min_age_months: 6, max_age_months: 9, feeding_interval_minutes: 240, wake_window_minutes: 150 },
  { min_age_months: 9, max_age_months: 12, feeding_interval_minutes: 240, wake_window_minutes: 180 },
  { min_age_months: 12, max_age_months: null, feeding_interval_minutes: 300, wake_window_minutes: 240 },
] as const

/** Whole months elapsed between a birth date and a reference instant (floored, never negative). */
export function ageInMonths(birthDate: Date, now: Date): number {
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birthDate.getUTCMonth())
  if (now.getUTCDate() < birthDate.getUTCDate()) {
    months -= 1
  }
  return Math.max(0, months)
}

/** Resolves the age norm bracket for a given age; falls back to the top bracket. */
export function normForAge(ageMonths: number): AgeNorm {
  const match = AGE_NORMS.find(
    (norm) =>
      ageMonths >= norm.min_age_months &&
      (norm.max_age_months === null || ageMonths < norm.max_age_months),
  )
  // The table is contiguous from 0 with an open top bracket, so a match always
  // exists for any non-negative age; the fallback satisfies the type checker.
  return match ?? AGE_NORMS[AGE_NORMS.length - 1]
}
