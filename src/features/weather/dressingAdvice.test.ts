import { describe, expect, it } from 'vitest'
import { dressingAdviceFor } from './dressingAdvice'

const SHORT_ONLY = 'בגד גוף קצר בלבד'
const SHORT_AND_PANTS = 'בגד גוף קצר + מכנס דק'
const LONG_AND_BLANKET = 'בגד גוף ארוך + שמיכה דקה'
const PYJAMAS = "פיג'מה ארוכה + שכבה עליונה + שמיכה"
const WARM_LAYERS = 'שכבות + אוברול חם + כובע'

describe('dressingAdviceFor', () => {
  it.each([
    // ≥ 27
    [40, SHORT_ONLY],
    [27, SHORT_ONLY],
    // 22 – 26
    [26, SHORT_AND_PANTS],
    [22, SHORT_AND_PANTS],
    // 17 – 21
    [21, LONG_AND_BLANKET],
    [17, LONG_AND_BLANKET],
    // 11 – 16
    [16, PYJAMAS],
    [11, PYJAMAS],
    // ≤ 10
    [10, WARM_LAYERS],
    [0, WARM_LAYERS],
    [-15, WARM_LAYERS],
  ])('maps a whole %s° to its band', (degrees, advice) => {
    expect(dressingAdviceFor(degrees)).toBe(advice)
  })

  it.each([
    // Rounds to the nearest degree first, then maps — so each boundary's ±0.5 splits cleanly.
    [26.5, SHORT_ONLY],
    [26.49, SHORT_AND_PANTS],
    [21.5, SHORT_AND_PANTS],
    [21.49, LONG_AND_BLANKET],
    [16.5, LONG_AND_BLANKET],
    [16.49, PYJAMAS],
    [10.5, PYJAMAS],
    [10.49, WARM_LAYERS],
  ])('rounds the fractional %s° before mapping', (degrees, advice) => {
    expect(dressingAdviceFor(degrees)).toBe(advice)
  })

  it('leaves no gap between bands for fractional values', () => {
    expect(dressingAdviceFor(26.7)).toBe(SHORT_ONLY)
    expect(dressingAdviceFor(21.2)).toBe(LONG_AND_BLANKET)
    expect(dressingAdviceFor(-0.4)).toBe(WARM_LAYERS)
  })
})
