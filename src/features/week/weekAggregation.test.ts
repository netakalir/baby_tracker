import { describe, expect, it } from 'vitest'
import type { Event } from '../../types/database'
import { aggregateWeek } from './weekAggregation'
import { weekBounds, weekDaysForSunday } from './weekDate'

/** A minimal event fixture, defaults filled in for fields the aggregator ignores. */
function makeEvent(overrides: Partial<Event> & Pick<Event, 'type' | 'start_time'>): Event {
  return {
    id: `evt-${Math.random()}`,
    child_id: 'child-1',
    end_time: null,
    created_by: 'user-1',
    metadata: null,
    created_at: overrides.start_time,
    ...overrides,
  }
}

const SUNDAY = '2026-06-07' // a Sunday
const PAST_SUNDAY = '2026-05-24' // a fully-past week (relative to NOW below)
const NOW = new Date('2026-06-10T12:00:00.000Z') // Wednesday of the SUNDAY week

function currentWeek(dayStart = '00:00') {
  const days = weekDaysForSunday(SUNDAY, dayStart, NOW)
  const { endIso } = weekBounds(SUNDAY, dayStart)
  return { days, endIso }
}

function pastWeek(dayStart = '00:00') {
  const days = weekDaysForSunday(PAST_SUNDAY, dayStart, NOW)
  const { endIso } = weekBounds(PAST_SUNDAY, dayStart)
  return { days, endIso }
}

describe('aggregateWeek — sleep average denominator (CR A1)', () => {
  it('divides the sleep average by days that HAVE sleep, not by every day with any data', () => {
    const { days, endIso } = currentWeek()
    const events: Event[] = [
      // Sunday: 2h sleep.
      makeEvent({ type: 'sleep', start_time: '2026-06-07T10:00:00.000Z', end_time: '2026-06-07T12:00:00.000Z' }),
      // Monday: feeding only, no sleep.
      makeEvent({ type: 'feeding', start_time: '2026-06-08T09:00:00.000Z' }),
      // Tuesday: 4h sleep.
      makeEvent({ type: 'sleep', start_time: '2026-06-09T01:00:00.000Z', end_time: '2026-06-09T05:00:00.000Z' }),
    ]

    const summary = aggregateWeek(events, days, endIso, '00:00', NOW)

    // Total sleep = 6h across 2 sleep-days -> average 3h/day, NOT 6h/3-tracked-days = 2h/day.
    expect(summary.sleepDaysCount).toBe(2)
    expect(summary.avgSleepMinutes).toBe(180)
  })
})

describe('aggregateWeek — per-channel "has data" (CR Dw-3)', () => {
  it('marks a sleep-only day as having no feeding data, and vice versa', () => {
    const { days, endIso } = currentWeek()
    const events: Event[] = [
      makeEvent({ type: 'sleep', start_time: '2026-06-07T10:00:00.000Z', end_time: '2026-06-07T12:00:00.000Z' }),
      makeEvent({ type: 'feeding', start_time: '2026-06-08T09:00:00.000Z' }),
    ]

    const summary = aggregateWeek(events, days, endIso, '00:00', NOW)
    const sunday = summary.days[0]
    const monday = summary.days[1]

    expect(sunday.hasSleepData).toBe(true)
    expect(sunday.hasFeedingData).toBe(false)
    expect(sunday.hasData).toBe(true)

    expect(monday.hasFeedingData).toBe(true)
    expect(monday.hasSleepData).toBe(false)
    expect(monday.hasData).toBe(true)
  })
})

describe('aggregateWeek — active timer bounded to the week (CR Dw-4)', () => {
  it('does not let a still-running timer overfill days of a PAST week', () => {
    const { days, endIso } = pastWeek()
    // Started on the past week's Sunday and never ended (still running as of NOW,
    // which is weeks later) — must not be treated as sleeping through every
    // subsequent day of that already-finished week.
    const events: Event[] = [
      makeEvent({ type: 'sleep', start_time: '2026-05-24T22:00:00.000Z', end_time: null }),
    ]

    const summary = aggregateWeek(events, days, endIso, '00:00', NOW)

    // Total sleep across the past week must be bounded by the week's own
    // length, not by the (much larger) elapsed time to the real "now".
    const totalMinutes = summary.days.reduce((sum, day) => sum + day.sleepMinutes, 0)
    expect(totalMinutes).toBeLessThanOrEqual(7 * 24 * 60)
    // Sanity: it did add substantial sleep, it's just capped, not zeroed.
    expect(totalMinutes).toBeGreaterThan(0)
  })

  it('still extends a running timer up to "now" within the CURRENT week', () => {
    const { days, endIso } = currentWeek()
    const events: Event[] = [
      // Started 2h before NOW (Wed 10:00 UTC), still running.
      makeEvent({ type: 'sleep', start_time: '2026-06-10T10:00:00.000Z', end_time: null }),
    ]

    const summary = aggregateWeek(events, days, endIso, '00:00', NOW)
    const wednesday = summary.days[3]
    expect(wednesday.sleepMinutes).toBe(120)
  })
})
