import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

/**
 * End-to-end coverage for the four Settings sub-screens (spec §3.1–§3.4),
 * exercising each screen's primary flow AND its persistence (reload → the saved
 * value is still there, i.e. it really reached `user_preferences` / `children` /
 * `family_invites`). Runs against the hosted Supabase project like the rest of
 * the suite; the `factory` fixture creates a pre-confirmed user + family and
 * tears them down (cascading the seeded rows) afterwards.
 */
test.describe('Settings sub-screens', () => {
  test('Profile: edits and persists the display name, shows the email', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    await page.goto('/settings/profile')
    await expect(page.getByRole('heading', { name: 'פרופיל וחשבון' })).toBeVisible()

    // The read-only email is shown.
    await expect(page.getByText(user.email)).toBeVisible()

    // Edit + save the display name. Wait for the persistence write to land
    // before reloading — otherwise the reload aborts the in-flight upsert.
    const nameInput = page.locator('#display-name')
    await nameInput.fill('אבא של עומר')
    const nameSaved = page.waitForResponse(
      (response) =>
        response.url().includes('/user_preferences') && response.request().method() !== 'GET',
    )
    await page.getByRole('button', { name: 'שמירה' }).click()
    await nameSaved

    // Persisted: reload re-seeds the field from the stored row.
    await page.reload()
    await expect(page.locator('#display-name')).toHaveValue('אבא של עומר')
  })

  test('Baby & family: saves baby details, lists the member, creates an invite', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'נועה' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/) // wait for the session before navigating
    await page.goto('/settings/baby-family')
    await expect(page.getByRole('heading', { name: 'תינוק ומשפחה' })).toBeVisible()

    // Save an edited baby name.
    const babyName = page.locator('#babyName')
    await expect(babyName).toHaveValue('נועה')
    await babyName.fill('נועה 2')
    await page.getByRole('button', { name: 'שמירה' }).click()
    await expect(page.getByText('הפרטים נשמרו.')).toBeVisible()

    // Persisted after reload.
    await page.reload()
    await expect(page.locator('#babyName')).toHaveValue('נועה 2')

    // The members list shows the current user (via the identity RPC — with only
    // a display name absent, the email is the primary label).
    await expect(page.getByText(user.email)).toBeVisible()

    // Creating an invite yields a single-use /join link.
    await page.getByRole('button', { name: 'יצירת קישור הזמנה' }).click()
    await expect(page.getByText(/\/join\?token=/)).toBeVisible()
  })

  test('Display: changes and persists language / theme / units', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'איתי' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/) // wait for the session before navigating
    await page.goto('/settings/display')
    await expect(page.getByRole('heading', { name: 'תצוגה ושפה' })).toBeVisible()

    // Switch each per-user preference, awaiting the persistence write after each
    // click so the final reload doesn't abort an in-flight upsert.
    const savePreference = () =>
      page.waitForResponse(
        (response) =>
          response.url().includes('/user_preferences') && response.request().method() !== 'GET',
      )

    let saved = savePreference()
    await page.getByRole('radiogroup', { name: 'שפה' }).getByRole('radio', { name: 'English' }).click()
    await saved

    saved = savePreference()
    await page.getByRole('radiogroup', { name: 'ערכת נושא' }).getByRole('radio', { name: 'כהה' }).click()
    await saved

    saved = savePreference()
    await page
      .getByRole('radiogroup', { name: 'יחידות מדידה' })
      .getByRole('radio', { name: 'אונקיות' })
      .click()
    await saved

    // Persisted after reload (each control re-reads from the stored row).
    await page.reload()
    await expect(
      page.getByRole('radiogroup', { name: 'שפה' }).getByRole('radio', { name: 'English' }),
    ).toHaveAttribute('aria-checked', 'true')
    await expect(
      page.getByRole('radiogroup', { name: 'ערכת נושא' }).getByRole('radio', { name: 'כהה' }),
    ).toHaveAttribute('aria-checked', 'true')
    await expect(
      page.getByRole('radiogroup', { name: 'יחידות מדידה' }).getByRole('radio', { name: 'אונקיות' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  test('Notifications: toggles a reminder and persists it', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'רוני' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/) // wait for the session before navigating
    await page.goto('/settings/notifications')
    await expect(page.getByRole('heading', { name: 'התראות' })).toBeVisible()

    const feedingToggle = page.getByRole('switch', { name: /תזכורות האכלה/ })
    await expect(feedingToggle).toHaveAttribute('aria-checked', 'false')
    const toggleSaved = page.waitForResponse(
      (response) =>
        response.url().includes('/user_preferences') && response.request().method() !== 'GET',
    )
    await feedingToggle.click()
    await expect(feedingToggle).toHaveAttribute('aria-checked', 'true')
    await toggleSaved

    // Persisted after reload.
    await page.reload()
    await expect(page.getByRole('switch', { name: /תזכורות האכלה/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
