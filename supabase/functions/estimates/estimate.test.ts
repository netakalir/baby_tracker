/**
 * Unit tests for the pure estimate computation. No network or Supabase needed —
 * run with `deno test` from `supabase/functions/estimates/`.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  computeFeedingEstimate,
  computeSleepEstimate,
  PERSONAL_FEEDING_THRESHOLD,
} from './estimate.ts'
import { normForAge } from './ageNorms.ts'
import type { EstimateEvent } from './types.ts'

const norm = normForAge(3)

/** Fixed "now" a little after the test fixtures' last feed, inside the 7-day window. */
const NOW = new Date('2026-08-05T14:00:00.000Z')

function feeding(startIso: string): EstimateEvent {
  return { type: 'feeding', start_time: startIso, end_time: null }
}

function sleep(startIso: string, endIso: string | null): EstimateEvent {
  return { type: 'sleep', start_time: startIso, end_time: endIso }
}

Deno.test('feeding: no feedings → not_enough_data', () => {
  const result = computeFeedingEstimate([], norm, NOW)
  assertEquals(result.status, 'not_enough_data')
})

Deno.test('feeding: below threshold → age-norm fallback anchored to last feed', () => {
  const events = [feeding('2026-08-05T06:00:00.000Z'), feeding('2026-08-05T09:00:00.000Z')]
  const result = computeFeedingEstimate(events, norm, NOW)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'age_norm')
  // last feed 09:00 + 180min (2-4mo norm) = 12:00
  assertEquals(result.predicted_at, '2026-08-05T12:00:00.000Z')
})

Deno.test('feeding: at/above threshold → personal average of start gaps', () => {
  // gaps: 180 and 120 minutes → average 150
  const events = [
    feeding('2026-08-05T06:00:00.000Z'),
    feeding('2026-08-05T09:00:00.000Z'),
    feeding('2026-08-05T11:00:00.000Z'),
  ]
  assertEquals(events.length >= PERSONAL_FEEDING_THRESHOLD, true)
  const result = computeFeedingEstimate(events, norm, NOW)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'personal')
  // last feed 11:00 + 150min avg = 13:30
  assertEquals(result.predicted_at, '2026-08-05T13:30:00.000Z')
})

Deno.test('feeding: multi-day/overnight gap is excluded from the personal average', () => {
  // A ~21h overnight-plus gap (09:00 prev day → 06:00) would, if averaged in,
  // pull the interval to ~8h. With the age-scaled ceiling (2×180=360min) that
  // gap is dropped, leaving the two real 180/120 gaps → average 150.
  const events = [
    feeding('2026-08-04T09:00:00.000Z'),
    feeding('2026-08-05T06:00:00.000Z'), // 21h gap → dropped as a data gap
    feeding('2026-08-05T09:00:00.000Z'), // 180min
    feeding('2026-08-05T11:00:00.000Z'), // 120min
  ]
  const result = computeFeedingEstimate(events, norm, NOW)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'personal')
  // last feed 11:00 + 150min avg = 13:30 (NOT skewed later by the 21h gap)
  assertEquals(result.predicted_at, '2026-08-05T13:30:00.000Z')
})

Deno.test('feeding: feedings older than the recent window do not skew the average', () => {
  // Two feeds from ~40 days ago plus three recent feeds. Only the recent gaps
  // (180/120 → avg 150) count; the ancient ones are outside FEEDING_WINDOW_DAYS.
  const events = [
    feeding('2026-06-26T06:00:00.000Z'),
    feeding('2026-06-26T12:00:00.000Z'),
    feeding('2026-08-05T06:00:00.000Z'),
    feeding('2026-08-05T09:00:00.000Z'),
    feeding('2026-08-05T11:00:00.000Z'),
  ]
  const result = computeFeedingEstimate(events, norm, NOW)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'personal')
  assertEquals(result.predicted_at, '2026-08-05T13:30:00.000Z')
})

Deno.test('feeding: ≥3 recent feeds but every gap is a data gap → age-norm fallback', () => {
  // Three feeds each separated by ~24h (all above the 360min ceiling). No
  // plausible gap survives, so we fall back to the age norm anchored to the last.
  const events = [
    feeding('2026-08-03T11:00:00.000Z'),
    feeding('2026-08-04T11:00:00.000Z'),
    feeding('2026-08-05T11:00:00.000Z'),
  ]
  const result = computeFeedingEstimate(events, norm, NOW)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'age_norm')
  // last feed 11:00 + 180min norm = 14:00
  assertEquals(result.predicted_at, '2026-08-05T14:00:00.000Z')
})

Deno.test('sleep: no completed sleep → not_enough_data', () => {
  const result = computeSleepEstimate([sleep('2026-08-05T10:00:00.000Z', null)], norm)
  assertEquals(result.status, 'not_enough_data')
})

Deno.test('sleep: wake window added to last completed sleep end', () => {
  const events = [sleep('2026-08-05T10:00:00.000Z', '2026-08-05T11:00:00.000Z')]
  const result = computeSleepEstimate(events, norm)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'age_norm')
  // sleep ended 11:00 + 75min (2-4mo norm) = 12:15
  assertEquals(result.predicted_at, '2026-08-05T12:15:00.000Z')
})
