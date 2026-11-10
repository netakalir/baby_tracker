import type { DevicePositionResult } from './devicePosition'
import { createLatestRequestGate } from './latestRequestGate'

/** What one "use my location" attempt does, supplied by the caller per call. */
export interface LocateEffects {
  /** Asks the device for a position (never rejects). */
  request: () => Promise<DevicePositionResult>
  /** Reports whether this attempt is still pending (only while it is current). */
  setPending: (pending: boolean) => void
  /** Applies a *current* result (switch location, cache it, explain a failure...). */
  apply: (result: DevicePositionResult) => void
}

export interface DeviceLocator {
  /**
   * Runs one attempt. Resolves with the result once applied, or with `null`
   * when the attempt was superseded while waiting - by {@link cancel} or by a
   * newer `locate` - in which case `apply` is never called and nothing changes.
   */
  locate: (effects: LocateEffects) => Promise<DevicePositionResult | null>
  /**
   * Abandons any pending attempt: its late result will be ignored. Called when
   * the parent chooses a city, starts searching, closes the panel, or leaves.
   */
  cancel: () => void
}

/**
 * The framework-free core of `useWeatherLocation().locateDevice`: it owns the
 * "only the latest, not-cancelled attempt may change anything" rule, so it can
 * be unit-tested without rendering React. The hook supplies the side effects.
 */
export function createDeviceLocator(): DeviceLocator {
  const gate = createLatestRequestGate()

  return {
    async locate({ request, setPending, apply }) {
      const token = gate.begin()
      setPending(true)

      const result = await request()

      if (!gate.isCurrent(token)) return null
      setPending(false)
      apply(result)
      return result
    },
    cancel() {
      gate.invalidate()
    },
  }
}
