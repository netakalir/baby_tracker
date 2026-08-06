/**
 * Day-boundary math for the Today-screen clock.
 *
 * Per the project's timezone principle, all timestamps are stored in UTC, but
 * "what counts as today" is computed device-local: the child-day starts at the
 * child's `day_start` wall-clock time (default '00:00' = midnight) in the
 * device timezone, never from raw UTC. The window start is derived by
 * `deviceDayWindowStart` (see `../todayDate`) so the same boundary is used here
 * and by the day-scoped event query.
 *
 * An event that crosses the boundary (starts before it, ends after) is clipped
 * to the portion that falls inside the displayed day, so it renders correctly
 * on both days' clocks (spec section 6).
 */

import { deviceDayWindowStart } from '../todayDate'

export const MINUTES_IN_DAY = 24 * 60

/** A segment of an event that falls within a single displayed day. */
export interface DaySegment {
  /** Minutes from the day's start (`day_start`) where the segment starts, clamped to [0, 1440]. */
  readonly startMinutes: number
  /**
   * Minutes from the day's start where the segment ends, clamped to [0, 1440].
   * For a point-in-time event this equals `startMinutes`.
   */
  readonly endMinutes: number
  /** True when the source event had no `end_time` (instantaneous / active timer). */
  readonly isPointInTime: boolean
}

/** Minutes elapsed from the given day-start instant to `instant` (may be negative or > 1440). */
function minutesFromDayStart(instant: Date, dayStartUtc: Date): number {
  return (instant.getTime() - dayStartUtc.getTime()) / 60_000
}

function clampToDay(minutes: number): number {
  if (minutes < 0) return 0
  if (minutes > MINUTES_IN_DAY) return MINUTES_IN_DAY
  return minutes
}

/**
 * Clips an event to the displayed day and returns the segment inside that day,
 * or `null` if the event does not overlap the displayed day at all.
 *
 * @param startTimeIso  event `start_time` (ISO/UTC string)
 * @param endTimeIso    event `end_time` (ISO/UTC string) or null for point-in-time events
 * @param displayedDate any Date whose device-local child-day is the one being shown
 * @param dayStart      the child's `day_start` ('HH:MM'), which the day window begins at
 */
export function clipEventToDay(
  startTimeIso: string,
  endTimeIso: string | null,
  displayedDate: Date,
  dayStart = '00:00',
): DaySegment | null {
  const dayStartUtc = deviceDayWindowStart(displayedDate, dayStart)
  const start = new Date(startTimeIso)
  if (Number.isNaN(start.getTime())) return null

  const startMinutesRaw = minutesFromDayStart(start, dayStartUtc)

  // Point-in-time event (diaper / mood / active-timer sleep): render only if it
  // falls within this day's window.
  if (endTimeIso === null) {
    if (startMinutesRaw < 0 || startMinutesRaw >= MINUTES_IN_DAY) return null
    return {
      startMinutes: startMinutesRaw,
      endMinutes: startMinutesRaw,
      isPointInTime: true,
    }
  }

  const end = new Date(endTimeIso)
  if (Number.isNaN(end.getTime())) return null
  const endMinutesRaw = minutesFromDayStart(end, dayStartUtc)

  // No overlap with [0, 1440]: entirely before or entirely after this day.
  if (endMinutesRaw <= 0 || startMinutesRaw >= MINUTES_IN_DAY) return null

  const startMinutes = clampToDay(startMinutesRaw)
  const endMinutes = clampToDay(endMinutesRaw)

  // A negative-length segment means malformed data (end before start).
  if (endMinutes < startMinutes) return null

  // A zero-length segment is kept (not discarded) so a just-started or very
  // short timer still renders as a small nub via the arc renderer's minimum
  // sweep, instead of vanishing from the clock until a full minute has elapsed.
  return { startMinutes, endMinutes, isPointInTime: false }
}
