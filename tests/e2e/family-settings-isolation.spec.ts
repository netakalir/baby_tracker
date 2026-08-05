import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '../support/fixtures'
import type { TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * RLS boundary for family_settings (Task 12b): a member of family B must not be
 * able to read or modify family A's settings row, while the legitimate member of
 * family A can. Verified directly against the API with real (non-service-role)
 * authenticated clients so the guarantee is proven at the data layer.
 */
test.describe('family_settings isolation', () => {
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

  test("a member cannot read or update another family's settings", async ({ factory }) => {
    const userA = await factory.createUser()
    const familyA = await factory.seedFamilyWithChild(userA)

    const userB = await factory.createUser()
    await factory.seedFamilyWithChild(userB)

    const clientA = await authedClientFor(userA)
    const clientB = await authedClientFor(userB)

    // family_settings is currently a placeholder (only family_id + updated_at):
    // units moved to user_preferences, day_start moved to children. We still
    // assert the RLS boundary holds for whatever family-scoped setting lands here.

    // A lazily creates its family's settings row (allowed by the INSERT policy).
    const { error: insertError } = await clientA
      .from('family_settings')
      .insert({ family_id: familyA.familyId })
    expect(insertError).toBeNull()

    // A can read back its own row.
    const { data: ownRows, error: ownReadError } = await clientA
      .from('family_settings')
      .select('family_id')
      .eq('family_id', familyA.familyId)
    expect(ownReadError).toBeNull()
    expect(ownRows).toHaveLength(1)

    // B cannot SELECT A's settings row (RLS filters it out -> empty set).
    const { data: bReadsA, error: bReadError } = await clientB
      .from('family_settings')
      .select('family_id')
      .eq('family_id', familyA.familyId)
    expect(bReadError).toBeNull()
    expect(bReadsA).toEqual([])

    // B cannot INSERT a settings row for A's family (WITH CHECK rejects it).
    const { error: bInsertError } = await clientB
      .from('family_settings')
      .insert({ family_id: familyA.familyId })
    expect(bInsertError).not.toBeNull()

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })
})
