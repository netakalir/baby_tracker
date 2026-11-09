import type { Page } from '@playwright/test'
import { formatLongDayLabel } from '../../src/features/compare/compareDate'
import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Frozen "now" for these tests — a fixed Wednesday morning, frozen via
 * `page.clock` before sign-in so the app's "today" (and its 14-day chip range)
 * matches what these helpers compute (see today-historical.spec.ts).
 */
const FIXED_NOW = new Date('2026-09-02T09:00:00')

/** The device-local calendar date (`YYYY-MM-DD`) `daysAgo` days before `FIXED_NOW`. */
function daysAgoDateString(daysAgo: number): string {
  const d = new Date(FIXED_NOW.getTime() - daysAgo * DAY_MS)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** An ISO instant at local `hour` (fractional hours allowed) on the given `YYYY-MM-DD` date. */
function atLocalHour(dateString: string, hour: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const minutes = Math.round(hour * 60)
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0).toISOString()
}

/** Backdates the child ten days (from `FIXED_NOW`) so several past days are selectable. */
const CHILD_CREATED_AT = new Date(FIXED_NOW.getTime() - 10 * DAY_MS).toISOString()

/** Opens the Day-comparison screen the way a user does: the Today header's compare icon. */
async function openCompare(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/today$/)
  await page.getByRole('button', { name: 'השוואת ימים' }).click()
  await expect(page).toHaveURL(/\/compare$/)
}

/** The day-picker chip for a date (named by its full Hebrew date). */
function dayChip(page: Page, dateString: string) {
  return page
    .getByRole('group', { name: 'בחירת ימים להשוואה' })
    .getByRole('button', { name: formatLongDayLabel(dateString), exact: true })
}

/** The comparison rows list. */
function rowsList(page: Page) {
  return page.getByRole('list', { name: 'ימים להשוואה' })
}

