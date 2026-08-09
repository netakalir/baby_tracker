import type { Event } from '../../types/database'
import { clipEventToDay } from '../today/clock/dayWindow'
import type { WeekDay } from './weekDate'

/**
 * The two *duration* event types the week chart plots. Diaper and mood are
 * point-in-time (no duration), so they are deliberately excluded from the bars —
 * the chart is a "how much did the baby sleep / feed" view, per the project's
 * "feeding/sleep across the week" framing.
 */
type ChartedType = 'sleep' | 'feeding'

/** Per-day tracked minutes, split by charted type. */
export interface DayTotals {
  day: WeekDay
  sleepMinutes: number
  feedingMinutes: number
}

/** Aggregated week totals plus the derived figures the summary tiles show. */
export interface WeekTotals {
  days: DayTotals[]
  totalSleepMinutes: number
  totalFeedingMinutes: number
  /** The largest single-day (sleep + feeding) total, for scaling the bars. */
  maxDayMinutes: number
  /** True when no charted duration was tracked all week (drives the empty state). */
  isEmpty: boolean
}

/**
 * Splits each event across the week's days (clipping overnight/cross-boundary
 * events to each day it touches, exactly as the clock does) and sums the
 * duration per day and type. Point-in-time events contribute nothing.
 */
export function aggregateWeek(
  events: readonly Event[],
  days: readonly WeekDay[],
  dayStart = '00:00',
): WeekTotals {
  const dayTotals: DayTotals[] = days.map((day) => ({
    day,
    sleepMinutes: 0,
    feedingMinutes: 0,
  }))

  for (const event of events) {
    if (event.type !== 'sleep' && event.type !== 'feeding') continue
    const type: ChartedType = event.type

    for (const totals of dayTotals) {
      const segment = clipEventToDay(event.start_time, event.end_time, totals.day.date, dayStart)
      if (!segment || segment.isPointInTime) continue

      const minutes = segment.endMinutes - segment.startMinutes
      if (type === 'sleep') totals.sleepMinutes += minutes
      else totals.feedingMinutes += minutes
    }
  }

  let totalSleepMinutes = 0
  let totalFeedingMinutes = 0
  let maxDayMinutes = 0
  for (const totals of dayTotals) {
    totalSleepMinutes += totals.sleepMinutes
    totalFeedingMinutes += totals.feedingMinutes
    maxDayMinutes = Math.max(maxDayMinutes, totals.sleepMinutes + totals.feedingMinutes)
  }

  return {
    days: dayTotals,
    totalSleepMinutes,
    totalFeedingMinutes,
    maxDayMinutes,
    isEmpty: totalSleepMinutes === 0 && totalFeedingMinutes === 0,
  }
}
