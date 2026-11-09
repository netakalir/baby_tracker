import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '../../types/database'
import {
  axisLabels,
  buildDayComparison,
  describeDaySummary,
  formatDaySummary,
  minutesToPercent,
  type DayComparison,
} from './dayComparison'

/** A minimal event fixture, defaults filled in for fields the builder ignores. */
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

// Asia/Jerusalem is UTC+3 in June: the 2026-06-10 child-day (midnight
// day_start) runs 2026-06-09T21:00Z → 2026-06-10T21:00Z.
const DAY = '2026-06-10'
const PAST = { isToday: false, now: new Date('2026-06-12T09:00:00.000Z') }

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Jerusalem')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildDayComparison — segments', () => {
  it('places a sleep span in minutes from the day start', () => {
    const day = buildDayComparison(
      [makeEvent({ id: 's1', type: 'sleep', start_time: '2026-06-10T10:00:00.000Z', end_time: '2026-06-10T12:30:00.000Z' })],
      DAY,
      '00:00',
      PAST,
    )
    // 10:00Z = 13:00 local = minute 780; 12:30Z = 15:30 local = minute 930.
    expect(day.segments).toEqual([
      { id: 's1', type: 'sleep', startMinutes: 780, endMinutes: 930, isInstant: false, isOngoing: false },
    ])
    expect(day.sleepMinutes).toBe(150)
  })

  it('clips a cross-midnight sleep to each day it touches', () => {
    // 22:00 local on 06-09 → 06:00 local on 06-10.
    const sleep = makeEvent({ type: 'sleep', start_time: '2026-06-09T19:00:00.000Z', end_time: '2026-06-10T03:00:00.000Z' })

    const evening = buildDayComparison([sleep], '2026-06-09', '00:00', PAST)
    expect(evening.segments[0]).toMatchObject({ startMinutes: 1320, endMinutes: 1440 })
    expect(evening.sleepMinutes).toBe(120)

    const morning = buildDayComparison([sleep], DAY, '00:00', PAST)
    expect(morning.segments[0]).toMatchObject({ startMinutes: 0, endMinutes: 360 })
    expect(morning.sleepMinutes).toBe(360)
  })

  it('honours a non-midnight day_start when clipping', () => {
    // day_start 07:00 → the 06-10 day starts 07:00 local (04:00Z). A sleep
    // 05:00–08:00 local belongs to the previous child-day except its last hour.
    const sleep = makeEvent({ type: 'sleep', start_time: '2026-06-10T02:00:00.000Z', end_time: '2026-06-10T05:00:00.000Z' })
    const day = buildDayComparison([sleep], DAY, '07:00', PAST)
    expect(day.segments[0]).toMatchObject({ startMinutes: 0, endMinutes: 60 })
    expect(day.sleepMinutes).toBe(60)
  })

  it('draws a diaper as an instant and omits mood entirely', () => {
    const day = buildDayComparison(
      [
        makeEvent({ id: 'd1', type: 'diaper', start_time: '2026-06-10T06:00:00.000Z' }),
        makeEvent({ id: 'm1', type: 'mood', start_time: '2026-06-10T07:00:00.000Z' }),
      ],
      DAY,
      '00:00',
      PAST,
    )
    expect(day.segments).toEqual([
      { id: 'd1', type: 'diaper', startMinutes: 540, endMinutes: 540, isInstant: true, isOngoing: false },
    ])
    expect(day.hasEvents).toBe(true)
  })

  it('treats a mood-only day as having nothing to draw', () => {
    const day = buildDayComparison(
      [makeEvent({ type: 'mood', start_time: '2026-06-10T07:00:00.000Z' })],
      DAY,
      '00:00',
      PAST,
    )
    expect(day.hasEvents).toBe(false)
    expect(day.segments).toEqual([])
  })

  it('orders segments sleep → feeding → diaper so short marks draw on top', () => {
    const day = buildDayComparison(
      [
        makeEvent({ type: 'diaper', start_time: '2026-06-10T05:00:00.000Z' }),
        makeEvent({ type: 'feeding', start_time: '2026-06-10T04:00:00.000Z', end_time: '2026-06-10T04:20:00.000Z' }),
        makeEvent({ type: 'sleep', start_time: '2026-06-10T03:00:00.000Z', end_time: '2026-06-10T06:00:00.000Z' }),
      ],
      DAY,
      '00:00',
      PAST,
    )
    expect(day.segments.map((segment) => segment.type)).toEqual(['sleep', 'feeding', 'diaper'])
  })
})

