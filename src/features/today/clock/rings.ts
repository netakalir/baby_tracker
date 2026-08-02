import type { EventType } from '../../../types/database'

/**
 * Ring layout for the 24-hour clock.
 *
 * Each event type owns one fixed concentric ring, always at the same radius and
 * always in its own color, so the dial reads the same way every day: the outer
 * ring is always sleep, the next is always feeding, and so on. Events therefore
 * sit side by side rather than stacking on shared lanes, which keeps overlapping
 * events of different types visually distinguishable (the whole point of the
 * dial) at the cost of a little empty space on quiet rings.
 *
 * Order is outermost-first: the long, dominant events (sleep) get the longest
 * circumference, the sparse point-in-time ones sit closer to the middle.
 */
export interface Ring {
  readonly type: EventType
  /** Radius of the ring's centreline, in viewBox units. */
  readonly radius: number
}

/** Stroke width of every event arc and of the faint ring track behind it. */
export const RING_STROKE = 11

/** Radial distance between two adjacent ring centrelines. */
const RING_SPACING = 17

/** Radius of the outermost (first) ring. */
const OUTER_RING_RADIUS = 97

/** Display order, outermost to innermost. Shared with the legend. */
export const RING_ORDER: readonly EventType[] = ['sleep', 'feeding', 'diaper', 'mood']

export const RINGS: readonly Ring[] = RING_ORDER.map((type, index) => ({
  type,
  radius: OUTER_RING_RADIUS - index * RING_SPACING,
}))

const RADIUS_BY_TYPE: Readonly<Record<EventType, number>> = Object.fromEntries(
  RINGS.map((ring) => [ring.type, ring.radius]),
) as Record<EventType, number>

/** The fixed ring radius an event of the given type is drawn on. */
export function ringRadius(type: EventType): number {
  return RADIUS_BY_TYPE[type]
}
