/**
 * Device-timezone, per-child day-boundary helpers.
 *
 * All `events.start_time` values are stored in UTC (see CLAUDE.md timezone
 * principle). Two things are derived here, both device-local:
 *  - the wall clock / calendar day is computed in the *device* timezone
 *    (whatever zone the viewing phone is set to), never from raw UTC or a
 *    stored zone;
 *  - the day boundary ("what counts as today") starts at the child's
 *    `day_start` wall-clock time (default '00:00' = midnight), so a day runs
 *    from one `day_start` to the next.
 *
 * The device zone is resolved via Intl and all math is derived through the
 * Intl APIs, so both the wall clock and the boundary stay correct across DST
 * transitions.
 */

/** The zone the viewing device is set to, resolved client-side. */
const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/** The UTC ISO bounds of a single child-day (device tz + per-child `day_start`). */
export interface DayBounds {
  /** Inclusive start: the day's `day_start` wall-clock time, as a UTC ISO string. */
  startIso: string
  /** Exclusive end: the next day's `day_start` wall-clock time, as a UTC ISO string. */
  endIso: string
}

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DEVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const offsetPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DEVICE_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * The device-local calendar date (`YYYY-MM-DD`) for a given instant.
 * en-CA renders dates as `YYYY-MM-DD`, which is exactly the shape we want.
 */
export function deviceDateString(now: Date = new Date()): string {
  return isoDateFormatter.format(now)
}

/**
 * Parses a `day_start` value ('HH:MM' or 'HH:MM:SS') into minutes from
 * midnight. Seconds are ignored — the boundary is minute-resolution.
 */
export function parseDayStartMinutes(dayStart: string): number {
  const [hours, minutes] = dayStart.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid day_start value: "${dayStart}"`)
  }
  return hours * 60 + minutes
}

/** The offset (in minutes) of the device zone from UTC at a given instant. */
function deviceUtcOffsetMinutes(instant: Date): number {
  const parts = offsetPartsFormatter.formatToParts(instant)
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type)
    if (!part) {
      throw new Error(`Missing "${type}" part while computing device offset`)
    }
    return Number(part.value)
  }

  // Reconstruct the wall-clock time the device shows for this instant, treat it
  // as if it were UTC, and the difference from the true instant is the offset.
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
 * The UTC instant of a device-local wall-clock time: `minutesFromMidnight`
 * minutes past midnight on the device-local calendar date `dateString`.
 * DST-safe: corrects by the offset that actually applies at that moment.
 */
function deviceWallClockUtc(dateString: string, minutesFromMidnight: number): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  const naiveUtcMs = Date.UTC(year, month - 1, day, 0, minutesFromMidnight, 0)
  const offsetMinutes = deviceUtcOffsetMinutes(new Date(naiveUtcMs))
  return new Date(naiveUtcMs - offsetMinutes * 60_000)
}

/** Shifts a `YYYY-MM-DD` calendar date by `deltaDays` (pure calendar math, no tz). */
export function shiftDateString(dateString: string, deltaDays: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays))
  const yyyy = shifted.getUTCFullYear()
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * The UTC instant when the child-day of a given device-local calendar date
 * (`YYYY-MM-DD`) begins — that date at the child's `day_start` wall-clock time
 * in the device timezone. DST-safe (delegates to {@link deviceWallClockUtc}).
 * Lets callers walk fixed calendar days (e.g. a week) without ±24h drift.
 */
export function deviceDayStartOnDate(dateString: string, dayStart = '00:00'): Date {
  return deviceWallClockUtc(dateString, parseDayStartMinutes(dayStart))
}

/**
 * The UTC instant when the child's current day began: the most recent
 * `day_start` wall-clock time (device tz) at or before `now`. When `now` is
 * still before today's `day_start`, the current day began on the previous
 * device-local calendar day.
 */
export function deviceDayWindowStart(now: Date = new Date(), dayStart = '00:00'): Date {
  const dayStartMinutes = parseDayStartMinutes(dayStart)
  const todayString = deviceDateString(now)
  const todayStart = deviceWallClockUtc(todayString, dayStartMinutes)
  if (now.getTime() >= todayStart.getTime()) return todayStart
  return deviceWallClockUtc(shiftDateString(todayString, -1), dayStartMinutes)
}

/**
 * The UTC ISO bounds (start inclusive, end exclusive) of the child-day
 * containing `now`, offset by the child's `day_start`.
 */
export function deviceDayBounds(now: Date = new Date(), dayStart = '00:00'): DayBounds {
  const dayStartMinutes = parseDayStartMinutes(dayStart)
  const start = deviceDayWindowStart(now, dayStart)
  // Advance one calendar day from the start's device-local date, so DST-short/
  // long days still land on the correct next `day_start` rather than +24h.
  const startDateString = deviceDateString(start)
  const end = deviceWallClockUtc(shiftDateString(startDateString, 1), dayStartMinutes)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/**
 * A stable key for the current child-day (the device-local date its `day_start`
 * falls on). Used in the TanStack Query key so the "today" query re-scopes
 * automatically once the day rolls over past the child's `day_start`.
 */
export function deviceDayKey(now: Date = new Date(), dayStart = '00:00'): string {
  return deviceDateString(deviceDayWindowStart(now, dayStart))
}
