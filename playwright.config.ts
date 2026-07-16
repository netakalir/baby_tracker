import { defineConfig, devices } from '@playwright/test'
import { testEnv } from './tests/support/testEnv'

/**
 * E2E tests run the real app (Vite dev server) against the hosted Supabase
 * project. Throwaway users are created (pre-confirmed) and deleted per test
 * via the service_role key in `.env.test` - see tests/support/fixtures.ts.
 *
 * Runs serially (a single worker) on purpose: the tests share one hosted
 * project and its auth rate limits, so parallel sign-ins would be flaky.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
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
