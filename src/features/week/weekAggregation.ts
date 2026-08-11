import type { Event } from '../../types/database'
import { clipEventToDay } from '../today/clock/dayWindow'
import type { WeekDay } from './weekDate'

/** Per-day figures for one child-day of the week. */
export interface DaySummary {
  day: WeekDay
  /**
   * True when the day has at least one event of any type. Drives the
   * empty/gray bar: a day with no data at all must not render a "0" bar that
   * looks like zero sleep (spec §6).
   */
  hasData: boolean
  /** Total sleep for the day, in minutes (active sleep timer included, see below). */
  sleepMinutes: number
  /** Number of feeding events that started on this day (count, not volume/duration). */
  feedingCount: number
}

/** The whole week's per-day summaries plus the derived figures the UI needs. */
export interface WeekSummary {
  days: DaySummary[]
  /** Average sleep per *tracked* day (days with data), in minutes. */
  avgSleepMinutes: number
  /** Total feedings across the week. */
  totalFeedings: number
  /** Largest single-day sleep / feeding values, for scaling each chart. */
  maxSleepMinutes: number
  maxFeedingCount: number
  /** True when no day in the week has any data (drives the whole-week message). */
  isEmpty: boolean
}

/**
 * Aggregates a week's events into per-day sleep minutes and feeding counts (the
 * two primary channels). Diaper and mood remain a Today-screen concern and are
 * only used here to mark a day as having data.
 *
 * - **Sleep** is a duration, split across the days it touches exactly as the
 *   clock does (`clipEventToDay`). An *active* sleep timer (`end_time` null)
 *   counts its elapsed time up to `now`, computed once here (no live ticking) —
 *   `now` is passed in so the value is stable for the render.
 * - **Feeding** is bucketed by the day its `start_time` falls in (one event per
 *   feeding regardless of how long it ran).
 */
export function aggregateWeek(
  events: readonly Event[],
  days: readonly WeekDay[],
  weekEndIso: string,
  dayStart = '00:00',
  now: Date = new Date(),
): WeekSummary {
  const nowIso = now.toISOString()
  const dayStartMs = days.map((day) => day.date.getTime())
  const dayEndMs = days.map((_, index) =>
    index + 1 < days.length ? days[index + 1].date.getTime() : new Date(weekEndIso).getTime(),
  )

  const summaries: DaySummary[] = days.map((day) => ({
    day,
    hasData: false,
    sleepMinutes: 0,
    feedingCount: 0,
  }))

  /** The index of the day an instant falls in, or -1 if outside the week. */
  const dayIndexOf = (instantMs: number): number =>
    dayStartMs.findIndex((start, index) => instantMs >= start && instantMs < dayEndMs[index])

  for (const event of events) {
    if (event.type === 'sleep') {
      const endIso = event.end_time ?? nowIso
      for (let index = 0; index < days.length; index++) {
        const segment = clipEventToDay(event.start_time, endIso, days[index].date, dayStart)
        if (!segment || segment.isPointInTime) continue
        summaries[index].sleepMinutes += segment.endMinutes - segment.startMinutes
        summaries[index].hasData = true
      }
      continue
    }

    // Feeding / diaper / mood are counted once, on their start day. Diaper and
    // mood only mark the day as having data (they are not charted on this screen).
    const index = dayIndexOf(new Date(event.start_time).getTime())
    if (index < 0) continue
    summaries[index].hasData = true

    if (event.type === 'feeding') {
      summaries[index].feedingCount += 1
    }
  }

  let sleepTotal = 0
  let trackedDays = 0
  let totalFeedings = 0
  let maxSleepMinutes = 0
  let maxFeedingCount = 0

  summaries.forEach((summary) => {
    if (summary.hasData) {
      trackedDays += 1
      sleepTotal += summary.sleepMinutes
    }
    totalFeedings += summary.feedingCount
    maxSleepMinutes = Math.max(maxSleepMinutes, summary.sleepMinutes)
    maxFeedingCount = Math.max(maxFeedingCount, summary.feedingCount)
  })

  return {
    days: summaries,
    avgSleepMinutes: trackedDays > 0 ? sleepTotal / trackedDays : 0,
    totalFeedings,
    maxSleepMinutes,
    maxFeedingCount,
    isEmpty: trackedDays === 0,
  }
}
