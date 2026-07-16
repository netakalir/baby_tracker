import { createClient } from '@supabase/supabase-js'
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
})
