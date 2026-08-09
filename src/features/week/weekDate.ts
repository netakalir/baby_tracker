/**
 * Week-window day math for the "Week" screen.
 *
 * Reuses the Today screen's device-timezone, per-child day-boundary helpers so
 * the two screens agree on exactly what "a day" is: a child-day runs from the
 * child's `day_start` wall-clock time (device tz) to the next. The week is the
 * seven child-days ending with (and including) the current one.
 */

import {
  deviceDateString,
  deviceDayBounds,
  deviceDayStartOnDate,
  deviceDayWindowStart,
  shiftDateString,
} from '../today/todayDate'

/** Days shown on the week chart: the current child-day plus the six before it. */
export const DAYS_IN_WEEK = 7

/** A single child-day in the displayed week. */
export interface WeekDay {
  /** The device-local calendar date (`YYYY-MM-DD`) this child-day starts on. */
  dateString: string
  /**
   * An instant inside this child-day (its `day_start`), used as the
   * `displayedDate` when clipping events to the day.
   */
  date: Date
  /** True for the current (last, rightmost-in-time) day of the window. */
  isToday: boolean
}

/**
 * The seven child-days of the displayed week, oldest first, ending with the
 * child-day containing `now`. Calendar days are walked with
 * {@link shiftDateString} (not ±24h arithmetic) so DST-short/long days stay on
 * the correct boundary.
 */
export function weekDays(now: Date = new Date(), dayStart = '00:00'): WeekDay[] {
  const todayString = deviceDateString(deviceDayWindowStart(now, dayStart))
  const days: WeekDay[] = []
  for (let offset = DAYS_IN_WEEK - 1; offset >= 0; offset--) {
    const dateString = shiftDateString(todayString, -offset)
    days.push({
      dateString,
      date: deviceDayStartOnDate(dateString, dayStart),
      isToday: offset === 0,
    })
  }
  return days
}

/**
 * The UTC ISO bounds (start inclusive, end exclusive) spanning the whole
 * displayed week — from the first day's `day_start` to the end of the current
 * child-day. Used to fetch every event that could overlap the week in one query.
 */
export function weekWindowBounds(
  now: Date = new Date(),
  dayStart = '00:00',
): { startIso: string; endIso: string } {
  const days = weekDays(now, dayStart)
  const startIso = days[0].date.toISOString()
  const { endIso } = deviceDayBounds(now, dayStart)
  return { startIso, endIso }
}
