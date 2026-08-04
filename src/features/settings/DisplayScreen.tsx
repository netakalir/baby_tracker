import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banner } from '../../components/ui/Banner'
import { ErrorScreen } from '../../components/ui/ErrorScreen'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { supabase } from '../../lib/supabase'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type {
  AppLanguage,
  AppTheme,
  MeasurementUnit,
  UserPreferences,
  UserPreferencesUpsert,
} from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { SettingsHeader } from './SettingsHeader'

/**
 * Defaults that mirror the user_preferences DB column defaults. Used when no row
 * exists yet, so a first-time user still sees a sensible, non-empty selection
 * before their first save.
 */
const DEFAULT_LANGUAGE: AppLanguage = 'he'
const DEFAULT_THEME: AppTheme = 'system'
const DEFAULT_UNITS: MeasurementUnit = 'ml'

const userPreferencesKey = (userId: string): [string, string] => ['user-preferences', userId]

/** Reads the signed-in user's private preferences row, or null if none yet. */
async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<UserPreferences>()

  if (error) throw error
  return data
}

/**
 * Upserts the user's preferences. The full row is sent (merged over the current
 * values or defaults) so changing one field never clears the others; upsert
 * keyed by user_id creates the row lazily on first save.
 */
async function upsertUserPreferences(row: UserPreferencesUpsert): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single<UserPreferences>()

  if (error) throw error
  return data
}

interface SelectOption<T extends string> {
  value: T
  label: string
}

const LANGUAGE_OPTIONS: readonly SelectOption<AppLanguage>[] = [
  { value: 'he', label: 'עברית' },
  { value: 'en', label: 'English' },
]

const THEME_OPTIONS: readonly SelectOption<AppTheme>[] = [
  { value: 'light', label: 'בהיר' },
  { value: 'dark', label: 'כהה' },
  { value: 'system', label: 'לפי המערכת' },
]

const UNIT_OPTIONS: readonly SelectOption<MeasurementUnit>[] = [
  { value: 'ml', label: 'מ״ל' },
  { value: 'oz', label: 'אונקיות' },
]

interface SegmentedControlProps<T extends string> {
  options: readonly SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  ariaLabel: string
}

/**
 * A segmented selector: one tap to switch, brief color feedback only. Preferred
 * over a native <select> here because the option counts are tiny and a large,
 * always-visible target is faster one-handed.
 */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
              isSelected
                ? 'bg-neutral-0 text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface SettingSectionProps {
  title: string
  note?: string
  children: ReactNode
}

/** A titled block wrapping one control, matching the settings list surface. */
function SettingSection({ title, note, children }: SettingSectionProps) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {note ? <p className="mt-0.5 text-xs text-neutral-500">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * The "Display & language" settings sub-screen (spec §3.3). All three controls
 * are per-user (user_preferences): language, theme, and measurement units. Units
 * are per-user because amounts are stored canonically in ml, so ml/oz is a
 * lossless per-viewer display choice (see the move_units migration and CLAUDE.md).
 *
 * Note: this screen only stores and reflects the preferences. Live i18n / RTL
 * switching, applying the theme, and converting amounts by the chosen unit are a
 * later layer (spec §5) — not wired here. The day-boundary (day_start) is a
 * per-child setting and is intentionally NOT exposed here (deferred).
 */
export function DisplayScreen() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  const preferencesQuery = useQuery({
    queryKey: userPreferencesKey(userId ?? 'anonymous'),
    queryFn: () => fetchUserPreferences(userId!),
    enabled: Boolean(userId),
  })

  const preferencesMutation = useMutation({
    mutationFn: upsertUserPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(userPreferencesKey(updated.user_id), updated)
    },
  })

  if (preferencesQuery.isPending) {
    return <LoadingScreen />
  }

  if (preferencesQuery.isError) {
    return <ErrorScreen onRetry={() => void preferencesQuery.refetch()} />
  }

  const preferences = preferencesQuery.data

  const language = preferences?.language ?? DEFAULT_LANGUAGE
  const theme = preferences?.theme ?? DEFAULT_THEME
  const units = preferences?.units ?? DEFAULT_UNITS

  /** Builds the full user_preferences row from current values, overriding one field. */
  const savePreferences = (
    patch: Partial<Pick<UserPreferences, 'language' | 'theme' | 'units'>>,
  ) => {
    if (!userId) return
    preferencesMutation.mutate({
      user_id: userId,
      display_name: preferences?.display_name ?? null,
      language: patch.language ?? language,
      theme: patch.theme ?? theme,
      units: patch.units ?? units,
      notif_feeding: preferences?.notif_feeding ?? false,
      notif_sleep: preferences?.notif_sleep ?? false,
      notif_daily_summary: preferences?.notif_daily_summary ?? false,
    })
  }

  const isSaving = preferencesMutation.isPending

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="תצוגה ושפה" backTo="/settings" />

        {preferencesMutation.error ? (
          <div className="mt-6">
            <Banner message={toFriendlyDbErrorMessage(preferencesMutation.error)} variant="error" />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          <SettingSection title="שפה">
            <SegmentedControl
              ariaLabel="שפה"
              options={LANGUAGE_OPTIONS}
              value={language}
              disabled={isSaving}
              onChange={(value) => savePreferences({ language: value })}
            />
          </SettingSection>

          <SettingSection title="ערכת נושא">
            <SegmentedControl
              ariaLabel="ערכת נושא"
              options={THEME_OPTIONS}
              value={theme}
              disabled={isSaving}
              onChange={(value) => savePreferences({ theme: value })}
            />
          </SettingSection>

          <SettingSection title="יחידות מדידה">
            <SegmentedControl
              ariaLabel="יחידות מדידה"
              options={UNIT_OPTIONS}
              value={units}
              disabled={isSaving}
              onChange={(value) => savePreferences({ units: value })}
            />
          </SettingSection>
        </div>
      </div>
    </div>
  )
}
