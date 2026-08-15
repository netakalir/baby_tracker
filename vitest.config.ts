import { defineConfig } from 'vitest/config'

// Unit tests for pure-logic modules (src/lib). Playwright E2E lives separately
// under tests/e2e and is run via the `test:e2e` scripts, not vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
