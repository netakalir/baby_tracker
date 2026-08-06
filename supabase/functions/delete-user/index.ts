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

Deno.serve(async (req: Request): Promise<Response> => {
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

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500)
  }

  return jsonResponse({ success: true }, 200)
})
