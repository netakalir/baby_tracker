import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

test.describe('Today screen - realtime sync between parents', () => {
  test("user B sees user A's logged event on the clock without reloading", async ({
    page,
    browser,
    factory,
  }) => {
    // Two parents in the SAME family: A creates it (and its child), B joins as a
    // second parent. Both then view the same child's Today screen on separate
    // devices (separate browser contexts).
    const userA = await factory.createUser()
    const userB = await factory.createUser()
    const family = await factory.seedFamilyWithChild(userA, { childName: 'יעל' })
    await factory.addMember(userB, family.familyId)

    // User B (this test's `page`) is on the Today screen, empty day so far.
    await signIn(page, userB)
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()

    // Diaper is a one-tap point event, so it isolates the realtime path under
    // test from feeding/sleep timer semantics (which need a start AND a stop).
    const diaperMarkerForB = page.getByRole('img', { name: /החתלה בשעה/ })
    await expect(diaperMarkerForB).toBeHidden()

    // User A, on a separate device, logs a diaper change with one tap.
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    try {
      await signIn(pageA, userA)
      await expect(pageA).toHaveURL(/\/today$/)
      await pageA.getByRole('button', { name: 'רישום החתלה' }).click()
      await expect(pageA.getByRole('status')).toHaveText('נרשם החתלה')

      // Without any reload, the realtime channel pushes A's insert and B's clock
      // shows the new diaper marker.
      await expect(diaperMarkerForB).toBeVisible()
    } finally {
      await contextA.close()
    }
  })
})
