import type { Event } from '../../types/database'
import { clipEventToDay } from '../today/clock/dayWindow'
import type { WeekDay } from './weekDate'

/** Per-day figures for one child-day of the week. */
export interface DaySummary {
  day: WeekDay
  /**
   * True when the day has at least one event of any type. Drives the
   * whole-week empty message (spec §6) — it is NOT the right flag for a single
   * chart's gray track, since a day can have data in one channel and none in
   * the other (see `hasSleepData` / `hasFeedingData`).
   */
  hasData: boolean
  /**
   * True when the day has at least one sleep event. Drives the sleep chart's
   * empty/gray bar so a day with only feeding logged doesn't render as "0
   * sleep" (spec §6).
   */
  hasSleepData: boolean
  /**
   * True when the day has at least one feeding event. Drives the feeding
   * chart's empty/gray bar so a day with only sleep logged doesn't render as
   * "0 feedings" (spec §6).
   */
  hasFeedingData: boolean
  /** Total sleep for the day, in minutes (active sleep timer included, see below). */
  sleepMinutes: number
  /** Number of feeding events that started on this day (count, not volume/duration). */
  feedingCount: number
}

/** The whole week's per-day summaries plus the derived figures the UI needs. */
export interface WeekSummary {
  days: DaySummary[]
  /** Average sleep per day that actually has sleep logged, in minutes. */
  avgSleepMinutes: number
  /** Number of days the average sleep is based on (days with sleep logged), for display. */
  sleepDaysCount: number
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
 *   counts its elapsed time up to `now` (or the week's own end, whichever is
 *   earlier — a still-running timer must never be assumed to fill days of a
 *   PAST week that already happened), computed once here (no live ticking) —
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
  const weekEndMs = new Date(weekEndIso).getTime()
  // Bound an active timer's effective "now" to the week's own end: for a past
  // week this is `weekEndIso` (the timer's true, still-unknown end must not be
  // treated as reaching into days that already happened), for the current week
  // it's the real `now`.
  const activeEndIso = now.getTime() < weekEndMs ? now.toISOString() : weekEndIso
  const dayStartMs = days.map((day) => day.date.getTime())
  const dayEndMs = days.map((_, index) =>
    index + 1 < days.length ? days[index + 1].date.getTime() : new Date(weekEndIso).getTime(),
  )

  const summaries: DaySummary[] = days.map((day) => ({
    day,
    hasData: false,
    hasSleepData: false,
    hasFeedingData: false,
    sleepMinutes: 0,
    feedingCount: 0,
  }))

  /** The index of the day an instant falls in, or -1 if outside the week. */
  const dayIndexOf = (instantMs: number): number =>
    dayStartMs.findIndex((start, index) => instantMs >= start && instantMs < dayEndMs[index])

  for (const event of events) {
    if (event.type === 'sleep') {
      const endIso = event.end_time ?? activeEndIso
      for (let index = 0; index < days.length; index++) {
        const segment = clipEventToDay(event.start_time, endIso, days[index].date, dayStart)
        if (!segment || segment.isPointInTime) continue
        summaries[index].sleepMinutes += segment.endMinutes - segment.startMinutes
        summaries[index].hasData = true
        summaries[index].hasSleepData = true
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
      summaries[index].hasFeedingData = true
    }
  }

  let sleepTotal = 0
  let trackedDays = 0
  let sleepDaysCount = 0
  let totalFeedings = 0
  let maxSleepMinutes = 0
  let maxFeedingCount = 0

  summaries.forEach((summary) => {
    if (summary.hasData) {
      trackedDays += 1
    }
    // The sleep average is diluted if divided by every tracked day — a day
    // with only a feeding logged and no sleep is not "0 hours of sleep", it's
    // unknown. Divide by days that actually have sleep logged instead.
    if (summary.hasSleepData) {
      sleepDaysCount += 1
      sleepTotal += summary.sleepMinutes
    }
    totalFeedings += summary.feedingCount
    maxSleepMinutes = Math.max(maxSleepMinutes, summary.sleepMinutes)
    maxFeedingCount = Math.max(maxFeedingCount, summary.feedingCount)
  })

  return {
    days: summaries,
    avgSleepMinutes: sleepDaysCount > 0 ? sleepTotal / sleepDaysCount : 0,
    sleepDaysCount,
    totalFeedings,
    maxSleepMinutes,
    maxFeedingCount,
    isEmpty: trackedDays === 0,
  }
}
