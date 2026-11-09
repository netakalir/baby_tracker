/**
 * Pure segment + summary computation for one Day-comparison row.
 *
 * Each selected child-day becomes a horizontal 24-hour line. Every event is a
 * segment of the same thickness; event types differ only by color:
 *  - sleep / feeding span their duration, clipped to the day window exactly as
 *    the Today clock clips them (`clipEventToDay`), so a midnight-crossing sleep
 *    splits across both days' rows;
 *  - diaper is an instant (zero-length; the row gives it a minimum visible width);
 *  - mood is deliberately not shown.
 *
 * A still-running timer (no `end_time`) is running *now*, so on every row it
 * is extended to `now` and clipped to that row's window: on the day it started
 * (if that day is already over) it fills to the day's end, and on today's row
 * it stops at `now`. Only the row where the clip is not clamped by the day's
 * end — i.e. the row containing `now` — draws it as ongoing (open leading
 * edge). This keeps a past row's sleep total right for an overnight sleep that
 * is still running (e.g. started 20:00, still asleep at 03:00), and keeps the
 * line intact when the day rolls over with the screen open.
 */

import type { Event, EventType } from '../../types/database'
import { clipEventToDay, MINUTES_IN_DAY } from '../today/clock/dayWindow'
import { formatMinutesDuration } from '../today/clock/timeFormat'
import { deviceDayStartOnDate, parseDayStartMinutes } from '../today/todayDate'

/** The event types drawn on a comparison row (mood is intentionally excluded). */
export type TimelineEventType = Exclude<EventType, 'mood'>

/**
 * Draw order, bottom to top: long sleep spans first, so the shorter feeding
 * spans and diaper instants stay visible where they overlap a sleep.
 */
const DRAW_ORDER: readonly TimelineEventType[] = ['sleep', 'feeding', 'diaper']

/** One drawable segment on a row, in minutes from the day's `day_start`. */
export interface TimelineSegment {
  readonly id: string
  readonly type: TimelineEventType
  /** Clamped to [0, 1440]. */
  readonly startMinutes: number
  /** Clamped to [0, 1440]; equals `startMinutes` for an instant. */
  readonly endMinutes: number
  /** A point-in-time mark (a diaper). */
  readonly isInstant: boolean
  /** A timer still running whose line on this row ends at `now` (not at the day's end). */
  readonly isOngoing: boolean
}

/** Everything a comparison row needs for one child-day. */
export interface DayComparison {
  readonly segments: readonly TimelineSegment[]
  /** Total sleep inside the day window, in minutes (a running sleep counts up to `now`, clipped to the day). */
  readonly sleepMinutes: number
  /** Feedings that started inside the day window. */
  readonly feedingCount: number
  /** Diapers logged inside the day window. */
  readonly diaperCount: number
  /** True when the row has at least one drawable (non-mood) event. */
  readonly hasEvents: boolean
}

/** Duration events are sleep and feeding — the two timer types. */
function isDurationType(type: TimelineEventType): type is 'sleep' | 'feeding' {
  return type === 'sleep' || type === 'feeding'
}

/**
 * Builds the segments and the summary figures for one child-day.
 *
 * @param events     the child's events overlapping the day (as `fetchEventsForDate` returns them)
 * @param dateString the device-local calendar date (`YYYY-MM-DD`) of the child-day
 * @param dayStart   the child's `day_start` ('HH:MM'), the day window's start
 * @param now        the current instant, which a still-running timer is drawn up to
 */
