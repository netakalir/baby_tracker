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

/** `GeolocationPositionError.PERMISSION_DENIED` (a literal, so it also works outside a browser). */
const PERMISSION_DENIED_CODE = 1

/**
 * Why no device position is available:
 * - `denied` - the browser blocks location for this site (the parent can lift
 *   it in the site settings);
 * - `unavailable` - anything else: timeout, no fix, no Geolocation API, or a
 *   prompt that was never answered.
 */
export type DevicePositionFailure = 'denied' | 'unavailable'

export type DevicePositionResult =
  | { status: 'located'; coordinates: Coordinates }
  | { status: DevicePositionFailure }

/** Classifies a `GeolocationPositionError.code`. */
export function classifyPositionError(code: number): DevicePositionFailure {
  return code === PERMISSION_DENIED_CODE ? 'denied' : 'unavailable'
}

/**
 * The geolocation permission state from the Permissions API, or `unknown` when
 * the API is missing or the query fails (e.g. Safari before 16). Only `denied`
 * is acted on: it lets us explain the block without a doomed request.
 */
async function readGeolocationPermission(): Promise<PermissionState | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unknown'
  }
}

/** Calls the Geolocation API once and classifies the outcome; never rejects. */
function getCurrentDevicePosition(): Promise<DevicePositionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ status: 'unavailable' })
      return
    }

    let settled = false
    const settle = (result: DevicePositionResult): void => {
      if (settled) return
      settled = true
      clearTimeout(guard)
      resolve(result)
    }
    const guard = setTimeout(() => settle({ status: 'unavailable' }), OVERALL_TIMEOUT_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Round immediately: the precise position never leaves this callback.
        const rounded = roundCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        writeCachedCoordinates(rounded)
        settle({ status: 'located', coordinates: rounded })
      },
      (error) => settle({ status: classifyPositionError(error.code) }),
      { enableHighAccuracy: false, timeout: POSITION_TIMEOUT_MS, maximumAge: POSITION_MAX_AGE_MS },
    )
  })
}

/**
 * Asks the device for a *fresh* position (ignoring the cache) - used when the
 * parent explicitly taps "use my location". The permission state is re-checked
 * on every call, so a block lifted in the site settings is picked up; when it
 * is `denied`, no request is made at all. A success refreshes the cached
 * position; a failure leaves the cache untouched. Never rejects.
 */
export async function requestDevicePosition(): Promise<DevicePositionResult> {
  if ((await readGeolocationPermission()) === 'denied') return { status: 'denied' }
  return getCurrentDevicePosition()
}

/**
 * Resolves the device position for an automatic (on-mount) lookup: a fresh
 * cached position (see `cachedCoordinates`) is reused without touching the
 * Geolocation API, so the parent is not re-prompted on every visit; otherwise
 * it behaves like {@link requestDevicePosition}. Never rejects - "no location"
 * is an expected state the strip handles by offering a city search, not a
 * failure to report.
 */
export function readDevicePosition(): Promise<DevicePositionResult> {
  const cached = readCachedCoordinates()
  if (cached) return Promise.resolve({ status: 'located', coordinates: cached })
  return requestDevicePosition()
}
