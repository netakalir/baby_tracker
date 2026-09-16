import type {
  AppLanguage,
  AppTheme,
  MeasurementUnit,
  UserPreferences,
  UserPreferencesUpsert,
} from '../../types/database'

/**
 * Single source of truth for the `user_preferences` DB column defaults. Used
 * whenever no row exists yet (first-time user) or while the preferences query
 * is still loading, so every screen/hook that reads or upserts preferences
 * agrees on the same fallback values instead of each re-declaring its own copy
 * (DisplayScreen, NotificationsScreen, ThemeProvider, useDisplayUnit).
 */
export const DEFAULT_LANGUAGE: AppLanguage = 'he'
export const DEFAULT_THEME: AppTheme = 'system'
export const DEFAULT_UNITS: MeasurementUnit = 'ml'
export const DEFAULT_NOTIF_FEEDING = false
export const DEFAULT_NOTIF_SLEEP = false
export const DEFAULT_NOTIF_DAILY_SUMMARY = false

/**
 * Builds a full `user_preferences` row (minus `user_id`) from a possibly-null
 * stored row, filling in the DB defaults for any missing field. Useful for
 * upserts that must always send the complete row (see `UserPreferencesUpsert`).
 */
export function withPreferenceDefaults(
  stored: UserPreferences | null | undefined,
): Omit<UserPreferencesUpsert, 'user_id'> {
  return {
    display_name: stored?.display_name ?? null,
    language: stored?.language ?? DEFAULT_LANGUAGE,
    theme: stored?.theme ?? DEFAULT_THEME,
    units: stored?.units ?? DEFAULT_UNITS,
    notif_feeding: stored?.notif_feeding ?? DEFAULT_NOTIF_FEEDING,
    notif_sleep: stored?.notif_sleep ?? DEFAULT_NOTIF_SLEEP,
    notif_daily_summary: stored?.notif_daily_summary ?? DEFAULT_NOTIF_DAILY_SUMMARY,
  }
}
