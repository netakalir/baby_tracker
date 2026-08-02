/**
 * Day-boundary math for the Today-screen clock.
 *
 * Per the project's timezone principle, all timestamps are stored in UTC, but
 * "what counts as today" is always computed in Israel local time (Asia/Jerusalem),
 * never derived from raw UTC or the machine's local zone.
 *
 * An event that crosses midnight (starts on day X, ends on day X+1) is clipped to
 * the portion that falls inside the displayed day, so it renders correctly on both
 * days' clocks (spec section 6).
 */

const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'

export const MINUTES_IN_DAY = 24 * 60

/** A segment of an event that falls within a single displayed day. */
export interface DaySegment {
  /** Minutes from local midnight (00:00) where the segment starts, clamped to [0, 1440]. */
  readonly startMinutes: number
  /**
   * Minutes from local midnight where the segment ends, clamped to [0, 1440].
   * For a point-in-time event this equals `startMinutes`.
   */
  readonly endMinutes: number
  /** True when the source event had no `end_time` (instantaneous / active timer). */
  readonly isPointInTime: boolean
}

/** Returns the Asia/Jerusalem calendar date parts for a given instant. */
function israelDateParts(instant: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [year, month, day] = formatter.format(instant).split('-').map(Number)
  return { year, month, day }
}

/** Returns the UTC offset (in minutes) of Asia/Jerusalem at a given instant. */
function israelOffsetMinutes(instant: Date): number {
  // Compare the same instant formatted as if it were UTC vs. as Israel local time.
  const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }))
  const asIsrael = new Date(instant.toLocaleString('en-US', { timeZone: ISRAEL_TIME_ZONE }))
  return (asIsrael.getTime() - asUtc.getTime()) / 60_000
}

/**
 * The UTC instant of local midnight (00:00 Asia/Jerusalem) for the calendar day
 * that `date` falls on in Israel local time.
 */
export function israelMidnightUtc(date: Date): Date {
  const { year, month, day } = israelDateParts(date)
  // Guess the midnight instant assuming the offset at midday (avoids DST edge at 00:00),
  // then correct using the offset that actually applies at that guessed instant.
  const middayGuess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offset = israelOffsetMinutes(middayGuess)
  return new Date(Date.UTC(year, month - 1, day, 0, -offset, 0))
}

/** Minutes elapsed from the given local-midnight instant to `instant` (may be negative or > 1440). */
function minutesFromMidnight(instant: Date, midnightUtc: Date): number {
  return (instant.getTime() - midnightUtc.getTime()) / 60_000
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
 * @param displayedDate any Date whose Israel-local calendar day is the one being shown
 */
export function clipEventToDay(
  startTimeIso: string,
  endTimeIso: string | null,
  displayedDate: Date,
): DaySegment | null {
  const midnightUtc = israelMidnightUtc(displayedDate)
  const start = new Date(startTimeIso)
  if (Number.isNaN(start.getTime())) return null

  const startMinutesRaw = minutesFromMidnight(start, midnightUtc)

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
  const endMinutesRaw = minutesFromMidnight(end, midnightUtc)

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
