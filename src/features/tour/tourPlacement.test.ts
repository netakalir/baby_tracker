import { describe, expect, it } from 'vitest'
import { ANCHOR_GAP, padRect, placeTourCard, VIEWPORT_MARGIN } from './tourPlacement'

const viewport = { width: 375, height: 800 }
const card = { width: 300, height: 160 }

describe('placeTourCard', () => {
  it('centres the card when there is no anchor', () => {
    expect(placeTourCard(null, card, viewport)).toEqual({ top: 320, left: 37.5 })
  })

  it('places the card below an anchor near the top', () => {
    const anchor = { top: 20, left: 300, width: 40, height: 40 }
    const point = placeTourCard(anchor, card, viewport)
    expect(point.top).toBe(20 + 40 + ANCHOR_GAP)
  })

  it('places the card above an anchor near the bottom', () => {
    const anchor = { top: 700, left: 20, width: 335, height: 80 }
    const point = placeTourCard(anchor, card, viewport)
    expect(point.top).toBe(700 - ANCHOR_GAP - card.height)
  })

  it('keeps the card inside the horizontal margins', () => {
    const atEnd = placeTourCard({ top: 20, left: 340, width: 30, height: 30 }, card, viewport)
    expect(atEnd.left).toBe(viewport.width - card.width - VIEWPORT_MARGIN)

    const atStart = placeTourCard({ top: 20, left: 0, width: 30, height: 30 }, card, viewport)
    expect(atStart.left).toBe(VIEWPORT_MARGIN)
  })

  it('stays on-screen when the anchor leaves no room on either side', () => {
    const tall = { top: 100, left: 20, width: 335, height: 650 }
    const point = placeTourCard(tall, card, viewport)
    expect(point.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
    expect(point.top + card.height).toBeLessThanOrEqual(viewport.height - VIEWPORT_MARGIN)
  })

  it('pins to the start margin when the card is wider than the viewport', () => {
    const narrow = { width: 280, height: 800 }
    expect(placeTourCard(null, card, narrow).left).toBe(VIEWPORT_MARGIN)
  })
})

describe('padRect', () => {
  it('grows the rectangle equally on every side', () => {
    expect(padRect({ top: 10, left: 10, width: 20, height: 20 }, 5)).toEqual({
      top: 5,
      left: 5,
      width: 30,
      height: 30,
    })
  })
})
