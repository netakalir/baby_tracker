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

    // A lazily creates its family's settings row (allowed by the INSERT policy).
    const { error: insertError } = await clientA
      .from('family_settings')
      .insert({ family_id: familyA.familyId, units: 'oz', day_start: '07:00' })
    expect(insertError).toBeNull()

    // A can read back its own settings.
    const { data: ownRows, error: ownReadError } = await clientA
      .from('family_settings')
      .select('family_id, units, day_start')
      .eq('family_id', familyA.familyId)
    expect(ownReadError).toBeNull()
    expect(ownRows).toHaveLength(1)
    expect(ownRows?.[0]?.units).toBe('oz')

    // B cannot SELECT A's settings row (RLS filters it out -> empty set).
    const { data: bReadsA, error: bReadError } = await clientB
      .from('family_settings')
      .select('family_id')
      .eq('family_id', familyA.familyId)
    expect(bReadError).toBeNull()
    expect(bReadsA).toEqual([])

    // B cannot UPDATE A's settings row (RLS matches no rows -> no change).
    const { data: bUpdatesA, error: bUpdateError } = await clientB
      .from('family_settings')
      .update({ units: 'ml' })
      .eq('family_id', familyA.familyId)
      .select('family_id')
    expect(bUpdateError).toBeNull()
    expect(bUpdatesA).toEqual([])

    // Confirm A's row is untouched.
    const { data: afterRows } = await clientA
      .from('family_settings')
      .select('units')
      .eq('family_id', familyA.familyId)
    expect(afterRows?.[0]?.units).toBe('oz')

    // B cannot INSERT a settings row for A's family (WITH CHECK rejects it).
    const { error: bInsertError } = await clientB
      .from('family_settings')
      .insert({ family_id: familyA.familyId, units: 'ml' })
    expect(bInsertError).not.toBeNull()

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })
})
