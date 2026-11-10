import { defineConfig, devices } from '@playwright/test'
import { testEnv } from './tests/support/testEnv'

/**
 * E2E tests run the real app (Vite dev server) against the hosted Supabase
 * project. Throwaway users are created (pre-confirmed) and deleted per test
 * via the service_role key in `.env.test` - see tests/support/fixtures.ts.
 *
 * Runs with a small, fixed pool of workers: the tests share one hosted project
 * and its auth rate limits. `signIn` reuses the factory's API session instead
 * of submitting the login form (tests/support/authSessions.ts), which cut the
 * sign-ins per run enough for 3 parallel workers to stay within those limits
 * (verified: two full runs, 74/74, ~4 min vs ~9 min serially). Raise this only
 * together with the test project's auth rate limits. Tests within one file
 * still run in order (`fullyParallel: false`); each test seeds its own users.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  /*
   * Web-first assertions poll until they pass, so this is an upper bound on a
   * real async operation, not a fixed wait. The default 5s is too tight for the
   * post-login redirect, which chains two round-trips to the *hosted* Supabase
   * project (auth session, then the onboarding-status queries) - the main source
   * of pre-existing flakiness in these tests.
   */
  expect: { timeout: 15_000 },
  use: {
    baseURL: testEnv.baseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: testEnv.baseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
