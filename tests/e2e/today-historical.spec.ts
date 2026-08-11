import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

const DAY_MS = 24 * 60 * 60 * 1000

/** The device-local calendar date (`YYYY-MM-DD`) `daysAgo` days before today. */
function daysAgoDateString(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * DAY_MS)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** An ISO instant at local `hour` on the given `YYYY-MM-DD` date. */
function atLocalHour(dateString: string, hour: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, hour, 0, 0).toISOString()
}

/** Backdates the child ten days so several past days are navigable. */
const CHILD_CREATED_AT = new Date(Date.now() - 10 * DAY_MS).toISOString()

test.describe('Today screen — historical mode (§9)', () => {
  test('a past date shows that day’s events, disabled logging and no estimate banners', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, {
      childName: 'רוני',
      createdAt: CHILD_CREATED_AT,
    })

    const yesterday = daysAgoDateString(1)
    await factory.seedEvents(user, family.childId, [
      { type: 'sleep', start_time: atLocalHour(yesterday, 1), end_time: atLocalHour(yesterday, 3) },
      { type: 'feeding', start_time: atLocalHour(yesterday, 8), end_time: atLocalHour(yesterday, 8) },
    ])

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // Open the past day directly via the URL param.
    await page.goto(`/today?date=${yesterday}`)

    // Historical chrome: day navigation appears; estimate banners are hidden.
    await expect(page.getByRole('button', { name: 'יום קודם' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'יום הבא' })).toBeVisible()
    await expect(page.getByText('צפי האכלה הבאה')).toBeHidden()

    // That day's events are on the clock (the sleep arc reports its range).
    await expect(page.getByRole('img', { name: /שינה/ }).first()).toBeVisible()

    // Logging is neutralised — it must be impossible to log under a past date.
    await expect(page.getByRole('button', { name: 'רישום החתלה' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'התחלת שינה' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'התחלת האכלה' })).toBeDisabled()
  })

  test('an empty past day shows the gentle no-data message, not an error', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עדי', createdAt: CHILD_CREATED_AT })

    await signIn(page, user)
    await page.goto(`/today?date=${daysAgoDateString(3)}`)

    await expect(page.getByText('אין אירועים ביום זה')).toBeVisible()
    await expect(page.getByRole('button', { name: 'יום קודם' })).toBeVisible()
  })

  test('day navigation clamps forward to the live view and backward at creation', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    // Created exactly two days ago, so the earliest navigable day is two days back.
    await factory.seedFamilyWithChild(user, {
      childName: 'טל',
      createdAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
    })

    await signIn(page, user)

    // Forward from yesterday reaches today → returns to the live view.
    await page.goto(`/today?date=${daysAgoDateString(1)}`)
    await page.getByRole('button', { name: 'יום הבא' }).click()
    await expect(page).toHaveURL(/\/today$/)
    // Live view: logging is active again.
    await expect(page.getByRole('button', { name: 'רישום החתלה' })).toBeEnabled()

    // Backward is clamped at the creation day (two days ago) — "יום קודם" disabled.
    await page.goto(`/today?date=${daysAgoDateString(2)}`)
    await expect(page.getByRole('button', { name: 'יום קודם' })).toBeDisabled()
  })

  test('clicking a past day column on the Week screen opens that historical date', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, {
      childName: 'נועם',
      createdAt: CHILD_CREATED_AT,
    })

    // Data only on a day earlier this week, so exactly one column reports sleep.
    const past = daysAgoDateString(1)
    await factory.seedEvents(user, family.childId, [
      { type: 'sleep', start_time: atLocalHour(past, 2), end_time: atLocalHour(past, 4) },
    ])

    await signIn(page, user)
    await page.getByRole('button', { name: 'שבוע' }).click()
    await expect(page).toHaveURL(/\/week$/)

    // The only column with sleep data is the past day; clicking it opens Today
    // in historical mode for exactly that date.
    await page.getByRole('button', { name: /שעות שינה/ }).first().click()
    await expect(page).toHaveURL(new RegExp(`/today\\?date=${past}$`))
    await expect(page.getByRole('button', { name: 'יום קודם' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'רישום החתלה' })).toBeDisabled()
  })
})
