import type { ReactNode } from 'react'
import { Banner } from '../../components/ui/Banner'
import { ErrorScreen } from '../../components/ui/ErrorScreen'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type { AppLanguage, AppTheme, MeasurementUnit, UserPreferences } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { DEFAULT_LANGUAGE, DEFAULT_THEME, DEFAULT_UNITS, withPreferenceDefaults } from './preferencesDefaults'
import { SettingsHeader } from './SettingsHeader'
import { useUpsertUserPreferences, useUserPreferences } from './useUserPreferences'

interface SelectOption<T extends string> {
  value: T
  label: string
  /** A single option that cannot be picked yet (e.g. a not-yet-built feature). */
  disabled?: boolean
}

/** Copy shown under the language control while English is not yet available. */
const LANGUAGE_COMING_SOON_NOTE = 'אנגלית תהיה זמינה בקרוב - עובדים על זה'

const LANGUAGE_OPTIONS: readonly SelectOption<AppLanguage>[] = [
  { value: 'he', label: 'עברית' },
  // English (i18n) is not built yet - shown disabled so the option is visible
  // but cannot be selected into a language that does nothing.
  { value: 'en', label: 'English', disabled: true },
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
  /** Id of an element that explains the control (e.g. a "coming soon" caption). */
  ariaDescribedBy?: string
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
  ariaDescribedBy,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value
        // A single not-yet-available option (option.disabled) is shown faded with
        // a translucent surface, on top of the whole-control `disabled` (saving).
        const isOptionDisabled = disabled || option.disabled === true
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isOptionDisabled}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
              option.disabled
                ? 'bg-neutral-200/50 text-neutral-400'
                : isSelected
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
  const { user } = useAuth()
  const userId = user?.id

  const preferencesQuery = useUserPreferences(userId)
  const preferencesMutation = useUpsertUserPreferences()

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
      ...withPreferenceDefaults(preferences),
      language: patch.language ?? language,
      theme: patch.theme ?? theme,
      units: patch.units ?? units,
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
              ariaDescribedBy="language-coming-soon"
              options={LANGUAGE_OPTIONS}
              value={language}
              disabled={isSaving}
              onChange={(value) => savePreferences({ language: value })}
            />
            <p id="language-coming-soon" className="mt-2 text-xs text-neutral-500">
              {LANGUAGE_COMING_SOON_NOTE}{' '}
              <span aria-hidden="true">🚧</span>
            </p>
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
