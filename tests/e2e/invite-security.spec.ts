import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { adminClient } from '../support/adminClient'
import { expect, test, type TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * Attacker-perspective isolation tests for the invite / membership boundary,
 * hardened in `20260903000000_harden_invite_and_membership_flow.sql`. These
 * exercise the RLS layer directly (the app's only access control), proving the
 * four fixed holes stay closed: no direct membership insert (S1), no invite
 * enumeration (S2), no arbitrary invite burning (S3), and an atomic join (S4).
 */

async function signInAs(user: TestUser): Promise<SupabaseClient> {
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

test.describe('invite & membership security', () => {
  test('S1: an attacker cannot insert a membership row for a family they were not invited to', async ({
    factory,
  }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner)

    const attacker = await factory.createUser()
    const client = await signInAs(attacker)

    // Direct self-insert into family_members is refused by RLS (the open INSERT
    // policy was removed; membership is created only by the definer RPCs).
    const { error: insertError } = await client
      .from('family_members')
      .insert({ family_id: family.familyId, user_id: attacker.id, role: 'parent' })
    expect(insertError).not.toBeNull()

    // And with no membership, the attacker cannot read the family's child.
    const { data: children } = await client
      .from('children')
      .select('id')
      .eq('id', family.childId)
    expect(children).toEqual([])

    await client.auth.signOut()
  })

  test('S2: invites cannot be enumerated by anon or by an unrelated authenticated user', async ({
    factory,
  }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner)
    await factory.seedInvite(owner, family.familyId)

    // anon has no table grant at all -> the request is rejected outright.
    const anon = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: anonData, error: anonError } = await anon.from('family_invites').select('*')
    expect(anonError).not.toBeNull()
    expect(anonData).toBeNull()

    // An authenticated non-member has the grant but no matching row policy ->
    // an empty list, never another family's tokens.
    const attacker = await factory.createUser()
    const client = await signInAs(attacker)
    const { data: attackerData, error: attackerError } = await client
      .from('family_invites')
      .select('*')
    expect(attackerError).toBeNull()
    expect(attackerData).toEqual([])

    await client.auth.signOut()
  })

  test('S3: an attacker cannot burn an arbitrary invite via a direct update', async ({
    factory,
  }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner)
    const token = await factory.seedInvite(owner, family.familyId)

    // The invite id, obtained out of band (the attack this defends against).
    const { data: seeded } = await adminClient
      .from('family_invites')
      .select('id')
      .eq('token', token)
      .single<{ id: string }>()
    expect(seeded).not.toBeNull()

    const attacker = await factory.createUser()
    const client = await signInAs(attacker)

    // Direct claim update: no UPDATE grant/policy remains -> zero rows affected.
    const { data: burned } = await client
      .from('family_invites')
      .update({ used_at: new Date().toISOString(), used_by: attacker.id })
      .eq('id', seeded!.id)
      .select()
    expect(burned ?? []).toEqual([])

    // The invite is still pristine.
    const { data: after } = await adminClient
      .from('family_invites')
      .select('used_at')
      .eq('id', seeded!.id)
      .single<{ used_at: string | null }>()
    expect(after?.used_at).toBeNull()

    await client.auth.signOut()
  })

  test('S3: a used invite cannot be claimed again', async ({ factory }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner)
    const token = await factory.seedInvite(owner, family.familyId)

    // First joiner succeeds.
    const first = await factory.createUser()
    const firstClient = await signInAs(first)
    const { data: joinedFamilyId, error: firstError } = await firstClient.rpc(
      'join_family_by_token',
      { p_token: token },
    )
    expect(firstError).toBeNull()
    expect(joinedFamilyId).toBe(family.familyId)

    // Second attempt on the same token is refused as already used.
    const second = await factory.createUser()
    const secondClient = await signInAs(second)
    const { error: secondError } = await secondClient.rpc('join_family_by_token', {
      p_token: token,
    })
    expect(secondError?.message).toBe('invite_used')

    await firstClient.auth.signOut()
    await secondClient.auth.signOut()
  })

  test('S4: a valid token join is atomic - membership is created and the child is readable', async ({
    factory,
  }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner)
    const token = await factory.seedInvite(owner, family.familyId)

    const joiner = await factory.createUser()
    const client = await signInAs(joiner)

    const { data: joinedFamilyId, error: joinError } = await client.rpc('join_family_by_token', {
      p_token: token,
    })
    expect(joinError).toBeNull()
    expect(joinedFamilyId).toBe(family.familyId)

    // Membership exists AND the shared child is now readable through RLS - both
    // sides of the transaction landed.
    const { data: children, error: childrenError } = await client
      .from('children')
      .select('id')
      .eq('id', family.childId)
    expect(childrenError).toBeNull()
    expect(children).toEqual([{ id: family.childId }])

    await client.auth.signOut()
  })
})
