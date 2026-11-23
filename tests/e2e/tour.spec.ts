import type { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { cachedSession } from '../support/authSessions'
import { expect, test, type TestUser } from '../support/fixtures'
import { holdTodayEventsReads, openFromHeaderMenu, signIn } from '../support/pageActions'
import { testEnv } from '../support/testEnv'

/** The empty-day caption: proves the real child's clock got no practice events. */
const EMPTY_DAY_CAPTION = 'עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל'

/** The tour's popover, by its current step title. */
function tourStep(page: Page, title: string) {
  return page.getByRole('dialog', { name: title })
}

/**
 * Counts the user's practice children, as that user (RLS shows an owner their
 * own practice children). Reuses the session `signIn` already obtained, so it
 * costs no extra sign-in request.
 */
async function countPracticeChildren(user: TestUser): Promise<number> {
  const session = cachedSession(user.email)
  if (!session) throw new Error(`countPracticeChildren: no cached session for ${user.email}`)

  const client = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
  const { count, error } = await client
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('demo_owner_id', user.id)
  if (error) throw error
  return count ?? 0
}

/** Starts the tour and practises up to the step that stops the sleep timer. */
async function practiseUpToSleepStop(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user)
  await openFromHeaderMenu(page, 'סיור באפליקציה')

  const welcome = tourStep(page, 'בואו ננסה 👋')
  await expect(welcome).toBeVisible()
  await expect.poll(() => countPracticeChildren(user)).toBe(1)
  await welcome.getByRole('button', { name: 'הבא' }).click()

  await expect(tourStep(page, 'רשמו החתלה')).toBeVisible()
  await page.getByRole('button', { name: 'רישום החתלה' }).click()

  const clock = tourStep(page, 'הנה זה על השעון')
  await expect(clock).toBeVisible()
  await clock.getByRole('button', { name: 'הבא' }).click()

  await expect(tourStep(page, 'התחילו שינה')).toBeVisible()
  await page.getByRole('button', { name: 'התחלת שינה' }).click()
  await expect(tourStep(page, 'עכשיו עצרו אותה')).toBeVisible()
}

/**
 * Closes the open mood menu with an outside tap that really reaches it. driver.js
 * swallows `pointerdown` on its dark overlay, but lets it through on the popover's
 * own text.
 */
async function tapOutsideMoodMenu(page: Page): Promise<void> {
  await tourStep(page, 'בחרו מצב רוח').getByText('בחירה אחת, וזה נרשם.').click()
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
    // The counter sees the practice child, so its later 0 really means "deleted".
    await expect.poll(() => countPracticeChildren(user)).toBe(1)
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
    await expect.poll(() => countPracticeChildren(user)).toBe(0)
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
    await expect(welcome).toBeVisible()
    await expect.poll(() => countPracticeChildren(user)).toBe(1)
    await welcome.getByRole('button', { name: 'הבא' }).click()
    await expect(tourStep(page, 'רשמו החתלה')).toBeVisible()
    await page.getByRole('button', { name: 'רישום החתלה' }).click()
    await expect(tourStep(page, 'הנה זה על השעון')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('heading', { name: family.childName })).toBeVisible()
    await expect(page.getByText(EMPTY_DAY_CAPTION)).toBeVisible()
    await expect.poll(() => countPracticeChildren(user)).toBe(0)
  })

  test('closing the mood menu without choosing steps back to the mood button', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'דניאל' })

    await practiseUpToSleepStop(page, user)
    await page.getByRole('button', { name: 'עצירת שינה' }).click()

    await expect(tourStep(page, 'איך מרגיש התינוק?')).toBeVisible()
    await page.getByRole('button', { name: 'רישום מצב רוח' }).click()
    await expect(tourStep(page, 'בחרו מצב רוח')).toBeVisible()

    await tapOutsideMoodMenu(page)

    await expect(page.getByRole('menu', { name: 'בחירת מצב רוח' })).toBeHidden()
    await expect(tourStep(page, 'איך מרגיש התינוק?')).toBeVisible()
    await expect(page.getByRole('img', { name: /מצב רוח בשעה/ })).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect.poll(() => countPracticeChildren(user)).toBe(0)
  })

  test('a mood menu closed during a refetch steps back once the refetch settles', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'גאיה' })

    // No Realtime echo: the held read below is the only refetch in play.
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, () => {
      // Intentionally neither connecting to the server nor replying.
    })
    await practiseUpToSleepStop(page, user)

    // Stopping the timer writes the cache, which advances the tour, and leaves
    // its reconciling refetch held in flight.
    const hold = await holdTodayEventsReads(page)
    await page.getByRole('button', { name: 'עצירת שינה' }).click()
    const moodOpen = tourStep(page, 'איך מרגיש התינוק?')
    await expect(moodOpen).toBeVisible()
    await expect.poll(hold.heldCount).toBeGreaterThan(0)

    // The confirmation's later removal is a DOM change that would re-check the
    // tour by itself, so it must be gone before the menu closes.
    const confirmation = page.getByRole('status')
    await expect(confirmation).toHaveText('נרשמה שינה')
    await expect(confirmation).toBeHidden()

    await page.getByRole('button', { name: 'רישום מצב רוח' }).click()
    const moodPick = tourStep(page, 'בחרו מצב רוח')
    await expect(moodPick).toBeVisible()

    await tapOutsideMoodMenu(page)

    // In flight, a closed menu may be a choice being saved: no step back yet.
    await expect(page.getByRole('menu', { name: 'בחירת מצב רוח' })).toBeHidden()
    await expect(moodPick).toBeVisible()

    // The refetch settles with no change to the events or the DOM; only the
    // re-check on settling can step the tour back.
    await hold.release()
    await expect(moodOpen).toBeVisible()

    await page.keyboard.press('Escape')
    await expect.poll(() => countPracticeChildren(user)).toBe(0)
  })
})
