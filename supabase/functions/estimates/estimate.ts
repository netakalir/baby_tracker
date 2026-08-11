/**
 * Pure estimate computation — no I/O, no external imports — so it is trivially
 * unit-testable and type-checkable offline. The HTTP handler (index.ts) fetches
 * the data through the caller's RLS and hands plain values to these functions.
 *
 * Computation rules (task §2 + estimate-contract.md §2 — "recent history"):
 * - Next feeding: average the gaps between consecutive feeding START times, but
 *   only over a RECENT WINDOW and only for PHYSIOLOGICALLY PLAUSIBLE gaps. Two
 *   filters keep the average honest (see the bug note below):
 *     1. Recent window — only feedings in the last FEEDING_WINDOW_DAYS days count,
 *        so stale months-old cadence can't drag the estimate.
 *     2. Outlier cap — gaps longer than an age-scaled ceiling are dropped as
 *        missing-data artifacts, not real feeding cadence.
 *   If, after filtering, the child still has at least PERSONAL_FEEDING_THRESHOLD
 *   recent feedings AND at least one plausible gap, predict from the personal
 *   average; otherwise fall back to the age-norm feeding interval. Either way the
 *   prediction is anchored to the most recent feeding start. With no feedings at
 *   all there is nothing to anchor to → not_enough_data.
 * - Next sleep: wake-window model. Anchor to the end of the most recent COMPLETED
 *   sleep and add the age-appropriate wake window. With no completed sleep →
 *   not_enough_data.
 *
 * BUG FIX (next-feeding average skewed by multi-day gaps): the previous version
 * averaged the gaps between EVERY feeding on record. A single overnight stretch —
 * or a day with no logging at all — injected a huge gap (e.g. 18–30h) that pulled
 * the "next feeding" prediction far into the future, even when the recent cadence
 * was every ~3h. A baby is not fed on a continuous multi-hour cadence across a
 * whole night/day, so such gaps are not part of the feeding rhythm; they are gaps
 * in the DATA. We therefore (a) look only at recent feedings and (b) discard any
 * gap above `feedingGapCeilingMinutes(norm)` — twice the age-appropriate feeding
 * interval. The ceiling is age-scaled (so it widens correctly as older babies
 * genuinely space feeds out) yet still excludes the multi-day gaps that caused the
 * bug.
 */

import type { AgeNorm } from './ageNorms.ts'
import type { Estimate, EstimateEvent } from './types.ts'

/**
 * Minimum number of feedings required before the personal-average rule is used.
 * Below this the age-norm interval is used instead. (Contract §2: threshold = 3.)
 */
export const PERSONAL_FEEDING_THRESHOLD = 3

/**
 * Recent-history window for the personal feeding average. Feedings older than this
 * (relative to `now`) do not contribute — matching estimate-contract.md §2, which
 * says the last ~7 days is enough. Keeps the average reflective of the CURRENT
 * cadence rather than the child's whole lifetime.
 */
export const FEEDING_WINDOW_DAYS = 7

/**
 * Multiplier applied to the age-appropriate feeding interval to get the maximum
 * gap that still counts as a real feed-to-feed interval. Anything longer is
 * treated as a data gap (an un-logged night/day) and dropped from the average.
 * Two intervals is a defensible ceiling: it tolerates a normal long overnight
 * stretch (which is ~2x a daytime gap) while excluding the multi-hour/day gaps
 * that skewed the estimate.
 */
export const FEEDING_GAP_CEILING_FACTOR = 2

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS)
}

/** Age-scaled maximum gap (minutes) that still counts as a real feeding interval. */
function feedingGapCeilingMinutes(norm: AgeNorm): number {
  return norm.feeding_interval_minutes * FEEDING_GAP_CEILING_FACTOR
}

/** Feeding start instants, ascending. */
function feedingStartsAscending(events: readonly EstimateEvent[]): Date[] {
  return events
    .filter((event) => event.type === 'feeding')
    .map((event) => new Date(event.start_time))
    .sort((a, b) => a.getTime() - b.getTime())
}

/** Keeps only instants within `windowDays` before (and including) `now`. */
function withinRecentWindow(instantsAscending: readonly Date[], now: Date, windowDays: number): Date[] {
  const cutoff = now.getTime() - windowDays * DAY_MS
  return instantsAscending.filter((instant) => instant.getTime() >= cutoff)
}

/** End instants of completed sleeps (end_time not null), ascending. */
function completedSleepEndsAscending(events: readonly EstimateEvent[]): Date[] {
  return events
    .filter((event) => event.type === 'sleep' && event.end_time !== null)
    .map((event) => new Date(event.end_time as string))
    .sort((a, b) => a.getTime() - b.getTime())
}

/**
 * Consecutive-gap durations (minutes) between ascending instants, keeping only
 * gaps at or below `ceilingMinutes`. Gaps above the ceiling are dropped as
 * missing-data artifacts (see the module header's bug note).
 */
function plausibleGapsMinutes(instantsAscending: readonly Date[], ceilingMinutes: number): number[] {
  const gaps: number[] = []
  for (let i = 1; i < instantsAscending.length; i += 1) {
    const gap = (instantsAscending[i].getTime() - instantsAscending[i - 1].getTime()) / MINUTE_MS
    if (gap <= ceilingMinutes) {
      gaps.push(gap)
    }
  }
  return gaps
}

/** Mean of a non-empty list of numbers. Caller guards against an empty list. */
function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Computes the next-feeding estimate from the child's events and their age norm. */
export function computeFeedingEstimate(
  events: readonly EstimateEvent[],
  norm: AgeNorm,
  now: Date,
): Estimate {
  const allStarts = feedingStartsAscending(events)

  if (allStarts.length === 0) {
    return { status: 'not_enough_data' }
  }

  // Anchor to the most recent feed regardless of window (that instant is real).
  const lastStart = allStarts[allStarts.length - 1]

  // Personal average uses only recent feeds and only plausible (non-data-gap) gaps.
  const recentStarts = withinRecentWindow(allStarts, now, FEEDING_WINDOW_DAYS)
  const plausibleGaps = plausibleGapsMinutes(recentStarts, feedingGapCeilingMinutes(norm))

  if (recentStarts.length >= PERSONAL_FEEDING_THRESHOLD && plausibleGaps.length > 0) {
    const intervalMinutes = Math.round(mean(plausibleGaps))
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
