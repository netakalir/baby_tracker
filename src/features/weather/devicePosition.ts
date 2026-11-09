import { readCachedCoordinates, writeCachedCoordinates } from './cachedCoordinates'
import { roundCoordinates, type Coordinates } from './coordinates'

/** Give up on a position after this long and fall back to choosing a city. */
const POSITION_TIMEOUT_MS = 10_000

/**
 * Overall cap, covering the permission prompt itself. The Geolocation API's own
 * `timeout` only starts once permission is granted, and some browsers never
 * call back at all when the prompt is dismissed - without this the strip could
 * stay in its loading state forever.
 */
const OVERALL_TIMEOUT_MS = 30_000

/** Accept a position the browser already holds if it is at most this old. */
const POSITION_MAX_AGE_MS = 30 * 60 * 1000

/**
 * Resolves the device's position, rounded to one decimal, or null when it is
 * unavailable for any reason (no Geolocation API, permission denied, timeout,
 * position error). It never rejects: "no location" is an expected state that
 * the strip handles by offering a city search, not a failure to report.
 *
 * A fresh cached position (see `cachedCoordinates`) is reused without touching
 * the Geolocation API, so the parent is not re-prompted on every visit. A new
 * successful reading refreshes that cache. The precise position is rounded
 * before it leaves this function and is never logged.
 *
 * When there is no fresh cache, `getCurrentPosition` is invoked synchronously
 * inside the promise executor, so calling this from a click handler keeps the
 * request inside the user gesture.
 */
export function readDevicePosition(): Promise<Coordinates | null> {
  const cached = readCachedCoordinates()
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null)
      return
    }

    let settled = false
    const settle = (value: Coordinates | null): void => {
      if (settled) return
      settled = true
      clearTimeout(guard)
      resolve(value)
    }
    const guard = setTimeout(() => settle(null), OVERALL_TIMEOUT_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rounded = roundCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        writeCachedCoordinates(rounded)
        settle(rounded)
      },
      () => settle(null),
      { enableHighAccuracy: false, timeout: POSITION_TIMEOUT_MS, maximumAge: POSITION_MAX_AGE_MS },
    )
  })
}
