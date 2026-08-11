import type { MeasurementUnit } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { useUserPreferences } from './useUserPreferences'

/** Mirrors the user_preferences.units DB default, used before the row loads or when none exists. */
const DEFAULT_UNIT: MeasurementUnit = 'ml'

/**
 * The signed-in user's measurement unit ('ml' | 'oz') for displaying amounts.
 * Reads the shared user_preferences cache and falls back to ml while it loads or
 * when the user has no row yet, so amount displays always have a concrete unit.
 * Display-only: stored amounts remain canonical millilitres.
 */
export function useDisplayUnit(): MeasurementUnit {
  const { user } = useAuth()
  const { data: preferences } = useUserPreferences(user?.id)
  return preferences?.units ?? DEFAULT_UNIT
}
