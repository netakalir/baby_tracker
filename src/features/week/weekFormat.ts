/**
 * Compact, device-local formatting for the week charts. Kept separate from the
 * clock's `timeFormat` (which formats instants) because these format *spans*,
 * *counts* and *calendar days* for the week's axes and summary line.
 */

/** The zone the viewing device is set to, resolved client-side (see todayDate.ts). */
const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const weekdayFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: DEVICE_TIME_ZONE,
  weekday: 'short',
})

const dayOfMonthFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: DEVICE_TIME_ZONE,
  day: 'numeric',
})

/** Short Hebrew weekday for a child-day's start instant (e.g. "יום ג׳" → "ג׳"). */
export function formatWeekday(date: Date): string {
  return weekdayFormatter.format(date).replace('יום ', '')
}

/** Day-of-month number for a child-day's start instant (e.g. "22"). */
export function formatDayOfMonth(date: Date): string {
  return dayOfMonthFormatter.format(date)
}

/**
 * A span of minutes as a compact hours number for the sleep-bar labels: whole
 * hours with no decimal ("12"), a half hour as ".5" ("7.5"), rounded to the
 * nearest half hour. Returns an empty string for a zero span.
 */
export function formatHoursShort(minutes: number): string {
  if (minutes <= 0) return ''
  const halves = Math.round(minutes / 30)
  const hours = halves / 2
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

/**
 * The weekly sleep average as a Hebrew "hours per day" string for the summary
 * line — e.g. "12.5 ש׳ ליום". Returns a dash when there is no tracked day.
 */
export function formatAverageSleep(avgMinutes: number, hasData: boolean): string {
  if (!hasData) return '—'
  return `${(avgMinutes / 60).toFixed(1)} ש׳ ליום`
}
