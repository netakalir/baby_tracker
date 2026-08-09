/**
 * Calendar-week day math for the "Week" screen.
 *
 * A "week" here is a Sunday–Saturday Israeli calendar week (spec §3), not a
 * rolling 7-days-ending-today. A week is identified by the `YYYY-MM-DD` date of
 * its Sunday ("week anchor"), which is what the screen keeps in state and passes
 * to the query so switching weeks reloads only data.
 *
 * The per-day boundary reuses the Today screen's device-timezone, per-child
 * `day_start` helpers, so both screens split a midnight-crossing event the same
 * way.
 */

import {
  deviceDateString,
  deviceDayStartOnDate,
  deviceDayWindowStart,
  shiftDateString,
} from '../today/todayDate'

/** Days per displayed week (Sunday … Saturday). */
export const DAYS_IN_WEEK = 7

/** A single child-day in the displayed week. */
export interface WeekDay {
  /** The device-local calendar date (`YYYY-MM-DD`) this child-day starts on. */
  dateString: string
  /**
   * An instant inside this child-day (its `day_start`), used both as the
   * `displayedDate` when clipping events and as the lower bound when bucketing
   * point events by their start day.
   */
  date: Date
  /** True when this day is the current child-day (only ever in the current week). */
  isToday: boolean
  /** True when this day lies in the future (later than today) — not clickable. */
  isFuture: boolean
}

/** The day-of-week index (Sunday = 0) of a `YYYY-MM-DD` date, tz-independent. */
function weekdayIndex(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** The Sunday (`YYYY-MM-DD`) of the calendar week containing `dateString`. */
export function weekSundayForDate(dateString: string): string {
  return shiftDateString(dateString, -weekdayIndex(dateString))
}

/** The device-local calendar date (`YYYY-MM-DD`) of the child-day containing `now`. */
export function currentChildDateString(now: Date = new Date(), dayStart = '00:00'): string {
  return deviceDateString(deviceDayWindowStart(now, dayStart))
}

/** The Sunday anchor of the week containing `now` — the default week on entry. */
export function currentWeekSunday(now: Date = new Date(), dayStart = '00:00'): string {
  return weekSundayForDate(currentChildDateString(now, dayStart))
}

/** Shifts a week anchor by whole weeks (negative = earlier, positive = later). */
export function shiftWeekSunday(sunday: string, deltaWeeks: number): string {
  return shiftDateString(sunday, deltaWeeks * DAYS_IN_WEEK)
}

/** The seven child-days of the week anchored at `sunday`, Sunday first. */
export function weekDaysForSunday(
  sunday: string,
  dayStart = '00:00',
  now: Date = new Date(),
): WeekDay[] {
  const todayString = currentChildDateString(now, dayStart)
  const days: WeekDay[] = []
  for (let offset = 0; offset < DAYS_IN_WEEK; offset++) {
    const dateString = shiftDateString(sunday, offset)
    days.push({
      dateString,
      date: deviceDayStartOnDate(dateString, dayStart),
      isToday: dateString === todayString,
      isFuture: dateString > todayString,
    })
  }
  return days
}

/**
 * The UTC ISO bounds (start inclusive, end exclusive) of the week anchored at
 * `sunday` — from Sunday's `day_start` to the following Sunday's `day_start`.
 * Used to fetch every event overlapping the week in one query.
 */
export function weekBounds(sunday: string, dayStart = '00:00'): { startIso: string; endIso: string } {
  const startIso = deviceDayStartOnDate(sunday, dayStart).toISOString()
  const endIso = deviceDayStartOnDate(shiftWeekSunday(sunday, 1), dayStart).toISOString()
  return { startIso, endIso }
}

/** True while there is a later week to show (never past the current week). */
export function canGoToNextWeek(sunday: string, now: Date = new Date(), dayStart = '00:00'): boolean {
  return sunday < currentWeekSunday(now, dayStart)
}

/**
 * True while there is an earlier week to show — i.e. not before the week the
 * selected child was created in (`children.created_at`); no data can predate it.
 */
export function canGoToPrevWeek(sunday: string, createdAtIso: string, dayStart = '00:00'): boolean {
  const createdChildDate = currentChildDateString(new Date(createdAtIso), dayStart)
  return sunday > weekSundayForDate(createdChildDate)
}

const rangeDayFormatter = new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', day: 'numeric' })
const rangeMonthFormatter = new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', month: 'long' })

/** A `YYYY-MM-DD` date as a noon-UTC Date, safe for month/day label formatting. */
function labelDate(dateString: string): Date {
  return new Date(`${dateString}T12:00:00Z`)
}

/**
 * The week's displayed date range, e.g. "16-22 ביוני" within one month, or
 * "29 במאי - 4 ביוני" across a month boundary.
 */
export function weekRangeLabel(sunday: string): string {
  const saturday = shiftDateString(sunday, DAYS_IN_WEEK - 1)
  const start = labelDate(sunday)
  const end = labelDate(saturday)
  const startDay = rangeDayFormatter.format(start)
  const endDay = rangeDayFormatter.format(end)
  const startMonth = rangeMonthFormatter.format(start)
  const endMonth = rangeMonthFormatter.format(end)

  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ב${endMonth}`
  }
  return `${startDay} ב${startMonth} - ${endDay} ב${endMonth}`
}
