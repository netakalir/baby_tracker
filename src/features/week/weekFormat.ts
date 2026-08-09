/**
 * Compact, Israel-local formatting for the week chart. Kept separate from the
 * clock's `timeFormat` (which formats instants) because these format *spans*
 * and *calendar days* for the week's axis and summary tiles.
 */

const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'

const weekdayFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: ISRAEL_TIME_ZONE,
  weekday: 'short',
})

const dayOfMonthFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: ISRAEL_TIME_ZONE,
  day: 'numeric',
})

/** Short Hebrew weekday for a child-day's start instant (e.g. "יום ג׳" → "ג׳"). */
export function formatWeekday(date: Date): string {
  // he-IL "short" weekday renders as "יום ג׳"; keep only the distinguishing part.
  return weekdayFormatter.format(date).replace('יום ', '')
}

/** Day-of-month number for a child-day's start instant (e.g. "22"). */
export function formatDayOfMonth(date: Date): string {
  return dayOfMonthFormatter.format(date)
}

/**
 * A span of minutes as a compact hours number for the bar labels: whole hours
 * with no decimal ("12"), a half hour as ".5" ("7.5"), rounded to the nearest
 * half hour. Returns an empty string for a zero span so untracked days stay bare.
 */
export function formatHoursShort(minutes: number): string {
  if (minutes <= 0) return ''
  const halves = Math.round(minutes / 30)
  const hours = halves / 2
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

/**
 * A daily average (total minutes over seven days) as a Hebrew "hours per day"
 * string for a summary tile — e.g. "12.5 ש׳". Always shows one decimal so the
 * two tiles line up.
 */
export function formatDailyAverageHours(totalMinutes: number, dayCount: number): string {
  if (dayCount <= 0) return '0 ש׳'
  const hours = totalMinutes / 60 / dayCount
  return `${hours.toFixed(1)} ש׳`
}
