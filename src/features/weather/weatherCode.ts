/**
 * Maps a WMO weather interpretation code (as returned by Open-Meteo's
 * `weather_code`) to the small set of icons the weather strip draws, plus a
 * short Hebrew label used as the icon's accessible name.
 *
 * Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes).
 */

export type WeatherIconKind =
  | 'clear'
  | 'clear-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'other'

const CLEAR_CODES: ReadonlySet<number> = new Set([0])
const PARTLY_CLOUDY_CODES: ReadonlySet<number> = new Set([1, 2])
const CLOUDY_CODES: ReadonlySet<number> = new Set([3])
/** Drizzle (51–57), rain (61–67) and rain showers (80–82). */
const RAIN_CODES: ReadonlySet<number> = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82])
/** Thunderstorm, with or without hail. */
const STORM_CODES: ReadonlySet<number> = new Set([95, 96, 99])

/**
 * Resolves the icon for a WMO code; fog, snow and unknown codes fall back to
 * `other`. At night (`isDay` false) clear and partly-cloudy skies get a moon
 * instead of a sun; the other icons have no sun in them, so they don't change.
 */
export function weatherIconKind(code: number, isDay: boolean): WeatherIconKind {
  if (CLEAR_CODES.has(code)) return isDay ? 'clear' : 'clear-night'
  if (PARTLY_CLOUDY_CODES.has(code)) return isDay ? 'partly-cloudy' : 'partly-cloudy-night'
  if (CLOUDY_CODES.has(code)) return 'cloudy'
  if (RAIN_CODES.has(code)) return 'rain'
  if (STORM_CODES.has(code)) return 'storm'
  return 'other'
}

/** Accessible Hebrew label per icon kind. */
export const WEATHER_ICON_LABELS: Record<WeatherIconKind, string> = {
  clear: 'בהיר',
  'clear-night': 'לילה בהיר',
  'partly-cloudy': 'מעונן חלקית',
  'partly-cloudy-night': 'מעונן חלקית',
  cloudy: 'מעונן',
  rain: 'גשם',
  storm: 'סופת רעמים',
  other: 'מזג אוויר',
}
