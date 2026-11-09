import { z } from 'zod'
import { coordinatesSchema, roundCoordinates, type Coordinates } from './coordinates'

/**
 * A short-lived, device-local cache of the last successful *rounded* device
 * position. Some browsers (notably iOS Safari) re-ask for location permission
 * often; reusing a fresh cached position avoids prompting the parent on every
 * visit to the Today screen. Only one-decimal coordinates are ever stored.
 *
 * Like `savedCity`, every storage access is wrapped in try/catch and the stored
 * value is validated with Zod; anything unreadable is treated as "no cache".
 */
const STORAGE_KEY = 'baby-tracker:weather:device-coordinates'

/** How long a cached position stays usable. */
export const CACHED_COORDINATES_TTL_MS = 3 * 60 * 60 * 1000

const cachedCoordinatesSchema = coordinatesSchema.extend({
  /** Epoch milliseconds when the position was read. */
  savedAt: z.number().int().nonnegative(),
})

/**
 * Returns the cached rounded position if it was saved within the last
 * {@link CACHED_COORDINATES_TTL_MS}; otherwise null. A timestamp in the future
 * (device clock moved back) is treated as stale rather than trusted.
 */
export function readCachedCoordinates(now: number = Date.now()): Coordinates | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = cachedCoordinatesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null

    const age = now - parsed.data.savedAt
    if (age < 0 || age >= CACHED_COORDINATES_TTL_MS) return null
    return roundCoordinates(parsed.data)
  } catch {
    // Storage unavailable or malformed JSON - behave as if nothing is cached.
    return null
  }
}

/** Caches a position (rounded to one decimal) with the current timestamp. */
export function writeCachedCoordinates(coordinates: Coordinates, now: number = Date.now()): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...roundCoordinates(coordinates), savedAt: now }),
    )
  } catch {
    // Storage unavailable - we'll just ask the device again next time.
  }
}
