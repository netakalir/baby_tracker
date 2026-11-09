/**
 * "What to dress the baby" advice, derived from the *apparent* ("feels like")
 * temperature. The copy is user-approved; keep it verbatim.
 *
 * Boundaries: the apparent temperature is first rounded to the nearest whole
 * degree (`Math.round`, so 26.5 → 27 and 10.4 → 10), then mapped:
 *   ≥ 27        → short bodysuit only
 *   22 … 26     → short bodysuit + light pants
 *   17 … 21     → long bodysuit + light blanket
 *   11 … 16     → long pyjamas + top layer + blanket
 *   ≤ 10        → layers + warm overall + hat
 * Rounding first means there is no fractional gap between bands (e.g. 26.7).
 */

interface AdviceBand {
  /** The lowest rounded apparent temperature (inclusive) this band covers. */
  minDegrees: number
  advice: string
}

/** Ordered warmest-first; the first band whose minimum is met wins. */
const ADVICE_BANDS: readonly AdviceBand[] = [
  { minDegrees: 27, advice: 'בגד גוף קצר בלבד' },
  { minDegrees: 22, advice: 'בגד גוף קצר + מכנס דק' },
  { minDegrees: 17, advice: 'בגד גוף ארוך + שמיכה דקה' },
  { minDegrees: 11, advice: "פיג'מה ארוכה + שכבה עליונה + שמיכה" },
]

/** Advice for anything at or below 10° (after rounding). */
const COLDEST_ADVICE = 'שכבות + אוברול חם + כובע'

/** Returns the dressing advice for an apparent temperature in °C. */
export function dressingAdviceFor(apparentTemperature: number): string {
  const degrees = Math.round(apparentTemperature)
  const band = ADVICE_BANDS.find(({ minDegrees }) => degrees >= minDegrees)
  return band ? band.advice : COLDEST_ADVICE
}
