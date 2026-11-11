import { expect, test } from '../support/fixtures'
import { openFromHeaderMenu, signIn } from '../support/pageActions'

/** Titles of the tour's steps, in order (see src/features/tour/tourSteps.ts). */
const STEP_TITLES = [
  'ברוכים הבאים 👋',
  'השעון היומי',
  'רישום בנגיעה אחת',
  'ההאכלה והשינה הבאות',
  'מזג אוויר והלבשה',
  'עוד מסכים',
] as const

test.describe('app tour', () => {
  test('the tour can be started from the header menu and walked to the end', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'אורי' })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // A returning member is never interrupted by the tour on their own.
    await expect(page.getByRole('dialog')).toBeHidden()

    await openFromHeaderMenu(page, 'סיור באפליקציה')
    const dialog = page.getByRole('dialog')

    for (const [index, title] of STEP_TITLES.entries()) {
      await expect(dialog).toHaveAccessibleName(title)
      await expect(dialog.getByText(`${index + 1} מתוך ${STEP_TITLES.length}`)).toBeVisible()
      if (index < STEP_TITLES.length - 1) {
        await dialog.getByRole('button', { name: 'הבא' }).click()
      }
    }

    // Back goes one step back; the last step ends with "סיום".
    await dialog.getByRole('button', { name: 'הקודם' }).click()
    await expect(dialog).toHaveAccessibleName(STEP_TITLES[STEP_TITLES.length - 2])
    await dialog.getByRole('button', { name: 'הבא' }).click()
    await dialog.getByRole('button', { name: 'סיום' }).click()
    await expect(dialog).toBeHidden()

    // The page is usable again once the tour is over.
    await page.getByRole('button', { name: 'רישום החתלה' }).click()
    await expect(page.getByRole('status')).toHaveText('נרשם החתלה')
  })

  test('Escape closes the tour', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'מיה' })

    await signIn(page, user)
    await openFromHeaderMenu(page, 'סיור באפליקציה')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAccessibleName(STEP_TITLES[0])
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
