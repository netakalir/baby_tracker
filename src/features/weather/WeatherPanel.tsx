import { Button } from '../../components/ui/Button'
import type { CurrentWeather } from './api'
import { CitySearch } from './CitySearch'
import { dressingAdviceFor } from './dressingAdvice'
import type { SavedCity } from './savedCity'
import { formatDegrees } from './formatDegrees'

export type WeatherPanelMode = 'details' | 'search'

interface WeatherPanelProps {
  id: string
  mode: WeatherPanelMode
  /** Current conditions, or null when unavailable (no location / fetch failed). */
  weather: CurrentWeather | null
  /** Whether "use my location" is worth offering (i.e. we're not already on it). */
  canUseDeviceLocation: boolean
  onSearchCity: () => void
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
  onSearchCity,
  onChooseCity,
  onUseDeviceLocation,
}: WeatherPanelProps) {
  return (
    <div
      id={id}
      className="mt-2 space-y-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm"
    >
      {mode === 'search' ? (
        <CitySearch onChoose={onChooseCity} />
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

      {canUseDeviceLocation && (
        <Button type="button" variant="ghost" onClick={onUseDeviceLocation}>
          השתמש במיקום שלי
        </Button>
      )}
    </div>
  )
}
