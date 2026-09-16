// ============================================================
// Edge Function: delete-user
//
// Hard-deletes the *calling* user's auth account ("leave only"
// account deletion, settings spec §6). Deleting the auth user
// cascades to the account-owned rows (family_members membership and
// the private user_preferences row), while the shared family / child
// / events survive because their author FKs were relaxed to
// ON DELETE SET NULL (migration 20260806000001).
//
// Orphan cleanup: if the departing user was a family's LAST member,
// cascading away their membership would leave the family with zero
// members — unreachable through RLS and therefore dead, undeletable
// data (the family, its children and its events). So we capture the
// user's family ids BEFORE deletion, delete the user, then call
// delete_orphaned_families() to remove only those families that now
// have no members. A family with another remaining parent is left
// untouched (migration 20260910000001).
//
// Why an Edge Function: removing an auth user requires the
// service_role key, which must NEVER reach the browser. The key is
// read from the Edge runtime environment (Deno.env) — it is never
// hardcoded and never shipped to the client.
//
// A user can only ever delete THEMSELVES: the account id is taken
// from the verified JWT of the caller, not from the request body, so
// one user cannot delete another's account.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { withSentry } from './sentry.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const handleRequest = async (req: Request): Promise<Response> => {
  // Browser preflight.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Misconfiguration, not a client error — do not leak which var is missing.
    return jsonResponse({ error: 'Server is not configured for account deletion' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401)
  }

  // Resolve the caller from their JWT using a request-scoped client (anon key +
  // the caller's bearer token). This is the identity that will be deleted.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  const userId = userData.user.id

  // Admin client (service_role) performs the actual deletion. The cascade from
  // auth.users removes the membership + user_preferences; SET NULL preserves the
  // shared events/invites the user authored.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Capture the families this user belongs to BEFORE deletion — once the
  // auth user (and its cascading membership) is gone, we can no longer tell
  // which families they were in. These are the only families the orphan
  // sweep below is allowed to consider.
  const { data: memberships, error: membershipError } = await adminClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
  if (membershipError) {
    return jsonResponse({ error: membershipError.message }, 500)
  }
  const familyIds = (memberships ?? []).map((row) => row.family_id as string)

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500)
  }

  // Now that the membership has cascaded away, delete any of the user's
  // former families that have no members left. Families with a remaining
  // parent are skipped by the function's own guard. A failure here leaves
  // only a harmless orphan row (the account is already gone), so we report
  // it rather than silently succeeding.
  if (familyIds.length > 0) {
    const { error: orphanError } = await adminClient.rpc('delete_orphaned_families', {
      p_family_ids: familyIds,
    })
    if (orphanError) {
      return jsonResponse({ error: orphanError.message }, 500)
    }
  }

  return jsonResponse({ success: true }, 200)
}

// Wrapped so any uncaught error is reported to Sentry (no-op unless configured);
// the response/CORS contract is unchanged.
Deno.serve(withSentry(handleRequest))
