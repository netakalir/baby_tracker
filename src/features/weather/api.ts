import { z } from 'zod'
import { roundCoordinates, type Coordinates } from './coordinates'

/**
 * Browser-side calls to the free, key-less weather/geocoding services used by
 * the weather strip. This feature does not touch Supabase and no location is
 * ever stored server-side.
 *
 * Every request rounds coordinates to one decimal first (`roundCoordinates`),
 * builds its query with `URLSearchParams` (so user input is encoded), and
 * validates the JSON with Zod. A non-OK status, a network failure or a schema
 * mismatch all surface as a typed {@link WeatherApiError}. Error messages never
 * include coordinates or the searched text.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const CITY_SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

export type WeatherApiErrorKind = 'network' | 'http' | 'schema'

/** A failed weather/geocoding request, classified so callers can decide on retries. */
export class WeatherApiError extends Error {
  readonly kind: WeatherApiErrorKind
  /** The HTTP status, for `kind: 'http'` only. */
  readonly status: number | undefined

  constructor(kind: WeatherApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'WeatherApiError'
    this.kind = kind
    this.status = status
  }
}

/**
 * True for failures worth one more attempt: a network blip or a 5xx/429.
 * Schema mismatches and other 4xx responses won't fix themselves on retry.
 */
export function isRetryableWeatherError(error: unknown): boolean {
  if (!(error instanceof WeatherApiError)) return false
  if (error.kind === 'network') return true
  return error.kind === 'http' && error.status !== undefined && (error.status >= 500 || error.status === 429)
}

/**
 * Fetches `url`, checks the status and returns the parsed JSON body (still
 * `unknown`; each caller validates it with its own Zod-backed parser).
 */
async function fetchJson(url: URL, service: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    // Let a cancellation propagate untouched so React Query treats it as such.
    if (signal?.aborted) throw error
    throw new WeatherApiError('network', `${service}: network request failed`)
  }

  if (!response.ok) {
    throw new WeatherApiError('http', `${service}: HTTP ${response.status}`, response.status)
  }

  try {
    return (await response.json()) as unknown
  } catch (error) {
    if (signal?.aborted) throw error
    throw new WeatherApiError('schema', `${service}: response is not valid JSON`)
  }
}

// ---------------------------------------------------------------------------
// Forecast (Open-Meteo)
// ---------------------------------------------------------------------------

/** Zod shape for the fields we read from Open-Meteo's `current` block. */
export const forecastResponseSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number().int(),
  }),
})

export interface CurrentWeather {
  /** Actual air temperature, °C. */
  temperature: number
  /** "Feels like" temperature, °C — what the dressing advice is based on. */
  apparentTemperature: number
  /** WMO weather interpretation code. */
  weatherCode: number
}

/** Parses an Open-Meteo forecast body into {@link CurrentWeather}, or throws a schema error. */
export function parseForecastResponse(body: unknown): CurrentWeather {
  const parsed = forecastResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new WeatherApiError('schema', 'forecast: unexpected response shape')
  }
  const { current } = parsed.data
  return {
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    weatherCode: current.weather_code,
  }
}

/** Current conditions at the (rounded) coordinates. */
export async function fetchCurrentWeather(
  coordinates: Coordinates,
  signal?: AbortSignal,
): Promise<CurrentWeather> {
  const { latitude, longitude } = roundCoordinates(coordinates)
  const url = new URL(FORECAST_URL)
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code',
    timezone: 'auto',
  }).toString()

  return parseForecastResponse(await fetchJson(url, 'forecast', signal))
}

// ---------------------------------------------------------------------------
// City search (Open-Meteo geocoding)
// ---------------------------------------------------------------------------

/**
 * Zod shape for a geocoding search. Open-Meteo omits `results` entirely when
 * nothing matches, so it is optional and treated as an empty list.
 */
export const citySearchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string().min(1),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        country: z.string().optional(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
})

export interface CitySearchResult extends Coordinates {
  id: number
  name: string
  /** A short disambiguating line, e.g. "מחוז המרכז, ישראל" (empty when unknown). */
  region: string
}

/** Parses an Open-Meteo geocoding body into results, or throws a schema error. */
export function parseCitySearchResponse(body: unknown): CitySearchResult[] {
  const parsed = citySearchResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new WeatherApiError('schema', 'city-search: unexpected response shape')
  }
  return (parsed.data.results ?? []).map((result) => ({
    id: result.id,
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    region: [result.admin1, result.country].filter(Boolean).join(', '),
  }))
}

/** Up to five cities matching `name`, with Hebrew names where available. */
export async function searchCities(name: string, signal?: AbortSignal): Promise<CitySearchResult[]> {
  const url = new URL(CITY_SEARCH_URL)
  url.search = new URLSearchParams({
    name,
    count: '5',
    language: 'he',
    format: 'json',
  }).toString()

  return parseCitySearchResponse(await fetchJson(url, 'city-search', signal))
}

// ---------------------------------------------------------------------------
// Reverse geocoding (BigDataCloud, client endpoint)
// ---------------------------------------------------------------------------

/** Zod shape for the reverse-geocode fields we read (both may be empty strings). */
export const reverseGeocodeResponseSchema = z.object({
  city: z.string().optional(),
  locality: z.string().optional(),
})

/** Parses a reverse-geocode body into a place name (`city || locality`), or null. */
export function parsePlaceNameResponse(body: unknown): string | null {
  const parsed = reverseGeocodeResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new WeatherApiError('schema', 'reverse-geocode: unexpected response shape')
  }
  const { city, locality } = parsed.data
  const name = city?.trim() || locality?.trim() || ''
  return name.length > 0 ? name : null
}

/** The city (or locality) name at the (rounded) coordinates, in Hebrew; null if unknown. */
export async function fetchPlaceName(
  coordinates: Coordinates,
  signal?: AbortSignal,
): Promise<string | null> {
  const { latitude, longitude } = roundCoordinates(coordinates)
  const url = new URL(REVERSE_GEOCODE_URL)
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: 'he',
  }).toString()

  return parsePlaceNameResponse(await fetchJson(url, 'reverse-geocode', signal))
}