export function buildDayComparison(
  events: readonly Event[],
  dateString: string,
  dayStart: string,
  now: Date,
): DayComparison {
  const dayDate = deviceDayStartOnDate(dateString, dayStart)
  const nowIso = now.toISOString()
  const segments: TimelineSegment[] = []
  let sleepMinutes = 0
  let feedingCount = 0
  let diaperCount = 0

  for (const event of events) {
    const type = event.type
    if (type === 'mood') continue

    if (!isDurationType(type)) {
      // Diaper: an instant at its start, counted only if it falls in this day.
      const segment = clipEventToDay(event.start_time, null, dayDate, dayStart)
      if (!segment) continue
      diaperCount += 1
      segments.push({
        id: event.id,
        type,
        startMinutes: segment.startMinutes,
        endMinutes: segment.startMinutes,
        isInstant: true,
        isOngoing: false,
      })
      continue
    }

    // `type` is already narrowed to a timer type, so "running" is just a
    // missing `end_time` — the same rule as `isRunningTimerEvent`, inlined so
    // this pure module stays free of the Supabase-backed `api` import.
    const isRunning = event.end_time === null
    const segment = clipEventToDay(
      event.start_time,
      isRunning ? nowIso : event.end_time,
      dayDate,
      dayStart,
    )
    if (!segment) continue
    // Ongoing on this row only when its line stops at `now`, not at the day's end.
    const isOngoing = isRunning && segment.endMinutes < MINUTES_IN_DAY

    segments.push({
      id: event.id,
      type,
      startMinutes: segment.startMinutes,
      endMinutes: segment.endMinutes,
      isInstant: segment.isPointInTime,
      isOngoing,
    })

    if (type === 'sleep') {
      sleepMinutes += segment.endMinutes - segment.startMinutes
    } else if (startsInsideDay(event.start_time, dayDate, dayStart)) {
      // A feeding is counted once, on the day it started (like the Week chart),
      // even when it runs past the boundary into the next day's row.
      feedingCount += 1
    }
  }

  segments.sort((a, b) => DRAW_ORDER.indexOf(a.type) - DRAW_ORDER.indexOf(b.type))

  return {
    segments,
    sleepMinutes,
    feedingCount,
    diaperCount,
    hasEvents: segments.length > 0,
  }
}

/** True when `startIso` falls inside the child-day containing `dayDate`. */
function startsInsideDay(startIso: string, dayDate: Date, dayStart: string): boolean {
  return clipEventToDay(startIso, null, dayDate, dayStart) !== null
}

/** "1 האכלה" / "5 האכלות" — a count with the matching Hebrew singular/plural noun. */
function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** The visible summary under a row, e.g. "13ש׳ 30ד׳ · 5 האכלות · 3 חיתולים". */
export function formatDaySummary(day: DayComparison): string {
  return [
    formatMinutesDuration(day.sleepMinutes),
    countLabel(day.feedingCount, 'האכלה', 'האכלות'),
    countLabel(day.diaperCount, 'חיתול', 'חיתולים'),
  ].join(' · ')
}

/**
 * The same summary as a screen-reader sentence, naming the sleep figure
 * explicitly (the compact visible line leaves it implicit).
 */
export function describeDaySummary(day: DayComparison): string {
  return [
    `שינה ${formatMinutesDuration(day.sleepMinutes)}`,
    countLabel(day.feedingCount, 'האכלה', 'האכלות'),
    countLabel(day.diaperCount, 'חיתול', 'חיתולים'),
  ].join(', ')
}

/** A position along the 24-hour line as a percentage of its length, clamped to [0, 100]. */
export function minutesToPercent(minutes: number): number {
  return (Math.min(Math.max(minutes, 0), MINUTES_IN_DAY) / MINUTES_IN_DAY) * 100
}

/** The number of hour-axis labels: every six hours, both ends included (00/06/12/18/24). */
const AXIS_STEPS = 4

/**
 * The shared hour-axis labels, one every six hours from the day's start to its
 * end. With a midnight `day_start` this is "00", "06", "12", "18", "24"; with
 * another boundary the wall-clock times shift with it (e.g. 07:00 →
 * "07", "13", "19", "01", "07"), mirroring how the Today clock offsets its dial.
 */
export function axisLabels(dayStart = '00:00'): string[] {
  const dayStartMinutes = parseDayStartMinutes(dayStart)
  const labels: string[] = []
  for (let step = 0; step <= AXIS_STEPS; step++) {
    const totalMinutes = dayStartMinutes + (step * MINUTES_IN_DAY) / AXIS_STEPS
    const isEndOfMidnightDay = dayStartMinutes === 0 && step === AXIS_STEPS
    const hour = isEndOfMidnightDay ? 24 : Math.floor(totalMinutes / 60) % 24
    const minute = totalMinutes % 60
    const hh = String(hour).padStart(2, '0')
    labels.push(minute === 0 ? hh : `${hh}:${String(minute).padStart(2, '0')}`)
  }
  return labels
}
