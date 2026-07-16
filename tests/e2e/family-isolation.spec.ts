import { createClient } from '@supabase/supabase-js'
import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'
import { testEnv } from '../support/testEnv'

/**
 * The core RLS boundary: a member of family B must never see family A's data -
 * verified both through the UI and directly against the API with a real
 * (non-service-role) authenticated client, so the guarantee is proven at the
 * data layer and not just hidden by the UI.
 */
test.describe('family data isolation', () => {
  test("a member of one family cannot see another family's child", async ({ page, factory }) => {
    const userA = await factory.createUser()
    const familyA = await factory.seedFamilyWithChild(userA, { childName: `אלפא-${Date.now()}` })

    const userB = await factory.createUser()
    const familyB = await factory.seedFamilyWithChild(userB, { childName: `בטא-${Date.now()}` })

    // UI: signing in as B shows B's child, never A's.
    await signIn(page, userB)
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: familyB.childName })).toBeVisible()
    await expect(page.getByText(familyA.childName)).toHaveCount(0)

    // API: an authenticated client for B cannot read A's rows (RLS blocks them).
    const clientB = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: signInError } = await clientB.auth.signInWithPassword({
      email: userB.email,
      password: userB.password,
    })
    expect(signInError).toBeNull()

    const { data: children, error: childrenError } = await clientB
      .from('children')
      .select('id')
      .eq('id', familyA.childId)
    expect(childrenError).toBeNull()
    expect(children).toEqual([])

    const { data: families } = await clientB
      .from('families')
      .select('id')
      .eq('id', familyA.familyId)
    expect(families).toEqual([])

    await clientB.auth.signOut()
  })
})
