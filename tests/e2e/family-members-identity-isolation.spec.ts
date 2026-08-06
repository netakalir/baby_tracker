import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * The `family_members_with_identity` RPC (SECURITY DEFINER) exposes each family
 * member's display name + email so the Settings "Baby & family" screen can show
 * the other parent's real identity. Its access boundary is the same as every
 * family-scoped policy: only a member of the family gets rows. This verifies
 * that boundary directly at the data layer with real authenticated clients:
 *   - a member sees every member of their own family, with real emails;
 *   - a user from another family gets zero rows (no name/email leak).
 */
test.describe('family_members_with_identity isolation', () => {
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

  test('a member sees both parents\' identities; an outsider sees none', async ({ factory }) => {
    // Family A with two parents; an unrelated user in family B.
    const parentA1 = await factory.createUser()
    const parentA2 = await factory.createUser()
    const outsider = await factory.createUser()

    const familyA = await factory.seedFamilyWithChild(parentA1, { childName: 'עֹמֶר' })
    await factory.addMember(parentA2, familyA.familyId)
    await factory.seedFamilyWithChild(outsider, { childName: 'דָּנָה' })

    const clientA1 = await authedClientFor(parentA1)
    const clientOutsider = await authedClientFor(outsider)

    // A member of family A gets a row per member, with real emails.
    const { data: members, error: membersError } = await clientA1.rpc(
      'family_members_with_identity',
      { p_family_id: familyA.familyId },
    )
    expect(membersError).toBeNull()
    expect(members).toHaveLength(2)

    const emails = (members as Array<{ email: string | null }>).map((m) => m.email).sort()
    expect(emails).toEqual([parentA1.email, parentA2.email].sort())

    const userIds = (members as Array<{ user_id: string }>).map((m) => m.user_id).sort()
    expect(userIds).toEqual([parentA1.id, parentA2.id].sort())

    // An outsider (family B) calling with family A's id gets zero rows: the
    // SECURITY DEFINER gate blocks any cross-family name/email leak.
    const { data: leaked, error: leakError } = await clientOutsider.rpc(
      'family_members_with_identity',
      { p_family_id: familyA.familyId },
    )
    expect(leakError).toBeNull()
    expect(leaked).toEqual([])

    await clientA1.auth.signOut()
    await clientOutsider.auth.signOut()
  })
})
