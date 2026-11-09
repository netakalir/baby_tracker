import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMPARE_RANGE_DAYS,
  defaultSelectedDates,
  formatRowLabel,
  selectableDates,
  toggleDate,
} from './compareDate'

// 2026-06-10 12:00 in Asia/Jerusalem (UTC+3).
const NOW = new Date('2026-06-10T09:00:00.000Z')
const LONG_AGO = '2026-01-01T00:00:00.000Z'

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Jerusalem')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('selectableDates', () => {
  it('lists the last 14 child-days, oldest first, ending today', () => {
    const dates = selectableDates(LONG_AGO, '00:00', NOW)
    expect(dates).toHaveLength(COMPARE_RANGE_DAYS)
    expect(dates[0]).toBe('2026-05-28')
    expect(dates.at(-1)).toBe('2026-06-10')
  })

  it('never offers a day before the child was created', () => {
    // Created 2026-06-08 10:00 local.
    const dates = selectableDates('2026-06-08T07:00:00.000Z', '00:00', NOW)
    expect(dates).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })

  it('applies day_start to "today" and to the creation floor', () => {
    // 05:00 local is still the previous child-day with a 07:00 day_start.
    const earlyMorning = new Date('2026-06-10T02:00:00.000Z')
    const dates = selectableDates('2026-06-09T02:00:00.000Z', '07:00', earlyMorning)
    expect(dates).toEqual(['2026-06-08', '2026-06-09'])
  })
})

describe('defaultSelectedDates', () => {
  it('selects today and yesterday', () => {
    expect(defaultSelectedDates(['2026-06-08', '2026-06-09', '2026-06-10'])).toEqual([
      '2026-06-09',
      '2026-06-10',
    ])
  })

  it('selects only today for a child created today', () => {
    expect(defaultSelectedDates(['2026-06-10'])).toEqual(['2026-06-10'])
  })
})

describe('toggleDate', () => {
  const dates = ['2026-06-08', '2026-06-09', '2026-06-10']

  it('adds a day, keeping chronological order regardless of tap order', () => {
    expect(toggleDate(['2026-06-10'], '2026-06-08', dates)).toEqual(['2026-06-08', '2026-06-10'])
  })

  it('removes an already-selected day, down to an empty selection', () => {
    expect(toggleDate(['2026-06-10'], '2026-06-10', dates)).toEqual([])
  })
})

describe('formatRowLabel', () => {
  it('uses relative labels for today and yesterday, the full date otherwise', () => {
    expect(formatRowLabel('2026-06-10', '2026-06-10')).toBe('היום')
    expect(formatRowLabel('2026-06-09', '2026-06-10')).toBe('אתמול')
    expect(formatRowLabel('2026-06-07', '2026-06-10')).toBe('יום ראשון, 7 ביוני')
  })
})
