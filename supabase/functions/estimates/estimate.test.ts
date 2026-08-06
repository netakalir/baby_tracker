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

function feeding(startIso: string): EstimateEvent {
  return { type: 'feeding', start_time: startIso, end_time: null }
}

function sleep(startIso: string, endIso: string | null): EstimateEvent {
  return { type: 'sleep', start_time: startIso, end_time: endIso }
}

Deno.test('feeding: no feedings → not_enough_data', () => {
  const result = computeFeedingEstimate([], norm)
  assertEquals(result.status, 'not_enough_data')
})

Deno.test('feeding: below threshold → age-norm fallback anchored to last feed', () => {
  const events = [feeding('2026-08-05T06:00:00.000Z'), feeding('2026-08-05T09:00:00.000Z')]
  const result = computeFeedingEstimate(events, norm)
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
  const result = computeFeedingEstimate(events, norm)
  assertEquals(result.status, 'ready')
  if (result.status !== 'ready') return
  assertEquals(result.basis, 'personal')
  // last feed 11:00 + 150min avg = 13:30
  assertEquals(result.predicted_at, '2026-08-05T13:30:00.000Z')
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
