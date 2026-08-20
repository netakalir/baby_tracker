import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

/**
 * End-to-end coverage for applying the `theme` preference (spec §3.3 apply
 * layer). Verifies the primary flow: choosing a theme on the Display screen
 * actually toggles the root `dark` class (which drives the token overrides in
 * index.css), that the choice persists across a reload, and that 'system'
 * follows the OS color scheme live. Runs against hosted Supabase like the rest
 * of the suite; the `factory` fixture seeds and tears down the user + family.
 */
test.describe('Theme (light/dark/system) apply layer', () => {
  const html = 'html'

  /** Awaits the user_preferences upsert triggered by changing a preference. */
  const themeSaved = (page: Parameters<typeof signIn>[0]) =>
    page.waitForResponse(
      (response) =>
        response.url().includes('/user_preferences') && response.request().method() !== 'GET',
    )

  test('dark selection toggles the root class and persists across reload', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'איתי' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)
    await page.goto('/settings/display')
    await expect(page.getByRole('heading', { name: 'תצוגה ושפה' })).toBeVisible()

    const themeGroup = page.getByRole('radiogroup', { name: 'ערכת נושא' })

    // Choosing "dark" adds the `dark` class to <html>.
    let saved = themeSaved(page)
    await themeGroup.getByRole('radio', { name: 'כהה' }).click()
    await saved
    await expect(page.locator(html)).toHaveClass(/\bdark\b/)

    // Persisted: a reload re-applies the stored preference.
    await page.reload()
    await expect(page.locator(html)).toHaveClass(/\bdark\b/)

    // Choosing "light" removes the class again.
    saved = themeSaved(page)
    await themeGroup.getByRole('radio', { name: 'בהיר' }).click()
    await saved
    await expect(page.locator(html)).not.toHaveClass(/\bdark\b/)
  })

  test('system selection follows the OS color scheme live', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'נועה' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)
    await page.goto('/settings/display')

    const saved = themeSaved(page)
    await page.getByRole('radiogroup', { name: 'ערכת נושא' }).getByRole('radio', { name: 'לפי המערכת' }).click()
    await saved

    // With the preference on "system", the root class tracks the OS scheme.
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator(html)).toHaveClass(/\bdark\b/)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator(html)).not.toHaveClass(/\bdark\b/)
  })
})
