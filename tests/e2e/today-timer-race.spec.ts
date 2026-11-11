import type { BrowserContext, Page } from '@playwright/test'
import { expect, test, type TestFactory, type TestUser } from '../support/fixtures'
import { signIn } from '../support/pageActions'

/**
 * Both parents act on the same sleep timer at nearly the same moment, each on
 * their own phone (a separate browser context per parent).
 *
 * The race window is "the other parent's change has reached the database but
 * not yet this screen over Realtime". To hit it deterministically rather than
 * by timing luck, parent B's Realtime socket is held open but silent: B's
 * screen never hears about A's taps, so B always acts on stale state, exactly
 * as in a real near-simultaneous tap.
 */

/** Matches the Supabase Realtime websocket (`/realtime/v1/websocket`). */
const REALTIME_SOCKET = /\/realtime\/v1\/websocket/

/**
 * Accepts the page's Realtime connection without forwarding it to the server,
 * so no change from the other device is ever pushed to this screen.
 */
async function silenceRealtime(page: Page): Promise<void> {
  await page.routeWebSocket(REALTIME_SOCKET, () => {
    // Intentionally neither connecting to the server nor replying.
  })
}

interface TwoParents {
  parentA: TestUser
  parentB: TestUser
  childId: string
  /** Parent A's own device (a separate browser context). */
  pageA: Page
  contextA: BrowserContext
}

/**
 * Seeds one family with two parents and puts both on the Today screen: A on a
 * fresh context, B on this test's `page` with Realtime silenced.
 */
async function openTodayForTwoParents(
  factory: TestFactory,
  pageB: Page,
  newContext: () => Promise<BrowserContext>,
): Promise<TwoParents> {
  const parentA = await factory.createUser()
  const parentB = await factory.createUser()
  const family = await factory.seedFamilyWithChild(parentA)
  await factory.addMember(parentB, family.familyId)

  await silenceRealtime(pageB)
  await signIn(pageB, parentB)
  await expect(pageB).toHaveURL(/\/today$/)

  const contextA = await newContext()
  const pageA = await contextA.newPage()
  await signIn(pageA, parentA)
  await expect(pageA).toHaveURL(/\/today$/)

  return { parentA, parentB, childId: family.childId, pageA, contextA }
}

test.describe('Today screen - both parents tap the same timer at once', () => {
  test('a double start leaves exactly one running sleep, adopted by both parents', async ({
    page: pageB,
    browser,
    factory,
  }) => {
    const { parentA, childId, pageA, contextA } = await openTodayForTwoParents(
      factory,
      pageB,
      () => browser.newContext(),
    )
    try {
      // Both screens show sleep as idle.
      await expect(pageA.getByRole('button', { name: 'התחלת שינה' })).toBeVisible()
      await expect(pageB.getByRole('button', { name: 'התחלת שינה' })).toBeVisible()

      // A starts the sleep; B's screen never hears about it.
      await pageA.getByRole('button', { name: 'התחלת שינה' }).click()
      await expect(pageA.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()
      await expect(pageB.getByRole('button', { name: 'התחלת שינה' })).toBeVisible()

      // B, still seeing an idle button, taps "start" too. The database refuses a
      // second running sleep and B's screen joins A's timer instead.
      await pageB.getByRole('button', { name: 'התחלת שינה' }).click()
      await expect(pageB.getByRole('status')).toHaveText('השינה כבר התחילה במכשיר אחר')
      await expect(pageB.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()
      await expect(pageB.getByRole('alert')).toHaveCount(0)

      // Exactly one running sleep exists, and A's screen is unchanged.
      expect(await factory.countRunningEvents(parentA, childId, 'sleep')).toBe(1)
      await expect(pageA.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()
    } finally {
      await contextA.close()
    }
  })

  test('a double stop stops the sleep once and shows no error to either parent', async ({
    page: pageB,
    browser,
    factory,
  }) => {
    const { parentA, childId, pageA, contextA } = await openTodayForTwoParents(
      factory,
      pageB,
      () => browser.newContext(),
    )
    try {
      // A starts a sleep; B reloads so both screens show it running. (B's
      // Realtime is silenced, so a reload is how B learns of it here.)
      await pageA.getByRole('button', { name: 'התחלת שינה' }).click()
      await expect(pageA.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()
      await pageB.reload()
      await expect(pageB.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()

      // A stops the sleep; B's screen still shows it running.
      await pageA.getByRole('button', { name: 'עצירת שינה' }).click()
      await expect(pageA.getByRole('status')).toHaveText('נרשמה שינה')
      await expect(pageA.getByRole('button', { name: 'התחלת שינה' })).toBeVisible()
      await expect(pageB.getByRole('button', { name: 'עצירת שינה' })).toBeVisible()

      // B taps "stop" on the already-stopped sleep: a gentle note, no error,
      // and B's screen catches up to the stopped state.
      await pageB.getByRole('button', { name: 'עצירת שינה' }).click()
      await expect(pageB.getByRole('status')).toHaveText('השינה כבר נעצרה במכשיר אחר')
      await expect(pageB.getByRole('button', { name: 'התחלת שינה' })).toBeVisible()
      await expect(pageB.getByRole('alert')).toHaveCount(0)
      await expect(pageA.getByRole('alert')).toHaveCount(0)

      expect(await factory.countRunningEvents(parentA, childId, 'sleep')).toBe(0)
    } finally {
      await contextA.close()
    }
  })
})

test.describe('Today screen - a timer still running from before today', () => {
  test('an overnight sleep still running shows as running and can be stopped', async ({
    page,
    factory,
  }) => {
    const parent = await factory.createUser()
    const family = await factory.seedFamilyWithChild(parent)
    // Started 25 hours ago, so it began before today's window whatever the
    // time of day, and has never been stopped.
    const startedBeforeToday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    await factory.seedEvents(parent, family.childId, [
      { type: 'sleep', start_time: startedBeforeToday, end_time: null },
    ])

    await signIn(page, parent)
    await expect(page).toHaveURL(/\/today$/)

    await page.getByRole('button', { name: 'עצירת שינה' }).click()
    await expect(page.getByRole('status')).toHaveText('נרשמה שינה')
    await expect(page.getByRole('button', { name: 'התחלת שינה' })).toBeVisible()
    expect(await factory.countRunningEvents(parent, family.childId, 'sleep')).toBe(0)
  })
})
