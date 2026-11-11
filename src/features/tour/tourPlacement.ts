/**
 * Pure geometry for the tour: where the highlight ring and the step card go.
 * Kept free of DOM access so it is unit-tested directly.
 */

export interface Rect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Point {
  readonly top: number
  readonly left: number
}

/** Space kept between the card and the screen edges (matches the page gutter). */
export const VIEWPORT_MARGIN = 16
/** Gap between the highlighted element and the card. */
export const ANCHOR_GAP = 12
/** How far the highlight ring extends around the element. */
export const HIGHLIGHT_PADDING = 6

function clamp(value: number, min: number, max: number): number {
  // When the card is wider/taller than the room available, pin it to `min`
  // (the start edge) rather than letting `max < min` push it off-screen.
  return Math.max(min, Math.min(value, max))
}

/** The anchor's rectangle grown by the highlight padding on every side. */
export function padRect(rect: Rect, padding: number = HIGHLIGHT_PADDING): Rect {
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

/**
 * Positions the step card (viewport coordinates, for `position: fixed`).
 *
 * - No anchor: centred on the screen.
 * - With an anchor: below it when it fits, otherwise above it, otherwise
 *   whichever side has more room (clamped so the card stays on-screen).
 *   Horizontally it is centred on the anchor and clamped to the margins.
 */
export function placeTourCard(anchor: Rect | null, card: Size, viewport: Size): Point {
  const maxLeft = viewport.width - card.width - VIEWPORT_MARGIN
  const maxTop = viewport.height - card.height - VIEWPORT_MARGIN

  if (anchor === null) {
    return {
      top: clamp((viewport.height - card.height) / 2, VIEWPORT_MARGIN, maxTop),
      left: clamp((viewport.width - card.width) / 2, VIEWPORT_MARGIN, maxLeft),
    }
  }

  const left = clamp(anchor.left + anchor.width / 2 - card.width / 2, VIEWPORT_MARGIN, maxLeft)

  const below = anchor.top + anchor.height + ANCHOR_GAP
  const above = anchor.top - ANCHOR_GAP - card.height
  const fitsBelow = below + card.height <= viewport.height - VIEWPORT_MARGIN
  const fitsAbove = above >= VIEWPORT_MARGIN

  let top: number
  if (fitsBelow) {
    top = below
  } else if (fitsAbove) {
    top = above
  } else {
    const roomBelow = viewport.height - (anchor.top + anchor.height)
    top = roomBelow >= anchor.top ? below : above
  }

  return { top: clamp(top, VIEWPORT_MARGIN, maxTop), left }
}
