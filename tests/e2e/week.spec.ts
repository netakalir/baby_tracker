import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

const HOUR_MS = 60 * 60 * 1000

/** ISO timestamp `hours` before now — kept small so events land in today's week. */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

async function openWeek(page: import('@playwright/test').Page): Promise<void> {
  await expect(page).toHaveURL(/\/today$/)
  await page.getByRole('button', { name: 'שבוע' }).click()
  await expect(page).toHaveURL(/\/week$/)
}

test.describe('Week screen', () => {
  test('a fresh child shows the whole-week empty message and clamped navigation', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)
    await openWeek(page)

    // No data anywhere in the week -> a clear message, not misleading zero bars.
    await expect(page.getByText('עדיין אין מספיק נתונים לשבוע הזה')).toBeVisible()

    // Forward limit: the current week is the latest. Backward limit: a child
    // created this week has no earlier week. Both arrows are therefore disabled.
    await expect(page.getByRole('button', { name: 'שבוע הבא' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'שבוע קודם' })).toBeDisabled()
  })

  test('a week with data renders both charts, the summary and day-click navigation', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'נועה' })

    await factory.seedEvents(user, family.childId, [
      { type: 'sleep', start_time: hoursAgo(2), end_time: hoursAgo(1) },
      { type: 'feeding', start_time: hoursAgo(0.75), end_time: hoursAgo(0.5) },
      { type: 'feeding', start_time: hoursAgo(0.4), end_time: null },
      { type: 'diaper', start_time: hoursAgo(1.5), end_time: null },
      { type: 'mood', start_time: hoursAgo(1.2), end_time: null, metadata: { mood_level: 4 } },
    ])

    await signIn(page, user)
    await openWeek(page)

    // The empty message is gone; both primary charts are labelled.
    await expect(page.getByText('עדיין אין מספיק נתונים לשבוע הזה')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'שינה' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'האכלות' })).toBeVisible()

    // The sleep chart has a today column reporting hours; the feeding chart a count.
    await expect(page.getByRole('button', { name: /שעות שינה/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /2 האכלות/ }).first()).toBeVisible()

    // Summary line: total feedings across the week.
    await expect(page.getByText(/סך האכלות: 2/)).toBeVisible()

    // Clicking today's sleep column opens Today (live day, no date param).
    await page.getByRole('button', { name: /שעות שינה/ }).first().click()
    await expect(page).toHaveURL(/\/today$/)
  })

  test('the other parent sees the week data logged by the first parent', async ({
    page,
    factory,
  }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner, { childName: 'איתי' })
    await factory.seedEvents(owner, family.childId, [
      { type: 'sleep', start_time: hoursAgo(3), end_time: hoursAgo(1) },
      { type: 'feeding', start_time: hoursAgo(0.5), end_time: null },
    ])

    const partner = await factory.createUser()
    await factory.addMember(partner, family.familyId)

    await signIn(page, partner)
    await openWeek(page)

    await expect(page.getByText('עדיין אין מספיק נתונים לשבוע הזה')).toBeHidden()
    await expect(page.getByRole('button', { name: /שעות שינה/ }).first()).toBeVisible()
    await expect(page.getByText(/סך האכלות: 1/)).toBeVisible()
  })
})
