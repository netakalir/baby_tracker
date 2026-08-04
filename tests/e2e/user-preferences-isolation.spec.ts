import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * `user_preferences` is scoped to a single auth user, not a family: its RLS
 * boundary is `user_id = auth.uid()`. This verifies that boundary directly at
 * the data layer with real (non-service-role) authenticated clients - user A
 * can read and update only their own row, and can neither read nor modify
 * user B's row.
 */
test.describe('user_preferences isolation', () => {
  async function authedClientFor(user: TestUser): Promise<SupabaseClient> {
    const client = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    })
    expect(error).toBeNull()
    return client
  }

  test('a user cannot read or update another user\'s preferences row', async ({ factory }) => {
    const userA = await factory.createUser()
    const userB = await factory.createUser()

    const clientA = await authedClientFor(userA)
    const clientB = await authedClientFor(userB)

    // Each user creates their own preferences row (RLS insert with check).
    const { error: insertAError } = await clientA
      .from('user_preferences')
      .insert({ user_id: userA.id, display_name: 'Alpha', language: 'he', theme: 'dark' })
    expect(insertAError).toBeNull()

    const { error: insertBError } = await clientB
      .from('user_preferences')
      .insert({ user_id: userB.id, display_name: 'Beta', language: 'en', theme: 'light' })
    expect(insertBError).toBeNull()

    // A can read its own row.
    const { data: ownRow, error: ownError } = await clientA
      .from('user_preferences')
      .select('user_id, display_name')
      .eq('user_id', userA.id)
    expect(ownError).toBeNull()
    expect(ownRow).toEqual([{ user_id: userA.id, display_name: 'Alpha' }])

    // A cannot SELECT B's row (RLS filters it out - no error, just empty).
    const { data: bRowSeenByA, error: readError } = await clientA
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userB.id)
    expect(readError).toBeNull()
    expect(bRowSeenByA).toEqual([])

    // A cannot UPDATE B's row - the update matches zero rows under RLS.
    const { data: updated, error: updateError } = await clientA
      .from('user_preferences')
      .update({ display_name: 'hacked' })
      .eq('user_id', userB.id)
      .select('user_id')
    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    // Confirm B's row is untouched, read back as B.
    const { data: bRow } = await clientB
      .from('user_preferences')
      .select('display_name')
      .eq('user_id', userB.id)
      .single()
    expect(bRow?.display_name).toBe('Beta')

    // Cleanup: remove the seeded rows as their owners (no fixture teardown for
    // this table since no family owns it).
    await clientA.from('user_preferences').delete().eq('user_id', userA.id)
    await clientB.from('user_preferences').delete().eq('user_id', userB.id)
    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })
})