describe('buildDayComparison — running timers', () => {
  const runningSleep = makeEvent({ type: 'sleep', start_time: '2026-06-10T10:00:00.000Z', end_time: null })

  it('extends a running timer to now on the current day', () => {
    const now = new Date('2026-06-10T11:30:00.000Z')
    const day = buildDayComparison([runningSleep], DAY, '00:00', { isToday: true, now })
    expect(day.segments[0]).toMatchObject({ startMinutes: 780, endMinutes: 870, isOngoing: true, isInstant: false })
    expect(day.sleepMinutes).toBe(90)
  })

  it('does not extend a running timer on a past day (matches the read-only clock)', () => {
    const day = buildDayComparison([runningSleep], DAY, '00:00', PAST)
    expect(day.segments[0]).toMatchObject({ startMinutes: 780, endMinutes: 780, isOngoing: false, isInstant: true })
    expect(day.sleepMinutes).toBe(0)
  })

  it('still counts a running feeding that started on the day', () => {
    const feeding = makeEvent({ type: 'feeding', start_time: '2026-06-10T10:00:00.000Z', end_time: null })
    expect(buildDayComparison([feeding], DAY, '00:00', PAST).feedingCount).toBe(1)
  })
})

describe('buildDayComparison — counts', () => {
  it('counts feedings by start day and diapers inside the window', () => {
    const day = buildDayComparison(
      [
        // Started the previous evening, ran past midnight: drawn, not counted.
        makeEvent({ type: 'feeding', start_time: '2026-06-09T20:50:00.000Z', end_time: '2026-06-09T21:20:00.000Z' }),
        makeEvent({ type: 'feeding', start_time: '2026-06-10T03:00:00.000Z', end_time: '2026-06-10T03:20:00.000Z' }),
        makeEvent({ type: 'feeding', start_time: '2026-06-10T08:00:00.000Z', end_time: '2026-06-10T08:15:00.000Z' }),
        makeEvent({ type: 'diaper', start_time: '2026-06-10T04:00:00.000Z' }),
        makeEvent({ type: 'diaper', start_time: '2026-06-10T09:00:00.000Z' }),
        makeEvent({ type: 'diaper', start_time: '2026-06-10T22:00:00.000Z' }), // next day
      ],
      DAY,
      '00:00',
      PAST,
    )
    expect(day.feedingCount).toBe(2)
    expect(day.diaperCount).toBe(2)
    expect(day.segments.filter((segment) => segment.type === 'feeding')).toHaveLength(3)
  })

  it('sums several sleeps', () => {
    const day = buildDayComparison(
      [
        makeEvent({ type: 'sleep', start_time: '2026-06-10T00:00:00.000Z', end_time: '2026-06-10T04:00:00.000Z' }),
        makeEvent({ type: 'sleep', start_time: '2026-06-10T09:00:00.000Z', end_time: '2026-06-10T10:30:00.000Z' }),
      ],
      DAY,
      '00:00',
      PAST,
    )
    expect(day.sleepMinutes).toBe(330)
  })
})

describe('summary formatting', () => {
  function summary(overrides: Partial<DayComparison>): DayComparison {
    return { segments: [], sleepMinutes: 0, feedingCount: 0, diaperCount: 0, hasEvents: true, ...overrides }
  }

  it('formats the agreed compact line', () => {
    expect(formatDaySummary(summary({ sleepMinutes: 810, feedingCount: 5, diaperCount: 3 }))).toBe(
      '13ש׳ 30ד׳ · 5 האכלות · 3 חיתולים',
    )
  })

  it('uses the singular for a count of one and whole hours without minutes', () => {
    expect(formatDaySummary(summary({ sleepMinutes: 120, feedingCount: 1, diaperCount: 1 }))).toBe(
      '2ש׳ · 1 האכלה · 1 חיתול',
    )
  })

  it('shows zero sleep as minutes and rounds fractional minutes', () => {
    expect(formatDaySummary(summary({ sleepMinutes: 0 }))).toBe('0ד׳ · 0 האכלות · 0 חיתולים')
    expect(formatDaySummary(summary({ sleepMinutes: 44.6 }))).toBe('45ד׳ · 0 האכלות · 0 חיתולים')
  })

  it('names sleep explicitly in the screen-reader sentence', () => {
    expect(describeDaySummary(summary({ sleepMinutes: 90, feedingCount: 2, diaperCount: 0 }))).toBe(
      'שינה 1ש׳ 30ד׳, 2 האכלות, 0 חיתולים',
    )
  })
})

describe('geometry helpers', () => {
  it('maps minutes to a clamped percentage of the line', () => {
    expect(minutesToPercent(0)).toBe(0)
    expect(minutesToPercent(720)).toBe(50)
    expect(minutesToPercent(1440)).toBe(100)
    expect(minutesToPercent(-10)).toBe(0)
    expect(minutesToPercent(2000)).toBe(100)
  })

  it('labels the axis every six hours from day_start', () => {
    expect(axisLabels('00:00')).toEqual(['00', '06', '12', '18', '24'])
    expect(axisLabels('07:00')).toEqual(['07', '13', '19', '01', '07'])
    expect(axisLabels('06:30:00')).toEqual(['06:30', '12:30', '18:30', '00:30', '06:30'])
  })
})
