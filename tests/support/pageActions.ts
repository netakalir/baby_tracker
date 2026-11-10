import type { Page } from '@playwright/test'
import { authStorageKey, cachedSession, signInThroughApi } from './authSessions'
import type { TestUser } from './fixtures'

/**
 * Signs the browser in WITHOUT the login form: it hands the app the session the
 * user already obtained through the auth API (normally while the `factory`
 * seeded data as them), so the test costs no extra sign-in request. Falls back
 * to a single API sign-in when the user has no cached session yet.
 *
 * The session is written to localStorage exactly as supabase-js persists it
 * (`JSON.stringify(session)` under `sb-<project-ref>-auth-token`, see
 * `_saveSession` in auth-js), then the app is reloaded so it restores it.
 *
 * The browser and the factory's API client share this session (and its
 * refresh token). That is safe: the API client never refreshes and only sends
 * the access token, which PostgREST keeps accepting until it expires even if
 * the browser rotates the refresh token or signs out. A browser sign-out was
 * already global (the app calls `signOut()` with the default 'global' scope)
 * before this helper shared sessions, and the factory's teardown tolerates the
 * revoked session.
 *
 * Use `signInThroughUi` only in tests whose subject is the login form itself.
 */
export async function signIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<void> {
  const session = cachedSession(user.email) ?? (await signInThroughApi(user)).session

  // localStorage is per origin, so the app's origin must be loaded first.
  await page.goto('/auth')
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: authStorageKey(), value: JSON.stringify(session) },
  )
  await page.goto('/')
  // Wait for the root redirect to resolve before returning, so callers can
  // safely navigate straight to a protected route without racing the auth
  // session restore (a bare goto otherwise bounces back to /auth).
  await page.waitForURL((url) => url.pathname !== '/')
  if (new URL(page.url()).pathname.startsWith('/auth')) {
    throw new Error(`signIn: the app did not restore the injected session for ${user.email}`)
  }
}

/**
 * Signs in by filling and submitting the real auth form. Field ids (`#email`,
 * `#password`) and the form's submit button are used so the helper is not tied
 * to the Hebrew label text, and so it is not ambiguous with the sign-in/sign-up
 * mode tabs. Costs one sign-in request per call - reserve it for tests of the
 * login UI and the post-login redirect.
 */
export async function signInThroughUi(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<void> {
  await page.goto('/auth')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('button[type="submit"]').click()
  // Wait for the post-login redirect to settle before returning (see `signIn`).
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

/** The Today header's navigation destinations, by their menu-item label. */
export type HeaderMenuItem = 'שבוע' | 'השוואת ימים' | 'הגדרות'

/**
 * Navigates from the Today header through its hamburger menu: opens the menu
 * ("תפריט") and taps the named item.
 */
export async function openFromHeaderMenu(page: Page, item: HeaderMenuItem): Promise<void> {
  await page.getByRole('button', { name: 'תפריט' }).click()
  await page.getByRole('menu', { name: 'תפריט' }).getByRole('menuitem', { name: item }).click()
}
