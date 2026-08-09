import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

const HOUR_MS = 60 * 60 * 1000

/** ISO timestamp for `hoursAgo` hours before now — always inside the week window. */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

test.describe('Week screen', () => {
  test('a fresh child with no data shows the week empty state', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'עומר' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    await page.getByRole('button', { name: 'שבוע' }).click()
    await expect(page).toHaveURL(/\/week$/)

    await expect(page.getByText('עדיין אין נתוני שינה או האכלה השבוע')).toBeVisible()
  })

  test('sleep and feeding across the week render the chart and daily averages', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'נועה' })

    await factory.seedEvents(user, family.childId, [
      // A recent sleep and feeding (this week) — point events are ignored by the chart.
      { type: 'sleep', start_time: hoursAgo(3), end_time: hoursAgo(1) },
      { type: 'feeding', start_time: hoursAgo(0.75), end_time: hoursAgo(0.5) },
      { type: 'diaper', start_time: hoursAgo(2), end_time: null },
    ])

    await signIn(page, user)
    await page.getByRole('button', { name: 'שבוע' }).click()
    await expect(page).toHaveURL(/\/week$/)

    // The empty state is gone and the summary tiles + a data bar are drawn.
    await expect(page.getByText('עדיין אין נתוני שינה או האכלה השבוע')).toBeHidden()
    await expect(page.getByText('שינה ליום')).toBeVisible()
    await expect(page.getByText('האכלה ליום')).toBeVisible()
    // At least one day column reports tracked hours (aria-label ends with "שעות").
    await expect(page.getByRole('img', { name: /שעות/ }).first()).toBeVisible()
  })

  test('the other parent sees the week data logged by the first parent', async ({
    page,
    factory,
  }) => {
    const owner = await factory.createUser()
    const family = await factory.seedFamilyWithChild(owner, { childName: 'איתי' })
    await factory.seedEvents(owner, family.childId, [
      { type: 'sleep', start_time: hoursAgo(4), end_time: hoursAgo(2) },
    ])

    // A second parent joins the same family and opens the week.
    const partner = await factory.createUser()
    await factory.addMember(partner, family.familyId)

    await signIn(page, partner)
    await expect(page).toHaveURL(/\/today$/)
    await page.getByRole('button', { name: 'שבוע' }).click()
    await expect(page).toHaveURL(/\/week$/)

    await expect(page.getByText('עדיין אין נתוני שינה או האכלה השבוע')).toBeHidden()
    await expect(page.getByRole('img', { name: /שעות/ }).first()).toBeVisible()
  })
})
