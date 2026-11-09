import { Button } from '../../components/ui/Button'
import type { CurrentWeather } from './api'
import { CitySearch } from './CitySearch'
import type { DevicePositionFailure } from './devicePosition'
import { dressingAdviceFor } from './dressingAdvice'
import type { SavedCity } from './savedCity'
import { formatDegrees } from './formatDegrees'

export type WeatherPanelMode = 'details' | 'search'

/** Quiet explanations for why the device location could not be used. */
const LOCATION_FAILURE_NOTES: Record<DevicePositionFailure, string> = {
  denied: 'הגישה למיקום חסומה בדפדפן. אפשר לאפשר אותה בהגדרות האתר, או לבחור עיר.',
  unavailable: 'לא הצלחנו לאתר מיקום. אפשר לבחור עיר.',
}

interface WeatherPanelProps {
  id: string
  mode: WeatherPanelMode
  /** Current conditions, or null when unavailable (no location / fetch failed). */
  weather: CurrentWeather | null
  /** Whether "use my location" is worth offering (i.e. we're not already on it). */
  canUseDeviceLocation: boolean
  /** True while a "use my location" request is in flight. */
  isLocatingDevice: boolean
  /** Why the device location is unavailable, when known - shown as a quiet note. */
  locationFailure: DevicePositionFailure | null
  onSearchCity: () => void
  /** Called as the parent types in the city search (they've given up on location). */
  onSearchInput: () => void
  onChooseCity: (city: SavedCity) => void
  onUseDeviceLocation: () => void
}

/**
 * The small inline panel that opens under the weather strip. In `details` mode
 * it shows the feels-like temperature, the full dressing advice and a short
 * disclaimer, with actions to switch city or go back to the device location;
 * in `search` mode it shows the city search.
 */
export function WeatherPanel({
  id,
  mode,
  weather,
  canUseDeviceLocation,
  isLocatingDevice,
  locationFailure,
  onSearchCity,
  onSearchInput,
  onChooseCity,
  onUseDeviceLocation,
}: WeatherPanelProps) {
  return (
    <div
      id={id}
      className="mt-2 space-y-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm"
    >
      {mode === 'search' ? (
        <CitySearch onChoose={onChooseCity} onInput={onSearchInput} />
      ) : (
        <>
          {weather ? (
            <div className="space-y-1">
              <p className="text-sm text-neutral-600">
                מרגיש כמו <span dir="ltr">{formatDegrees(weather.apparentTemperature)}</span>
              </p>
              <p className="text-base font-medium text-neutral-900">
                {dressingAdviceFor(weather.apparentTemperature)}
              </p>
              <p className="text-xs text-neutral-400">טיפ כללי, לא הנחיה רפואית</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">מזג האוויר לא זמין כרגע</p>
          )}

          <Button type="button" variant="secondary" onClick={onSearchCity}>
            החלף עיר
          </Button>
        </>
      )}

      {/* Always mounted (visually hidden while empty) so a new note is announced. */}
      <p
        aria-live="polite"
        className={locationFailure ? 'text-xs text-neutral-600' : 'sr-only'}
      >
        {locationFailure ? LOCATION_FAILURE_NOTES[locationFailure] : ''}
      </p>

      {canUseDeviceLocation && (
        // Not `isLoading`: that disables the button, and disabling the focused
        // control would drop focus to <body>. Repeat taps are ignored upstream.
        <Button
          type="button"
          variant="ghost"
          onClick={onUseDeviceLocation}
          aria-busy={isLocatingDevice || undefined}
        >
          {isLocatingDevice ? 'מאתר מיקום…' : 'השתמש במיקום שלי'}
        </Button>
      )}
    </div>
  )
}
