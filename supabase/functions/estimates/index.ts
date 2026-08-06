/**
 * `estimates` Edge Function — computes the next-feeding and next-sleep
 * predictions shown under the Today clock.
 *
 * Security model: this function does NOT use the service_role key. It creates a
 * Supabase client that forwards the caller's `Authorization` JWT, so every read
 * of `children` / `events` runs through the caller's own Row Level Security. A
 * `child_id` the caller may not see returns zero rows → the function answers 403.
 *
 * Secrets: the Supabase URL and anon key are read from the Deno environment
 * (injected by the Edge runtime), never hardcoded.
 *
 * Request/response shape and the age-norms table follow `estimate-contract.md`
 * (§1/§2) at the repo root — the same contract the frontend's
 * `src/features/today/estimates.ts` encodes, so `functions.invoke` decodes it
 * without translation.
 */

import { createClient } from '@supabase/supabase-js'
import { corsHeaders, jsonResponse } from './cors.ts'
import { ageInMonths, normForAge } from './ageNorms.ts'
import { computeFeedingEstimate, computeSleepEstimate } from './estimate.ts'
import type { EstimateEvent, EstimateResponse } from './types.ts'

interface EstimateRequestBody {
  child_id?: unknown
}

/** Row shape read from `children` (only the fields the computation needs). */
interface ChildRow {
  id: string
  birth_date: string
}

/** Row shape read from `events`. */
interface EventRow {
  type: EstimateEvent['type']
  start_time: string
  end_time: string | null
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfiguration, not a client error — do not leak which var is missing.
    return jsonResponse({ error: 'Server is not configured' }, 500)
  }

  let body: EstimateRequestBody
  try {
    body = (await request.json()) as EstimateRequestBody
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400)
  }

  const childId = body.child_id
  if (typeof childId !== 'string' || childId.length === 0) {
    return jsonResponse({ error: 'child_id is required' }, 400)
  }

  // Client bound to the CALLER'S JWT → all reads go through the caller's RLS.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  // Validate the child is visible to the caller (RLS returns no row otherwise).
  const { data: child, error: childError } = await supabase
    .from('children')
    .select('id, birth_date')
    .eq('id', childId)
    .maybeSingle<ChildRow>()

  if (childError) {
    return jsonResponse({ error: 'Could not load child' }, 500)
  }
  if (!child) {
    // Either the child does not exist or it is outside the caller's family;
    // both are answered the same way so existence is not leaked.
    return jsonResponse({ error: 'Child not found' }, 403)
  }

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('type, start_time, end_time')
    .eq('child_id', childId)
    .in('type', ['feeding', 'sleep'])
    .order('start_time', { ascending: true })
    .returns<EventRow[]>()

  if (eventsError) {
    return jsonResponse({ error: 'Could not load events' }, 500)
  }

  const now = new Date()
  const norm = normForAge(ageInMonths(new Date(child.birth_date), now))
  const estimateEvents: EstimateEvent[] = events ?? []

  const response: EstimateResponse = {
    generated_at: now.toISOString(),
    feeding: computeFeedingEstimate(estimateEvents, norm),
    sleep: computeSleepEstimate(estimateEvents, norm),
  }

  return jsonResponse(response, 200)
})
