import { MINUTES_IN_DAY } from './dayWindow'

/**
 * SVG geometry for the 24-hour clock.
 *
 * Orientation (documented, per spec section 3):
 *   - The clock is a 24-hour dial.
 *   - Midnight (00:00) is at the BOTTOM (6 o'clock position).
 *   - Noon (12:00) is at the TOP (12 o'clock position).
 *   - Time advances CLOCKWISE (00:00 bottom -> 06:00 left -> 12:00 top -> 18:00 right).
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
 *
 * SVG angle convention here: 0deg points up (12 o'clock, our noon), increasing
 * clockwise. Midnight sits at 180deg (bottom).
 */
export function minutesToAngle(minutes: number): number {
  const fractionOfDay = minutes / MINUTES_IN_DAY
  // Offset by 180deg so 00:00 lands at the bottom, and go clockwise with time.
  return (fractionOfDay * FULL_CIRCLE_DEG + 180) % FULL_CIRCLE_DEG
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
 * Builds an SVG path `d` string for a ring arc (annular sector outline) spanning
 * from `startMinutes` to `endMinutes` between `innerRadius` and `outerRadius`.
 */
export function ringArcPath(
  center: Point,
  innerRadius: number,
  outerRadius: number,
  startMinutes: number,
  endMinutes: number,
): string {
  const startAngle = minutesToAngle(startMinutes)
  const endAngle = minutesToAngle(endMinutes)

  const sweepMinutes = endMinutes - startMinutes
  const largeArcFlag = sweepMinutes / MINUTES_IN_DAY > 0.5 ? 1 : 0

  const outerStart = pointOnCircle(center, outerRadius, startAngle)
  const outerEnd = pointOnCircle(center, outerRadius, endAngle)
  const innerEnd = pointOnCircle(center, innerRadius, endAngle)
  const innerStart = pointOnCircle(center, innerRadius, startAngle)

  // Outer edge clockwise (sweep flag 1), then inner edge counter-clockwise (0).
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}
