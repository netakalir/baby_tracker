import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

test.describe('authentication and onboarding', () => {
  test('a new user signs in and completes onboarding to the Today screen', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()

    await signIn(page, user)

    // No family yet -> the create-or-join screen.
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'בואו נתחיל' })).toBeVisible()

    await page.getByRole('button', { name: 'צור משפחה חדשה' }).click()
    await expect(page).toHaveURL(/\/onboarding\/create$/)
    await page.locator('#name').fill('משפחת בדיקה')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/onboarding\/add-child$/)
    await page.locator('#childName').fill('נועה')
    await page.locator('#birthDate').fill('2026-03-01')
    await page.locator('button[type="submit"]').click()

    // Onboarding complete -> Today screen shows the child and the signed-in email.
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: 'נועה' })).toBeVisible()
    await expect(page.getByText(`מחובר/ת כ-${user.email}`)).toBeVisible()

    // Sign-out returns to the auth screen.
    await page.getByRole('button', { name: 'התנתקות' }).click()
    await expect(page).toHaveURL(/\/auth$/)
  })

  test('an existing member with a child lands directly on the Today screen', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'תום' })

    await signIn(page, user)

    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()
  })

  test('wrong credentials show a friendly error and do not sign in', async ({ page, factory }) => {
    const user = await factory.createUser()

    await page.goto('/auth')
    await page.locator('#email').fill(user.email)
    await page.locator('#password').fill('definitely-the-wrong-password')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByRole('alert')).toHaveText('אימייל או סיסמה לא נכונים.')
    await expect(page).toHaveURL(/\/auth$/)
  })
})
