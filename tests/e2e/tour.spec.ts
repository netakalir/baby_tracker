import type { Page } from '@playwright/test'
import { adminClient } from '../support/adminClient'
import { expect, test } from '../support/fixtures'
import { openFromHeaderMenu, signIn } from '../support/pageActions'

/** The empty-day caption: proves the real child's clock got no practice events. */
const EMPTY_DAY_CAPTION = 'עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל'

/** The tour's popover, by its current step title. */
function tourStep(page: Page, title: string) {
  return page.getByRole('dialog', { name: title })
}

/** Counts the user's practice children, bypassing RLS. */
async function countPracticeChildren(ownerId: string): Promise<number> {
  const { count, error } = await adminClient
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('demo_owner_id', ownerId)
  if (error) throw error
  return count ?? 0
}

test.describe('interactive app tour', () => {
  test('the parent practises every action on a practice child, which is deleted at the end', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'אורי' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // A returning member is never interrupted by the tour on their own.
    await expect(page.getByRole('dialog')).toBeHidden()

    await openFromHeaderMenu(page, 'סיור באפליקציה')

    // The screen switches to the practice child.
    const welcome = tourStep(page, 'בואו ננסה 👋')
    await expect(welcome).toBeVisible()
    await expect(page.getByRole('heading', { name: 'תינוק תרגול' })).toBeVisible()
    await expect(page.getByText('מצב תרגול')).toBeVisible()
    await welcome.getByRole('button', { name: 'הבא' }).click()

    // Action step: no "הבא" - only doing the action moves on.
    const diaper = tourStep(page, 'רשמו החתלה')
    await expect(diaper).toBeVisible()
    await expect(diaper.getByRole('button', { name: 'הבא' })).toHaveCount(0)
    await page.getByRole('button', { name: 'רישום החתלה' }).click()

    const clock = tourStep(page, 'הנה זה על השעון')
    await expect(clock).toBeVisible()
    await expect(page.getByRole('img', { name: /החתלה בשעה/ })).toBeVisible()
    await clock.getByRole('button', { name: 'הבא' }).click()

    await expect(tourStep(page, 'התחילו שינה')).toBeVisible()
    await page.getByRole('button', { name: 'התחלת שינה' }).click()

    await expect(tourStep(page, 'עכשיו עצרו אותה')).toBeVisible()
    await page.getByRole('button', { name: 'עצירת שינה' }).click()

    await expect(tourStep(page, 'איך מרגיש התינוק?')).toBeVisible()
    await page.getByRole('button', { name: 'רישום מצב רוח' }).click()

    await expect(tourStep(page, 'בחרו מצב רוח')).toBeVisible()
    await page.getByRole('menu', { name: 'בחירת מצב רוח' }).getByRole('menuitem').first().click()

    const estimates = tourStep(page, 'ההאכלה והשינה הבאות')
    await expect(estimates).toBeVisible()
    await estimates.getByRole('button', { name: 'הבא' }).click()

    const menu = tourStep(page, 'עוד מסכים')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: 'סיום' }).click()

    // Back on the real child, whose day is untouched by the practice.
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()
    await expect(page.getByText('מצב תרגול')).toBeHidden()
    await expect(page.getByText(EMPTY_DAY_CAPTION)).toBeVisible()

    // The practice child (and, by cascade, its events) is gone.
    await expect.poll(() => countPracticeChildren(user.id)).toBe(0)
  })

  test('skipping midway with Escape also returns to the real child and cleans up', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    const family = await factory.seedFamilyWithChild(user, { childName: 'מיה' })

    await signIn(page, user)
    await openFromHeaderMenu(page, 'סיור באפליקציה')

    const welcome = tourStep(page, 'בואו ננסה 👋')
    await welcome.getByRole('button', { name: 'הבא' }).click()
    await expect(tourStep(page, 'רשמו החתלה')).toBeVisible()
    await page.getByRole('button', { name: 'רישום החתלה' }).click()
    await expect(tourStep(page, 'הנה זה על השעון')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()
    await expect(page.getByText(EMPTY_DAY_CAPTION)).toBeVisible()
    await expect.poll(() => countPracticeChildren(user.id)).toBe(0)
  })
})
