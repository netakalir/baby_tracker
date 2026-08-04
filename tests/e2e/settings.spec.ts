import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

test.describe('Settings hub', () => {
  test('opens from the Today header gear and drills into each sub-screen', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // Settings is reached from a header gear, not a bottom-nav tab.
    await page.getByRole('button', { name: 'הגדרות' }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'הגדרות' })).toBeVisible()

    // Each of the four rows drills into its own placeholder route and back.
    const rows: ReadonlyArray<{ label: string; path: RegExp }> = [
      { label: 'פרופיל וחשבון', path: /\/settings\/profile$/ },
      { label: 'תינוק ומשפחה', path: /\/settings\/baby-family$/ },
      { label: 'תצוגה ושפה', path: /\/settings\/display$/ },
      { label: 'התראות', path: /\/settings\/notifications$/ },
    ]

    for (const row of rows) {
      await page.getByRole('button', { name: row.label }).click()
      await expect(page).toHaveURL(row.path)
      await expect(page.getByRole('heading', { name: row.label })).toBeVisible()
      await page.getByRole('button', { name: 'חזרה' }).click()
      await expect(page).toHaveURL(/\/settings$/)
    }

    // The back arrow returns to Today.
    await page.getByRole('button', { name: 'חזרה' }).click()
    await expect(page).toHaveURL(/\/today$/)
  })

  test('logs the user out from the Settings hub', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'נועה' })

    await signIn(page, user)
    await page.getByRole('button', { name: 'הגדרות' }).click()
    await expect(page).toHaveURL(/\/settings$/)

    await page.getByRole('button', { name: 'התנתקות' }).click()
    await expect(page).toHaveURL(/\/auth$/)
  })
})
