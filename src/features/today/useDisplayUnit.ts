import type { Unit } from '../../lib/units'
import { useAuth } from '../auth/useAuth'
import { useUserPreferences } from '../settings/useUserPreferences'

/**
 * The signed-in user's measurement unit for feeding amounts ('ml' | 'oz'),
 * defaulting to 'ml' until preferences load or when none are set. Amounts are
 * stored canonically in millilitres, so this is a per-viewer display choice only
 * (mirrors the DisplayScreen `preferences?.units` read).
 */
export function useDisplayUnit(): Unit {
  const { user } = useAuth()
  const { data } = useUserPreferences(user?.id)
  return data?.units ?? 'ml'
}
