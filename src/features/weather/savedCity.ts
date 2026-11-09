import { z } from 'zod'
import { coordinatesSchema } from './coordinates'

/**
 * The city a parent picked manually in the weather strip, persisted on this
 * device only (never in Supabase). When present it takes precedence over the
 * device location.
 *
 * Storage is advisory: every access is wrapped in try/catch (private mode /
 * disabled storage throws), and the stored JSON is validated with Zod — a
 * corrupted or foreign value is treated as "no saved city".
 */
const STORAGE_KEY = 'baby-tracker:weather:saved-city'

export const savedCitySchema = coordinatesSchema.extend({
  name: z.string().trim().min(1).max(200),
})

export type SavedCity = z.infer<typeof savedCitySchema>

/** Reads the saved city, or null when none / unreadable / invalid. */
export function readSavedCity(): SavedCity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = savedCitySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    // Storage unavailable or malformed JSON - behave as if nothing is saved.
    return null
  }
}

/** Persists the chosen city. No-op when storage is unavailable. */
export function writeSavedCity(city: SavedCity): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCitySchema.parse(city)))
  } catch {
    // Storage unavailable - the choice still applies for this session.
  }
}

/** Removes the saved city. No-op when storage is unavailable. */
export function clearSavedCity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable - nothing persisted to clear.
  }
}
