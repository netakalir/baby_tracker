/**
 * Day-selection math and labels for the Day-comparison screen.
 *
 * The selectable range is the last {@link COMPARE_RANGE_DAYS} child-days ending
 * today, bounded below by the child's creation day — the same floor the
 * historical Today view applies (`canGoToPrevDay`), so no chip ever offers a
 * day that predates the child. All day math reuses the device-timezone,
 * per-child `day_start` helpers, so a "day" here is exactly the day the Today
 * and Week screens show.
 */

import { currentChildDateString, shiftDateString } from '../today/todayDate'

/** How many recent child-days (today included) can be picked for comparison. */
export const COMPARE_RANGE_DAYS = 14

/**
 * The selectable child-days (`YYYY-MM-DD`), oldest first: up to
 * {@link COMPARE_RANGE_DAYS} days ending at the current child-day, never earlier
 * than the child's creation day. Chronological order matches the Week chart
 * (earliest at the RTL start edge).
 */
export function selectableDates(
  createdAtIso: string,
  dayStart = '00:00',
  now: Date = new Date(),
): string[] {
  const todayString = currentChildDateString(now, dayStart)
  const createdString = currentChildDateString(new Date(createdAtIso), dayStart)
  const dates: string[] = []
  for (let offset = COMPARE_RANGE_DAYS - 1; offset >= 0; offset--) {
    const dateString = shiftDateString(todayString, -offset)
    if (dateString >= createdString) dates.push(dateString)
  }
  return dates
}

/**
 * The initial selection: today and yesterday — the last two selectable days,
 * or just today for a child created today.
 */
export function defaultSelectedDates(dates: readonly string[]): string[] {
  return dates.slice(-2)
}

/**
 * Toggles `dateString` in a selection, returning a new array kept in the same
 * order as `dates` (so rows render in a stable order regardless of tap order).
 */
export function toggleDate(
  selected: readonly string[],
  dateString: string,
  dates: readonly string[],
): string[] {
  const next = new Set(selected)
  if (next.has(dateString)) next.delete(dateString)
  else next.add(dateString)
  return dates.filter((candidate) => next.has(candidate))
}

/** A `YYYY-MM-DD` date as a noon-UTC Date, safe for weekday/month label formatting. */
function labelDate(dateString: string): Date {
  return new Date(`${dateString}T12:00:00Z`)
}

/** "יום שלישי, 1 בספטמבר" — formatted from a noon-UTC instant (see HistoricalDayView). */
const longDayFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const shortWeekdayFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'UTC',
  weekday: 'short',
})

const dayOfMonthFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'UTC',
  day: 'numeric',
})

/** The full Hebrew date of a child-day, e.g. "יום שלישי, 1 בספטמבר". */
export function formatLongDayLabel(dateString: string): string {
  return longDayFormatter.format(labelDate(dateString))
}

/** The short Hebrew weekday of a child-day, e.g. "ג׳" (the "יום " prefix dropped). */
export function formatShortWeekday(dateString: string): string {
  return shortWeekdayFormatter.format(labelDate(dateString)).replace('יום ', '')
}

/** The day-of-month number of a child-day, e.g. "1". */
export function formatDayNumber(dateString: string): string {
  return dayOfMonthFormatter.format(labelDate(dateString))
}

/**
 * The title of a comparison row: "היום" / "אתמול" for the two most recent days
 * (the default pair, read at a glance), otherwise the full Hebrew date.
 */
export function formatRowLabel(dateString: string, todayString: string): string {
  if (dateString === todayString) return 'היום'
  if (dateString === shiftDateString(todayString, -1)) return 'אתמול'
  return formatLongDayLabel(dateString)
}