test.describe('Day comparison screen', () => {
  test('selected days render as rows with correct summaries, toggle off, and open the day', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, {
      childName: 'מאיה',
      createdAt: CHILD_CREATED_AT,
    })

    const yesterday = daysAgoDateString(1)
    const threeDaysAgo = daysAgoDateString(3)
    await factory.seedEvents(user, family.childId, [
      // Yesterday: 2h sleep, 1 feeding, 2 diapers, and a mood (never drawn or counted).
      { type: 'sleep', start_time: atLocalHour(yesterday, 1), end_time: atLocalHour(yesterday, 3) },
      { type: 'feeding', start_time: atLocalHour(yesterday, 8), end_time: atLocalHour(yesterday, 8.25) },
      { type: 'diaper', start_time: atLocalHour(yesterday, 10) },
      { type: 'diaper', start_time: atLocalHour(yesterday, 14) },
      { type: 'mood', start_time: atLocalHour(yesterday, 15), metadata: { mood_level: 4 } },
      // Three days ago: 1.5h sleep, 2 feedings, 1 diaper.
      { type: 'sleep', start_time: atLocalHour(threeDaysAgo, 13), end_time: atLocalHour(threeDaysAgo, 14.5) },
      { type: 'feeding', start_time: atLocalHour(threeDaysAgo, 7), end_time: atLocalHour(threeDaysAgo, 7.25) },
      { type: 'feeding', start_time: atLocalHour(threeDaysAgo, 11), end_time: atLocalHour(threeDaysAgo, 11.25) },
      { type: 'diaper', start_time: atLocalHour(threeDaysAgo, 9) },
    ])

    await page.clock.setFixedTime(FIXED_NOW)
    await signIn(page, user)
    await openCompare(page)

    // Default selection: today + yesterday. Today has nothing logged — a gentle
    // per-row message, not an error.
    const rows = rowsList(page)
    await expect(rows.getByRole('listitem')).toHaveCount(2)
    await expect(rows.getByRole('button', { name: /^היום/ })).toContainText('אין אירועים ביום זה')
    await expect(page.getByRole('alert')).toBeHidden()

    // Toggle today off → its row disappears.
    await expect(dayChip(page, daysAgoDateString(0))).toHaveAttribute('aria-pressed', 'true')
    await dayChip(page, daysAgoDateString(0)).click()
    await expect(dayChip(page, daysAgoDateString(0))).toHaveAttribute('aria-pressed', 'false')
    await expect(rows.getByRole('button', { name: /^היום/ })).toBeHidden()
    await expect(rows.getByRole('listitem')).toHaveCount(1)

    // Add three days ago → two seeded days side by side.
    await dayChip(page, threeDaysAgo).click()
    await expect(rows.getByRole('listitem')).toHaveCount(2)

    const yesterdayRow = rows.getByRole('button', { name: /^אתמול/ })
    const olderRow = rows.getByRole('button', { name: new RegExp(`^${formatLongDayLabel(threeDaysAgo)}`) })
    await expect(yesterdayRow.getByText('2ש׳ · 1 האכלה · 2 חיתולים', { exact: true })).toBeVisible()
    await expect(olderRow.getByText('1ש׳ 30ד׳ · 2 האכלות · 1 חיתול', { exact: true })).toBeVisible()
    // The accessible name spells the sleep figure out.
    await expect(yesterdayRow).toHaveAccessibleName('אתמול: שינה 2ש׳, 1 האכלה, 2 חיתולים')

    // Toggle yesterday off → only the older day's row remains.
    await dayChip(page, yesterday).click()
    await expect(yesterdayRow).toBeHidden()
    await expect(rows.getByRole('listitem')).toHaveCount(1)

    // Tapping a row opens that day in the historical Today view.
    await olderRow.click()
    await expect(page).toHaveURL(new RegExp(`/today\\?date=${threeDaysAgo}$`))
    await expect(page.getByRole('button', { name: 'יום קודם' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'רישום החתלה' })).toBeDisabled()
  })

  test('the back control returns to Today', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'רז', createdAt: CHILD_CREATED_AT })

    await page.clock.setFixedTime(FIXED_NOW)
    await signIn(page, user)
    await openCompare(page)

    await page.getByRole('button', { name: 'חזרה' }).click()
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('button', { name: 'השוואת ימים' })).toBeVisible()
  })

  test('deselecting every day shows the empty prompt instead of rows', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'אלה', createdAt: CHILD_CREATED_AT })

    await page.clock.setFixedTime(FIXED_NOW)
    await signIn(page, user)
    await openCompare(page)

    await dayChip(page, daysAgoDateString(0)).click()
    await dayChip(page, daysAgoDateString(1)).click()

    await expect(rowsList(page)).toBeHidden()
    await expect(page.getByText('יש לבחור לפחות יום אחד להשוואה')).toBeVisible()
  })

  test('on a 320px screen a long summary wraps inside the row instead of overflowing', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, {
      childName: 'שירה',
      createdAt: CHILD_CREATED_AT,
    })

    // A busy day for the longest realistic summary: 13ש׳ 30ד׳ · 12 האכלות · 10 חיתולים.
    const yesterday = daysAgoDateString(1)
    await factory.seedEvents(user, family.childId, [
      { type: 'sleep', start_time: atLocalHour(yesterday, 0), end_time: atLocalHour(yesterday, 7) },
      { type: 'sleep', start_time: atLocalHour(yesterday, 12), end_time: atLocalHour(yesterday, 18.5) },
      ...Array.from({ length: 12 }, (_, index) => ({
        type: 'feeding' as const,
        start_time: atLocalHour(yesterday, 7 + index * 0.4),
        end_time: atLocalHour(yesterday, 7.2 + index * 0.4),
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        type: 'diaper' as const,
        start_time: atLocalHour(yesterday, 18.75 + index * 0.5),
      })),
    ])

    await page.setViewportSize({ width: 320, height: 720 })
    await page.clock.setFixedTime(FIXED_NOW)
    await signIn(page, user)
    await openCompare(page)

    const summary = rowsList(page).getByText('13ש׳ 30ד׳ · 12 האכלות · 10 חיתולים', { exact: true })
    await expect(summary).toBeVisible()

    // The summary sits fully inside the viewport (1px rounding tolerance) and
    // does not overflow its own box horizontally — it may wrap, never clip.
    const box = await summary.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320 + 1)
    const overflows = await summary.evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflows).toBe(false)

    // The page itself never scrolls sideways at 320px.
    const pageOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(pageOverflows).toBe(false)
  })

  test("the other parent's log reaches an open comparison without reloading", async ({
    page,
    browser,
    factory,
  }) => {
    // Two parents in the same family (see today-realtime.spec.ts). No clock
    // pinning here: the realtime socket needs real time to flow.
    const userA = await factory.createUser()
    const userB = await factory.createUser()
    const family = await factory.seedFamilyWithChild(userA, { childName: 'גיל' })
    await factory.addMember(userB, family.familyId)

    // User B has the comparison open; the child was created today, so the
    // default selection is just today, still empty.
    await signIn(page, userB)
    await openCompare(page)
    const todayRow = rowsList(page).getByRole('button', { name: /^היום/ })
    await expect(todayRow).toContainText('אין אירועים ביום זה')

    // User A, on another device, logs a diaper with one tap.
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    try {
      await signIn(pageA, userA)
      await expect(pageA).toHaveURL(/\/today$/)
      await pageA.getByRole('button', { name: 'רישום החתלה' }).click()
      await expect(pageA.getByRole('status')).toHaveText('נרשם החתלה')

      // Without any reload, B's today row picks up the diaper.
      await expect(todayRow.getByText('0ד׳ · 0 האכלות · 1 חיתול', { exact: true })).toBeVisible()
    } finally {
      await contextA.close()
    }
  })
})
