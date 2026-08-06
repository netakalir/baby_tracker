import { deviceDayBounds } from '../../src/features/today/todayDate'
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

test.describe('Today screen - estimate banners', () => {
  // The two cards below the clock ("next feeding" / "next sleep") render the
  // contract states (estimate-contract.md §3) from the `useEstimates` query,
  // which now calls the live `estimates` Edge Function. We seed a data shape that
  // yields a fixed mix in one render — feeding `ready` with the personal basis
  // (>= 3 feedings), sleep `not_enough_data` (no completed sleep) — so the Ready
  // and Unavailable card designs are both exercised.

  test('the estimate cards render a ready feeding and an unavailable sleep', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'עדי' })

    // Three feedings inside today's window → personal-average feeding estimate.
    // No completed sleep → sleep stays not_enough_data.
    const dayStartMs = new Date(deviceDayBounds().startIso).getTime()
    const base = Math.max(dayStartMs + 1_000, Date.now() - 6 * 60 * 60_000)
    await factory.seedEvents(
      user,
      family.childId,
      [0, 150, 300].map((offsetMin) => ({
        type: 'feeding' as const,
        start_time: new Date(base + offsetMin * 60_000).toISOString(),
        end_time: new Date(base + (offsetMin + 15) * 60_000).toISOString(),
      })),
    )

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // Both cards are always present by their fixed labels.
    await expect(page.getByText('צפי האכלה הבאה')).toBeVisible()
    await expect(page.getByText('צפי שינה הבאה')).toBeVisible()

    // Ready (feeding): a device-timezone wall-clock estimate plus the personal
    // basis wording, never a raw instant.
    await expect(page.getByText(/^בסביבות \d/)).toBeVisible()
    await expect(page.getByText('לפי הקצב של התינוק')).toBeVisible()

    // Unavailable (sleep): the honest positive placeholder, not a red error.
    await expect(page.getByText('עוד אין מספיק נתונים')).toBeVisible()
  })
})

test.describe('Today screen - start/stop timers', () => {
  // Sleep and feeding are start/stop timers: tapping "start" opens a running
  // event (drawn as an in-progress arc), and tapping the same button "stops" it.

  test('a bottle feeding is started and stopped through the choice menu', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // Start now opens a breast/bottle menu rather than logging directly.
    await page.getByRole('button', { name: 'התחלת האכלה' }).click()
    const feedingMenu = page.getByRole('menu', { name: 'בחירת אופן האכלה' })
    await expect(feedingMenu).toBeVisible()

    // Picking "bottle" starts the timer: the button toggles to "stop".
    await feedingMenu.getByRole('menuitem', { name: 'בקבוק' }).click()
    await expect(feedingMenu).toBeHidden()
    const stopButton = page.getByRole('button', { name: 'עצירת האכלה' })
    await expect(stopButton).toBeVisible()
    await expect(page.getByRole('img', { name: /האכלה · בקבוק מ-.*עדיין בתהליך/ })).toBeVisible()

    // Stopping a bottle opens the amount picker rather than ending immediately -
    // the amount is only known once the feed is over.
    await stopButton.click()
    const amountMenu = page.getByRole('menu', { name: 'בחירת כמות בקבוק' })
    await expect(amountMenu).toBeVisible()

    // Picking an amount stops the feed and records it on the event's label.
    await amountMenu.getByRole('menuitem', { name: '120 מ״ל' }).click()
    await expect(amountMenu).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('נרשמה האכלה')
    await expect(page.getByRole('button', { name: 'התחלת האכלה' })).toBeVisible()
    await expect(page.getByRole('img', { name: /האכלה · בקבוק · 120 מ״ל/ })).toBeVisible()
  })

  test('a breastfeed is drawn as one feeding arc and labels its side', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'תמר' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    await page.getByRole('button', { name: 'התחלת האכלה' }).click()
    const feedingMenu = page.getByRole('menu', { name: 'בחירת אופן האכלה' })
    await feedingMenu.getByRole('menuitem', { name: 'הנקה ימין' }).click()

    // The running feeding arc appears (still one "feeding" event, one color),
    // and its label carries the breast/side detail from the event metadata -
    // proof the split was persisted without a new event type.
    await expect(page.getByRole('button', { name: 'עצירת האכלה' })).toBeVisible()
    await expect(
      page.getByRole('img', { name: /האכלה · הנקה · ימין מ-.*עדיין בתהליך/ }),
    ).toBeVisible()

    // The "last side" hint reflects the choice on the next open.
    await page.getByRole('button', { name: 'עצירת האכלה' }).click()
    await page.getByRole('button', { name: 'התחלת האכלה' }).click()
    await expect(feedingMenu.getByText('צד אחרון: ימין')).toBeVisible()
  })

  test('a running feeding timer resumes as "stop" after a reload', async ({ page, factory }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'דניאל' })

    // A feeding that is still running (no end_time). Its start must be both
    // within today (so the day-scoped query returns it) AND in the past (so the
    // "start..now" arc has positive length). We anchor 30 min before now but
    // never earlier than just after today's midnight, which keeps both true at
    // any time of day - including the minutes right after midnight, where a
    // fixed early-morning hour would still sit in the future.
    const dayStartMs = new Date(deviceDayBounds().startIso).getTime()
    const feedingStart = Math.max(dayStartMs + 1_000, Date.now() - 30 * 60_000)
    await factory.seedEvents(user, family.childId, [
      { type: 'feeding', start_time: new Date(feedingStart).toISOString(), end_time: null },
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
    const dayStartMs = new Date(deviceDayBounds().startIso).getTime()
    await factory.seedEvents(user, family.childId, [
      {
        type: 'sleep',
        start_time: new Date(dayStartMs - 80 * 60_000).toISOString(),
        end_time: new Date(dayStartMs + 370 * 60_000).toISOString(),
      },
    ])

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // The event started yesterday, so a naive "start_time within today" query
    // would miss it; it must still render on today's clock (spec section 6).
    await expect(page.getByRole('img', { name: /שינה מ-/ })).toBeVisible()
  })
})

test.describe('Today screen - per-child day boundary (day_start)', () => {
  // "What counts as today" starts at the child's `day_start` (default midnight),
  // in the device timezone. With a non-midnight day_start the window shifts, so
  // an event logged just before that boundary belongs to the *previous* day and
  // must not appear on today's clock, while one just after it does.

  test("a non-midnight day_start excludes events before the child's day boundary", async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    // A 06:00 day boundary: the child's "today" runs from 06:00 to the next 06:00.
    const family = await factory.seedFamilyWithChild(user, { childName: 'יעל', dayStart: '06:00' })

    // Anchor to the actual day-window start the app computes for this day_start,
    // so the test is correct at any time of day (DST-safe, boundary-relative).
    const windowStartMs = new Date(deviceDayBounds(new Date(), '06:00').startIso).getTime()

    // One diaper just BEFORE the 06:00 boundary (previous child-day -> excluded)
    // and one mood just AFTER it, but still in the past (current day -> shown).
    const beforeBoundary = new Date(windowStartMs - 30 * 60_000).toISOString()
    const insideDay = new Date(Math.floor((windowStartMs + Date.now()) / 2)).toISOString()
    await factory.seedEvents(user, family.childId, [
      { type: 'diaper', start_time: beforeBoundary, end_time: null },
      { type: 'mood', start_time: insideDay, end_time: null },
    ])

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // The in-window mood renders; the pre-boundary diaper is scoped out entirely.
    await expect(page.getByRole('img', { name: /מצב רוח בשעה/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /החתלה/ })).toHaveCount(0)
  })
})
