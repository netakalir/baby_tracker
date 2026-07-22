/**
 * Israel-timezone day-boundary helpers.
 *
 * All `events.start_time` values are stored in UTC (see CLAUDE.md timezone
 * principle), but "what counts as today" is defined by Israel-local midnight
 * (Asia/Jerusalem). Israel observes DST, so the UTC offset shifts through the
 * year - we must never hardcode it. Everything here is derived via the Intl
 * APIs so the boundary stays correct across DST transitions.
 */

const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'

/** The UTC ISO bounds of a single Israel-local day. */
export interface DayBounds {
  /** Inclusive start: Israel-local midnight, as a UTC ISO string. */
  startIso: string
  /** Exclusive end: the next Israel-local midnight, as a UTC ISO string. */
  endIso: string
}

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ISRAEL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const offsetPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ISRAEL_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * The Israel-local calendar date (`YYYY-MM-DD`) for a given instant.
 * Used as part of the query key so the "today" query re-scopes at midnight.
 */
export function israelDateString(now: Date = new Date()): string {
  // en-CA renders dates as `YYYY-MM-DD`, which is exactly the shape we want.
  return isoDateFormatter.format(now)
}

/**
 * The offset (in minutes) of Asia/Jerusalem from UTC at a given instant.
 * Positive because Israel is ahead of UTC (e.g. +120 in winter, +180 in DST).
 */
function israelUtcOffsetMinutes(instant: Date): number {
  const parts = offsetPartsFormatter.formatToParts(instant)
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type)
    if (!part) {
      throw new Error(`Missing "${type}" part while computing Israel offset`)
    }
    return Number(part.value)
  }

  // Reconstruct the wall-clock time Israel shows for this instant, treat it as
  // if it were UTC, and the difference from the true instant is the offset.
  const asUtc = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    lookup('hour'),
    lookup('minute'),
    lookup('second'),
  )
  return (asUtc - instant.getTime()) / 60_000
}

/**
 * The UTC instant of Israel-local midnight on a given `YYYY-MM-DD` date.
 * DST-safe: computes the offset that applies at that specific midnight.
 */
function israelMidnightUtc(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  // Midnight Israel-local, expressed first as a naive UTC guess, then corrected
  // by the offset that actually applies at that wall-clock moment.
  const naiveUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0)
  const offsetMinutes = israelUtcOffsetMinutes(new Date(naiveUtcMs))
  return new Date(naiveUtcMs - offsetMinutes * 60_000)
}

/**
 * The UTC ISO bounds (start inclusive, end exclusive) of the Israel-local day
 * containing `now`.
 */
export function israelDayBounds(now: Date = new Date()): DayBounds {
  const startDate = israelDateString(now)
  const start = israelMidnightUtc(startDate)

  // Advance one calendar day in Israel-local terms by taking the next date
  // string, so DST-shortened/lengthened days still land on the correct
  // midnight rather than a fixed 24h later.
  const nextDayInstant = new Date(start.getTime() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000)
  const endDate = israelDateString(nextDayInstant)
  const end = israelMidnightUtc(endDate)

  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
