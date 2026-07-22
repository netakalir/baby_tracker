import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

test.describe('Today screen - quick logging', () => {
  test('an empty day shows the empty-state clock, then logging events fills it', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)

    // Existing member with a child lands straight on Today.
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()

    // A fresh day has no events -> the clock shows its neutral empty state.
    await expect(
      page.getByText('עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל'),
    ).toBeVisible()

    // One tap logs a feeding immediately (no form, no separate "save").
    await page.getByRole('button', { name: 'רישום האכלה' }).click()

    // Success confirmation, and the event now appears as a marker on the clock.
    await expect(page.getByRole('status')).toHaveText('נרשמה האכלה')
    await expect(page.getByRole('img', { name: /האכלה בשעה/ })).toBeVisible()

    // Once there is data, the empty-state caption is gone.
    await expect(
      page.getByText('עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל'),
    ).toBeHidden()
  })

  test('mood is logged through the inline emoji popover', async ({ page, factory }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'שירה' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // The mood button opens an inline menu rather than logging immediately.
    await page.getByRole('button', { name: 'רישום מצב רוח' }).click()
    const moodMenu = page.getByRole('menu', { name: 'בחירת מצב רוח' })
    await expect(moodMenu).toBeVisible()

    // Selecting a mood logs it and closes the menu.
    await moodMenu.getByRole('menuitem', { name: 'שמח' }).click()
    await expect(page.getByRole('status')).toHaveText('נרשם מצב רוח')
    await expect(moodMenu).toBeHidden()
    await expect(page.getByRole('img', { name: /מצב רוח בשעה/ })).toBeVisible()
  })
})
