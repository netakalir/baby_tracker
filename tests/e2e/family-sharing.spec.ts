import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../support/adminClient'
import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'
import { testEnv } from '../support/testEnv'

/**
 * The app's core promise: a second parent joins an existing family via an
 * invite link and immediately shares the same child data. There is no
 * invite-creation UI yet, so the invite is seeded and then consumed through the
 * real join flow.
 */
test.describe('family sharing', () => {
  test('a second parent joins via invite and sees the shared child', async ({ page, factory }) => {
    const parentA = await factory.createUser()
    const family = await factory.seedFamilyWithChild(parentA, { childName: `משותף-${Date.now()}` })
    const token = await factory.seedInvite(parentA, family.familyId)

    const parentB = await factory.createUser()

    // B has no family yet -> onboarding.
    await signIn(page, parentB)
    await expect(page).toHaveURL(/\/onboarding$/)

    // Opening the invite link pre-fills the token; submitting joins the family.
    await page.goto(`/join?token=${token}`)
    await expect(page.locator('#token')).toHaveValue(token)
    await page.locator('button[type="submit"]').click()

    // B now lands on Today and sees A's child - the data is shared.
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()

    // API: B can now read the shared child directly (they are a real member).
    const clientB = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: signInError } = await clientB.auth.signInWithPassword({
      email: parentB.email,
      password: parentB.password,
    })
    expect(signInError).toBeNull()

    const { data: children, error: childrenError } = await clientB
      .from('children')
      .select('id')
      .eq('id', family.childId)
    expect(childrenError).toBeNull()
    expect(children).toEqual([{ id: family.childId }])

    await clientB.auth.signOut()
  })

  test('an expired invite cannot be claimed, even directly via the API', async ({ factory }) => {
    const parentA = await factory.createUser()
    const family = await factory.seedFamilyWithChild(parentA, { childName: `פג-${Date.now()}` })
    const expiredToken = await factory.seedInvite(parentA, family.familyId, {
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })

    // An attacker who obtained an expired token signs in and tries to claim it
    // straight through the API, bypassing any client-side expiry check.
    const attacker = await factory.createUser()
    const client = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: signInError } = await client.auth.signInWithPassword({
      email: attacker.email,
      password: attacker.password,
    })
    expect(signInError).toBeNull()

    // The join is validated entirely in the database (join_family_by_token
    // re-checks expiry under a row lock), so the claim is refused there.
    const { error: joinError } = await client.rpc('join_family_by_token', {
      p_token: expiredToken,
    })
    expect(joinError?.message).toBe('invite_expired')

    // The invite is untouched: still unused, so a fresh (valid) link would work.
    const { data: invite } = await adminClient
      .from('family_invites')
      .select('used_at, used_by')
      .eq('token', expiredToken)
      .single<{ used_at: string | null; used_by: string | null }>()
    expect(invite).toEqual({ used_at: null, used_by: null })

    await client.auth.signOut()
  })
})
