import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { addChildSchema as AddChildSchemaType } from './schemas'

/**
 * Regression test for the device-tz birth-date bug: the future-date check
 * must use the DEVICE-local calendar day (see `todayDate.deviceDateString`),
 * not the UTC calendar day. Shortly after local midnight in a zone ahead of
 * UTC (e.g. Israel, UTC+2), the UTC date is still "yesterday" - a same-local-day
 * birth date must not be rejected as "in the future".
 *
 * `todayDate.ts` now resolves the device timezone lazily (per call, memoized
 * per zone) rather than once at module load, so a stubbed `TZ` is picked up
 * without a module reload. This test still loads `./schemas` via a dynamic
 * re-import after `vi.stubEnv('TZ', ...)` for isolation between cases (each
 * `it` gets its own module instance), but that reset is no longer required
 * purely to make the stubbed zone take effect.
 */
describe('addChildSchema birthDate validation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadAddChildSchemaWithTz(tz: string): Promise<typeof AddChildSchemaType> {
    vi.stubEnv('TZ', tz)
    vi.resetModules()
    const module = await import('./schemas')
    return module.addChildSchema
  }

  it('accepts a birth date equal to today in the device timezone, even when UTC is still the previous day', async () => {
    // 2026-01-01 22:30 UTC = 2026-01-02 00:30 in Asia/Jerusalem (UTC+2 in winter).
    vi.setSystemTime(new Date('2026-01-01T22:30:00.000Z'))
    const addChildSchema = await loadAddChildSchemaWithTz('Asia/Jerusalem')

    const result = addChildSchema.safeParse({ name: 'תינוק', birthDate: '2026-01-02' })

    expect(result.success).toBe(true)
  })

  it('rejects a birth date that is genuinely in the future in the device timezone', async () => {
    vi.setSystemTime(new Date('2026-01-01T22:30:00.000Z'))
    const addChildSchema = await loadAddChildSchemaWithTz('Asia/Jerusalem')

    const result = addChildSchema.safeParse({ name: 'תינוק', birthDate: '2026-01-03' })

    expect(result.success).toBe(false)
  })
})
