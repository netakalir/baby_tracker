/**
 * Wire types for the `estimates` Edge Function.
 *
 * Source of truth: `estimate-contract.md` (§1) at the repo root — these mirror
 * the frontend's `src/features/today/estimates.ts` exactly, so `functions.invoke`
 * decodes without translation. Only two per-card states (`not_enough_data` |
 * `ready`); instants are exposed only as ISO-8601 `predicted_at`, never formatted
 * strings (all wall-clock formatting is the client's job, in the device zone).
 */

/** How a `ready` prediction was derived; drives client copy tone only. */
export type EstimateBasis = 'personal' | 'age_norm'

/** One card's worth of data, discriminated by `status` (contract §1). */
export type Estimate =
  | { status: 'not_enough_data' }
  | { status: 'ready'; predicted_at: string; basis: EstimateBasis }

/** Full response body of a successful `estimates` call. */
export interface EstimateResponse {
  feeding: Estimate
  sleep: Estimate
  /** ISO-8601 UTC instant the server computed this. */
  generated_at: string
}

/** The minimal event fields the computation needs (a subset of `events`). */
export interface EstimateEvent {
  type: 'sleep' | 'feeding' | 'diaper' | 'mood'
  start_time: string
  end_time: string | null
}
