import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The build-time globals injected by `vite.config.ts` (`define`) are not present
// under vitest, so any module that reads them (e.g. `src/lib/appVersion.ts`,
// pulled in transitively by `src/lib/monitoring.ts`) would throw a ReferenceError
// at import. Mirror just those defines here with test-appropriate values; the
// version stays sourced from package.json, and the commit SHA is irrelevant to
// unit tests, so it is an empty string.
const packageJsonPath = fileURLToPath(new URL('./package.json', import.meta.url))
const { version: appVersion } = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
  version: string
}

// Unit tests for pure-logic modules (src/lib). Playwright E2E lives separately
// under tests/e2e and is run via the `test:e2e` scripts, not vitest.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT_SHA__: JSON.stringify(''),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
