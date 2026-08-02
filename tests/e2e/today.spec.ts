import { israelDayBounds } from '../../src/features/today/todayDate'
import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

test.describe('Today screen - quick logging', () => {
  test('an empty day shows the empty-state clock until an event is logged', async ({
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
    const emptyCaption = page.getByText(
      'עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל',
    )
    await expect(emptyCaption).toBeVisible()

    // A single one-tap log (diaper) clears the empty state.
    await page.getByRole('button', { name: 'רישום החתלה' }).click()
    await expect(page.getByRole('status')).toHaveText('נרשם החתלה')
    await expect(emptyCaption).toBeHidden()
  })

  test('a diaper change is logged with one tap and appears on the clock', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'נועה' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // Diaper is an immediate one-tap point event.
    await page.getByRole('button', { name: 'רישום החתלה' }).click()

    await expect(page.getByRole('status')).toHaveText('נרשם החתלה')
    await expect(page.getByRole('img', { name: /החתלה בשעה/ })).toBeVisible()
  })

  test('mood is logged through the inline emoji popover and appears on the clock', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'שירה' })

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

test.describe('Today screen - start/stop timers', () => {
  // Sleep and feeding are start/stop timers: tapping "start" opens a running
  // event (drawn as an in-progress arc), and tapping the same button "stops" it.

  test('feeding is started and stopped from one toggling button', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // Start: the button toggles to "stop" and a running feeding arc appears.
    await page.getByRole('button', { name: 'התחלת האכלה' }).click()
    const stopButton = page.getByRole('button', { name: 'עצירת האכלה' })
    await expect(stopButton).toBeVisible()
    await expect(page.getByRole('img', { name: /האכלה מ-.*עדיין בתהליך/ })).toBeVisible()

    // Stop: a confirmation shows and the button toggles back to "start".
    await stopButton.click()
    await expect(page.getByRole('status')).toHaveText('נרשמה האכלה')
    await expect(page.getByRole('button', { name: 'התחלת האכלה' })).toBeVisible()
  })

  test('a running feeding timer resumes as "stop" after a reload', async ({ page, factory }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'דניאל' })

    // A feeding started earlier today and still running (no end_time).
    const dayStart = new Date(israelDayBounds().startIso).getTime()
    await factory.seedEvents(user, family.childId, [
      { type: 'feeding', start_time: new Date(dayStart + 120 * 60_000).toISOString(), end_time: null },
    ])

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // The persisted running timer is recognised: the button is already "stop".
    await expect(page.getByRole('button', { name: 'עצירת האכלה' })).toBeVisible()
    await expect(page.getByRole('img', { name: /האכלה מ-.*עדיין בתהליך/ })).toBeVisible()
  })

  test('sleep is started from its button and drawn as an in-progress arc', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'איתי' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    await page.getByRole('button', { name: 'התחלת שינה' }).click()
    await expect(page.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()
    await expect(page.getByRole('img', { name: /שינה מ-.*עדיין בתהליך/ })).toBeVisible()
  })

  test('an overnight sleep that crosses midnight is shown on today\'s clock', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'רוני' })

    // A sleep that started ~80 min before today's Israel-local midnight and ends
    // ~6h into today. Anchoring to the real day boundary keeps this DST-safe.
    const dayStart = new Date(israelDayBounds().startIso).getTime()
    await factory.seedEvents(user, family.childId, [
      {
        type: 'sleep',
        start_time: new Date(dayStart - 80 * 60_000).toISOString(),
        end_time: new Date(dayStart + 370 * 60_000).toISOString(),
      },
    ])

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // The event started yesterday, so a naive "start_time within today" query
    // would miss it; it must still render on today's clock (spec section 6).
    await expect(page.getByRole('img', { name: /שינה מ-/ })).toBeVisible()
  })
})
