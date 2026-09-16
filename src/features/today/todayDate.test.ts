import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deviceDateString, deviceDayBounds } from './todayDate'

/**
 * Regression test for the "TZ latent" CR-2 finding: `todayDate.ts` used to
 * resolve the device timezone (and its `Intl` formatters) once at MODULE
 * LOAD, so a device timezone change mid-session (e.g. travel) was not
 * reflected until a full page reload. The zone is now resolved lazily, per
 * call, so a stubbed `TZ` change is picked up immediately - no
 * `vi.resetModules()` / dynamic re-import needed (contrast with the
 * `onboarding/schemas.test.ts` workaround for the old eager-resolution
 * behavior).
 */
describe('todayDate lazy timezone resolution', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-01-01 22:30 UTC = 2026-01-02 00:30 in Asia/Jerusalem (UTC+2 in
    // winter), but still 2026-01-01 in America/New_York (UTC-5).
    vi.setSystemTime(new Date('2026-01-01T22:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('reflects a simulated device timezone change without a module reload', () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(deviceDateString()).toBe('2026-01-01')

    vi.stubEnv('TZ', 'Asia/Jerusalem')
    expect(deviceDateString()).toBe('2026-01-02')
  })

  it('recomputes day bounds for the newly-resolved zone', () => {
    vi.stubEnv('TZ', 'Asia/Jerusalem')
    const jerusalemBounds = deviceDayBounds()

    vi.stubEnv('TZ', 'America/New_York')
    const newYorkBounds = deviceDayBounds()

    expect(jerusalemBounds.startIso).not.toBe(newYorkBounds.startIso)
    // Sanity check: the Jerusalem child-day for this instant starts at
    // 2026-01-01T22:00:00.000Z (2026-01-02 00:00 local, UTC+2).
    expect(jerusalemBounds.startIso).toBe('2026-01-01T22:00:00.000Z')
    // The New York child-day for this instant starts at
    // 2026-01-01T05:00:00.000Z (2026-01-01 00:00 local, UTC-5).
    expect(newYorkBounds.startIso).toBe('2026-01-01T05:00:00.000Z')
  })

  it('reuses cached formatters for a stable zone (no thrown error, consistent output)', () => {
    vi.stubEnv('TZ', 'Asia/Jerusalem')
    const first = deviceDateString()
    const second = deviceDateString()
    expect(first).toBe(second)
  })
})
