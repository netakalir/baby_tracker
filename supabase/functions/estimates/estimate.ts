/**
 * Pure estimate computation — no I/O, no external imports — so it is trivially
 * unit-testable and type-checkable offline. The HTTP handler (index.ts) fetches
 * the data through the caller's RLS and hands plain values to these functions.
 *
 * Computation rules (task §2):
 * - Next feeding: if the child has at least PERSONAL_FEEDING_THRESHOLD feedings
 *   on record, predict from the personal average gap between consecutive feeding
 *   START times; otherwise fall back to the age-norm feeding interval. Either way
 *   the prediction is anchored to the most recent feeding start. With no feedings
 *   at all there is nothing to anchor to → not_enough_data.
 * - Next sleep: wake-window model. Anchor to the end of the most recent COMPLETED
 *   sleep and add the age-appropriate wake window. With no completed sleep →
 *   not_enough_data.
 */

import type { AgeNorm } from './ageNorms.ts'
import type { Estimate, EstimateEvent } from './types.ts'

/**
 * Minimum number of feedings required before the personal-average rule is used.
 * Below this the age-norm interval is used instead. (Contract §2: threshold = 3.)
 */
export const PERSONAL_FEEDING_THRESHOLD = 3

const MINUTE_MS = 60_000

function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS)
}

/** Feeding start instants, ascending. */
function feedingStartsAscending(events: readonly EstimateEvent[]): Date[] {
  return events
    .filter((event) => event.type === 'feeding')
    .map((event) => new Date(event.start_time))
    .sort((a, b) => a.getTime() - b.getTime())
}

/** End instants of completed sleeps (end_time not null), ascending. */
function completedSleepEndsAscending(events: readonly EstimateEvent[]): Date[] {
  return events
    .filter((event) => event.type === 'sleep' && event.end_time !== null)
    .map((event) => new Date(event.end_time as string))
    .sort((a, b) => a.getTime() - b.getTime())
}

/** Mean gap in minutes between consecutive instants; NaN-safe (caller guards length). */
function averageGapMinutes(instantsAscending: readonly Date[]): number {
  const gaps: number[] = []
  for (let i = 1; i < instantsAscending.length; i += 1) {
    gaps.push((instantsAscending[i].getTime() - instantsAscending[i - 1].getTime()) / MINUTE_MS)
  }
  const total = gaps.reduce((sum, gap) => sum + gap, 0)
  return total / gaps.length
}

/** Computes the next-feeding estimate from the child's events and their age norm. */
export function computeFeedingEstimate(
  events: readonly EstimateEvent[],
  norm: AgeNorm,
): Estimate {
  const starts = feedingStartsAscending(events)

  if (starts.length === 0) {
    return { status: 'not_enough_data' }
  }

  const lastStart = starts[starts.length - 1]

  if (starts.length >= PERSONAL_FEEDING_THRESHOLD) {
    const intervalMinutes = Math.round(averageGapMinutes(starts))
    return {
      status: 'ready',
      predicted_at: addMinutes(lastStart, intervalMinutes).toISOString(),
      basis: 'personal',
    }
  }

  return {
    status: 'ready',
    predicted_at: addMinutes(lastStart, norm.feeding_interval_minutes).toISOString(),
    basis: 'age_norm',
  }
}

/** Computes the next-sleep estimate from the wake-window model. */
export function computeSleepEstimate(
  events: readonly EstimateEvent[],
  norm: AgeNorm,
): Estimate {
  const sleepEnds = completedSleepEndsAscending(events)

  if (sleepEnds.length === 0) {
    return { status: 'not_enough_data' }
  }

  const lastSleepEnd = sleepEnds[sleepEnds.length - 1]
  return {
    status: 'ready',
    predicted_at: addMinutes(lastSleepEnd, norm.wake_window_minutes).toISOString(),
    basis: 'age_norm',
  }
}
