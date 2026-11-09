/**
 * Maps a WMO weather interpretation code (as returned by Open-Meteo's
 * `weather_code`) to the small set of icons the weather strip draws, plus a
 * short Hebrew label used as the icon's accessible name.
 *
 * Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes).
 */

export type WeatherIconKind = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'other'

const CLEAR_CODES: ReadonlySet<number> = new Set([0])
const PARTLY_CLOUDY_CODES: ReadonlySet<number> = new Set([1, 2])
const CLOUDY_CODES: ReadonlySet<number> = new Set([3])
/** Drizzle (51–57), rain (61–67) and rain showers (80–82). */
const RAIN_CODES: ReadonlySet<number> = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82])
/** Thunderstorm, with or without hail. */
const STORM_CODES: ReadonlySet<number> = new Set([95, 96, 99])

/** Resolves the icon for a WMO code; fog, snow and unknown codes fall back to `other`. */
export function weatherIconKind(code: number): WeatherIconKind {
  if (CLEAR_CODES.has(code)) return 'clear'
  if (PARTLY_CLOUDY_CODES.has(code)) return 'partly-cloudy'
  if (CLOUDY_CODES.has(code)) return 'cloudy'
  if (RAIN_CODES.has(code)) return 'rain'
  if (STORM_CODES.has(code)) return 'storm'
  return 'other'
}

/** Accessible Hebrew label per icon kind. */
export const WEATHER_ICON_LABELS: Record<WeatherIconKind, string> = {
  clear: 'בהיר',
  'partly-cloudy': 'מעונן חלקית',
  cloudy: 'מעונן',
  rain: 'גשם',
  storm: 'סופת רעמים',
  other: 'מזג אוויר',
}
