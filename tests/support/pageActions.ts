import type { Page } from '@playwright/test'
import type { TestUser } from './fixtures'

/**
 * Signs in through the real auth UI. Field ids (`#email`, `#password`) and the
 * form's submit button are used so the helper is not tied to the Hebrew label
 * text, and so it is not ambiguous with the sign-in/sign-up mode tabs.
 */
export async function signIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<void> {
  await page.goto('/auth')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('button[type="submit"]').click()
  // Wait for the post-login redirect to settle before returning, so callers can
  // safely navigate straight to a protected route without racing the auth
  // session restore (a bare goto otherwise bounces back to /auth).
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}
