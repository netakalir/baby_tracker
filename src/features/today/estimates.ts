import { supabase } from '../../lib/supabase'

/**
 * "Next feeding" / "next sleep" estimate contract (see `estimate-contract.md`).
 *
 * These types are the shared source of truth between this frontend and the
 * `estimates` Edge Function (built in parallel). The function returns instants
 * (`predicted_at`) only — all wall-clock formatting is the frontend's job — and
 * encodes just two per-card states (`ready` / `not_enough_data`); loading and
 * error are client-side React Query concerns, never in the body.
 */

export interface EstimateRequest {
  child_id: string
}

/** One card's worth of data, discriminated by `status` (contract §1). */
export type Estimate =
  | { status: 'not_enough_data' }
  | {
      status: 'ready'
      /** ISO-8601 UTC instant of the predicted next event; client formats to device tz. */
      predicted_at: string
      /** Drives copy tone only: personal average vs. age-norm fallback. */
      basis: 'personal' | 'age_norm'
    }

export interface EstimateResponse {
  feeding: Estimate
  sleep: Estimate
  /** ISO-8601 UTC instant the server computed this. */
  generated_at: string
}

/**
 * Single swap point between the local stub and the live Edge Function.
 *
 * While the `estimates` function is being built in parallel, we render against a
 * contract-shaped stub so the banners are fully functional. To go live once the
 * function is deployed, flip this to `false` — nothing else changes. Typed as
 * `boolean` (not the literal `true`) so both branches stay type-checked.
 */
const USE_STUB: boolean = false

/**
 * Calls the `estimates` Edge Function through the caller's JWT/RLS (contract §1).
 * The function only ever sees children the caller may see; `child_id` is
 * validated server-side.
 */
async function invokeEstimates(childId: string): Promise<EstimateResponse> {
  const body: EstimateRequest = { child_id: childId }
  const { data, error } = await supabase.functions.invoke<EstimateResponse>('estimates', {
    body,
  })

  if (error) throw error
  if (!data) throw new Error('Empty estimates response')
  return data
}

/**
 * Contract-shaped stand-in for the Edge Function. Returns a mix — feeding
 * `ready` (personal), sleep `not_enough_data` — so a single Today render
 * exercises both the Ready and Unavailable card designs. The short delay
 * simulates function latency so the Loading state is observable; the real
 * `invokeEstimates` has its own latency, so this goes away with the swap.
 */
function stubEstimates(_childId: string): Promise<EstimateResponse> {
  const now = Date.now()
  const response: EstimateResponse = {
    feeding: {
      status: 'ready',
      predicted_at: new Date(now + 45 * 60_000).toISOString(),
      basis: 'personal',
    },
    sleep: { status: 'not_enough_data' },
    generated_at: new Date(now).toISOString(),
  }
  return new Promise((resolve) => setTimeout(() => resolve(response), 400))
}

/** Fetches the two estimates for a child, via the stub or the live function. */
export function fetchEstimates(childId: string): Promise<EstimateResponse> {
  return USE_STUB ? stubEstimates(childId) : invokeEstimates(childId)
}
