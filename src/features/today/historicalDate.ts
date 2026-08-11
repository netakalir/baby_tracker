/**
 * Historical-mode resolution for the "Today" screen (spec §9).
 *
 * The screen opens in a past-day ("historical") view when the URL carries a
 * `date=YYYY-MM-DD` query param that resolves to a genuine past child-day. The
 * current child-day, any future date, an out-of-range date (before the child
 * existed), or an unparseable value all fall back to the live view — never an
 * error (spec §9.1). All day math reuses the device-timezone, per-child
 * `day_start` helpers so the boundary matches the live Today and the Week screen.
 */

import { currentChildDateString, shiftDateString } from './todayDate'

/** The live (current-day) view: unchanged Today with active logging. */
interface LiveMode {
  readonly kind: 'live'
}

/** The historical view for a specific past child-day (its calendar date). */
interface HistoricalMode {
  readonly kind: 'historical'
  /** The device-local calendar date (`YYYY-MM-DD`) being shown. */
  readonly dateString: string
}

export type TodayMode = LiveMode | HistoricalMode

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * True when `value` is a `YYYY-MM-DD` string denoting a real calendar date
 * (rejects e.g. `2026-13-40`, which the pattern alone would accept).
 */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Decides whether the screen is live or historical from the raw `date` URL param.
 *
 * Historical only when the param is a valid calendar date that is strictly in
 * the past (before the child's current day) and not before the child was
 * created. Everything else — absent, malformed, today, future, or pre-creation —
 * resolves to live, so a bad or out-of-range URL degrades gracefully (§9.1, §9.5).
 */
export function resolveTodayMode(
  rawDate: string | null,
  dayStart: string,
  createdAtIso: string,
  now: Date = new Date(),
): TodayMode {
  if (rawDate === null || !isValidDateString(rawDate)) return { kind: 'live' }

  const todayString = currentChildDateString(now, dayStart)
  const createdString = currentChildDateString(new Date(createdAtIso), dayStart)

  // Today or any future date → live (no future "historical" day, §9.5).
  if (rawDate >= todayString) return { kind: 'live' }
  // Before the child existed → out of range, graceful fallback to live.
  if (rawDate < createdString) return { kind: 'live' }

  return { kind: 'historical', dateString: rawDate }
}

/**
 * True while there is an earlier day to navigate to — i.e. the previous day is
 * not before the child's creation day (§9.5 backward clamp, consistent with the
 * Week screen).
 */
export function canGoToPrevDay(
  dateString: string,
  createdAtIso: string,
  dayStart: string,
): boolean {
  const createdString = currentChildDateString(new Date(createdAtIso), dayStart)
  return dateString > createdString
}

/** The previous calendar day (`YYYY-MM-DD`), for backward day navigation. */
export function prevDateString(dateString: string): string {
  return shiftDateString(dateString, -1)
}

/** The next calendar day (`YYYY-MM-DD`), for forward day navigation. */
export function nextDateString(dateString: string): string {
  return shiftDateString(dateString, 1)
}

/**
 * True when moving forward one day reaches (or passes) the child's current day.
 * At that point the screen returns to the live view rather than showing a
 * "historical today" (§9.5 forward clamp).
 */
export function nextDayIsLive(
  dateString: string,
  dayStart: string,
  now: Date = new Date(),
): boolean {
  return nextDateString(dateString) >= currentChildDateString(now, dayStart)
}
