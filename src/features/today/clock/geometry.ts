import { MINUTES_IN_DAY } from './dayWindow'

/**
 * SVG geometry for the 24-hour clock.
 *
 * Orientation (documented, per the reference design):
 *   - The clock is a 24-hour dial.
 *   - Midnight (00:00) is at the TOP (12 o'clock position).
 *   - Noon (12:00) is at the BOTTOM (6 o'clock position).
 *   - Time advances CLOCKWISE (00:00 top -> 06:00 right -> 12:00 bottom -> 18:00 left).
 *
 * Note on RTL: the dial is a time instrument, not text flow, so clockwise time
 * progression is kept regardless of the app's RTL text direction (a clock reads
 * clockwise in Hebrew too).
 */

export interface Point {
  readonly x: number
  readonly y: number
}

/** Full sweep of the dial in degrees. */
const FULL_CIRCLE_DEG = 360

/**
 * Converts a minute-of-day (0..1440) to an angle in degrees on the SVG dial.
 * 0deg points up (12 o'clock = midnight), increasing clockwise.
 */
export function minutesToAngle(minutes: number): number {
  return ((minutes / MINUTES_IN_DAY) * FULL_CIRCLE_DEG) % FULL_CIRCLE_DEG
}

/** Point on a circle of the given radius at the given dial angle (degrees). */
export function pointOnCircle(center: Point, radius: number, angleDeg: number): Point {
  // Convert "0deg = up, clockwise" to standard math radians (0 = +x axis, CCW).
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y + radius * Math.sin(rad),
  }
}

/**
 * Smallest sweep (in minutes) an arc is drawn with. A very short event would
 * otherwise collapse to a zero-length path, which SVG renders as nothing at all
 * even with a round linecap - so it is padded to stay visible as a small nub.
 */
const MIN_ARC_MINUTES = 4

/**
 * Builds an SVG path `d` string for a single-radius arc from `startMinutes` to
 * `endMinutes`, meant to be *stroked* (with a round linecap) rather than filled -
 * this gives the thick, rounded event arcs of the reference design.
 *
 * A sweep covering the whole day is split into two half-circles, because an SVG
 * arc whose start and end points coincide is degenerate and draws nothing.
 */
export function strokeArcPath(
  center: Point,
  radius: number,
  startMinutes: number,
  endMinutes: number,
): string {
  const sweepMinutes = Math.min(Math.max(endMinutes - startMinutes, MIN_ARC_MINUTES), MINUTES_IN_DAY)
  const start = pointOnCircle(center, radius, minutesToAngle(startMinutes))

  if (sweepMinutes >= MINUTES_IN_DAY) {
    const opposite = pointOnCircle(center, radius, minutesToAngle(startMinutes + MINUTES_IN_DAY / 2))
    return (
      `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${opposite.x} ${opposite.y}` +
      ` A ${radius} ${radius} 0 0 1 ${start.x} ${start.y}`
    )
  }

  const end = pointOnCircle(center, radius, minutesToAngle(startMinutes + sweepMinutes))
  const largeArcFlag = sweepMinutes / MINUTES_IN_DAY > 0.5 ? 1 : 0
  // Sweep flag 1 = clockwise, matching increasing time.
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}
