import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { testEnv } from './testEnv'

/**
 * Supabase client authenticated with the service_role key. It bypasses RLS and
 * is used ONLY by tests to seed and tear down fixture data (users, families,
 * children, invites). Never import this from application code.
 */
export const adminClient: SupabaseClient = createClient(
  testEnv.supabaseUrl,
  testEnv.supabaseServiceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
)
