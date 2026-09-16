import { expect, test } from '../support/fixtures'

/**
 * End-to-end coverage for the app-level Sentry ErrorBoundary (see
 * src/main.tsx + src/components/ui/AppErrorFallback.tsx). Proves that when a
 * render error occurs anywhere in the app tree, the boundary catches it and
 * shows the on-brand Hebrew fallback instead of blanking the screen.
 *
 * The crash is forced through the dev-only `/__boundary-check` route, which is
 * mounted only when `import.meta.env.DEV` is true (Playwright runs against
 * `npm run dev`) and is stripped from production builds. No auth is needed: the
 * route sits outside the app's auth guards.
 */
test.describe('App-level Sentry ErrorBoundary', () => {
  test('a render error shows the Hebrew fallback with recovery actions', async ({ page }) => {
    // Sanity: a normal public route renders without the fallback.
    await page.goto('/auth')
    await expect(page.getByRole('heading', { name: 'משהו השתבש' })).toBeHidden()

    // Triggering a render error surfaces the fallback instead of a blank screen.
    await page.goto('/__boundary-check')
    await expect(page.getByRole('heading', { name: 'משהו השתבש' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'נסה שוב' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'רענן את הדף' })).toBeVisible()
  })
})
