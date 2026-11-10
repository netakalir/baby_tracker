import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { TestUser } from './fixtures'
import { testEnv } from './testEnv'

/**
 * Per-worker cache of the Supabase sessions obtained by API sign-ins, so a
 * test user authenticates against the hosted project once per test rather than
 * once for seeding (the factory) and again for the browser (`signIn`).
 *
 * Playwright runs each worker in its own process, so this module-level state
 * is per worker; the `factory` fixture clears it on teardown so no session
 * outlives the test (and the users) it was created for. Keyed by email because
 * `signIn` only receives `{ email, password }`, and fixture emails are unique.
 */
const sessionsByEmail = new Map<string, Session>()

export interface ApiSignIn {
  client: SupabaseClient
  session: Session
}

/**
 * Signs `user` in through the auth API (one password-grant request) and caches
 * the resulting session for `signIn`. The returned client neither persists nor
 * auto-refreshes its session: it only ever sends the access token, which stays
 * valid (~1h) for the whole test even if the browser later rotates the refresh
 * token it shares with this client.
 */
export async function signInThroughApi(
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<ApiSignIn> {
  const client = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw error
  sessionsByEmail.set(user.email, data.session)
  return { client, session: data.session }
}

/** The cached session for `email`, if that user already signed in through the API. */
export function cachedSession(email: string): Session | undefined {
  return sessionsByEmail.get(email)
}

/** Drops every cached session. Called by the `factory` fixture on teardown. */
export function clearCachedSessions(): void {
  sessionsByEmail.clear()
}

/**
 * The localStorage key under which the app's supabase-js client persists its
 * session. Mirrors supabase-js's default (`SupabaseClient` constructor:
 * `sb-${baseUrl.hostname.split('.')[0]}-auth-token`), which the app relies on
 * by calling `createClient(url, anonKey)` without a custom `storageKey`.
 */
export function authStorageKey(): string {
  const projectRef = new URL(testEnv.supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}
