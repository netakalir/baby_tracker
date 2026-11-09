import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WeatherApiError,
  fetchCurrentWeather,
  fetchPlaceName,
  isRetryableWeatherError,
  parseCitySearchResponse,
  parseForecastResponse,
  parsePlaceNameResponse,
  searchCities,
} from './api'
import { roundCoordinates } from './coordinates'

/** Stubs `fetch` with a single JSON response and returns the mock for URL assertions. */
function stubFetchJson(body: unknown, status = 200) {
  const mock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', mock)
  return mock
}

/** The URL the stubbed `fetch` was called with. */
function requestedUrl(mock: ReturnType<typeof vi.fn>): URL {
  const [input] = mock.mock.calls[0] as [URL]
  return new URL(input)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('roundCoordinates', () => {
  it('rounds both coordinates to one decimal', () => {
    expect(roundCoordinates({ latitude: 32.18432, longitude: 34.87119 })).toEqual({
      latitude: 32.2,
      longitude: 34.9,
    })
    expect(roundCoordinates({ latitude: -33.86785, longitude: 151.20732 })).toEqual({
      latitude: -33.9,
      longitude: 151.2,
    })
  })
})

describe('parseForecastResponse', () => {
  const valid = {
    latitude: 32.2,
    current: { time: '2026-11-09T10:00', temperature_2m: 18.4, apparent_temperature: 16.9, weather_code: 2 },
  }

  it('maps a valid response (ignoring extra fields)', () => {
    expect(parseForecastResponse(valid)).toEqual({
      temperature: 18.4,
      apparentTemperature: 16.9,
      weatherCode: 2,
    })
  })

  it.each([
    ['no current block', { latitude: 32.2 }],
    ['a missing apparent temperature', { current: { temperature_2m: 18, weather_code: 2 } }],
    ['a string temperature', { current: { ...valid.current, temperature_2m: '18' } }],
    ['a fractional weather code', { current: { ...valid.current, weather_code: 2.5 } }],
    ['null', null],
    ['an Open-Meteo error body', { error: true, reason: 'Latitude must be in range' }],
  ])('rejects %s with a schema error', (_label, body) => {
    expect(() => parseForecastResponse(body)).toThrowError(
      expect.objectContaining({ kind: 'schema' }) as Error,
    )
  })
})

describe('parseCitySearchResponse', () => {
  it('maps results with a region line', () => {
    expect(
      parseCitySearchResponse({
        results: [
          { id: 293619, name: 'רעננה', latitude: 32.184, longitude: 34.871, country: 'ישראל', admin1: 'מחוז המרכז' },
          { id: 1, name: 'Somewhere', latitude: 1, longitude: 2 },
        ],
      }),
    ).toEqual([
      { id: 293619, name: 'רעננה', latitude: 32.184, longitude: 34.871, region: 'מחוז המרכז, ישראל' },
      { id: 1, name: 'Somewhere', latitude: 1, longitude: 2, region: '' },
    ])
  })

  it('treats a missing `results` (no matches) as an empty list', () => {
    expect(parseCitySearchResponse({ generationtime_ms: 0.5 })).toEqual([])
  })

  it.each([
    ['results that are not an array', { results: 'רעננה' }],
    ['a result without coordinates', { results: [{ id: 1, name: 'x' }] }],
    ['a result with an empty name', { results: [{ id: 1, name: '', latitude: 1, longitude: 2 }] }],
  ])('rejects %s with a schema error', (_label, body) => {
    expect(() => parseCitySearchResponse(body)).toThrow(WeatherApiError)
  })
})

describe('parsePlaceNameResponse', () => {
  it('prefers the city', () => {
    expect(parsePlaceNameResponse({ city: 'רעננה', locality: 'שכונה' })).toBe('רעננה')
  })

  it('falls back to the locality when the city is empty', () => {
    expect(parsePlaceNameResponse({ city: '', locality: 'כפר סבא' })).toBe('כפר סבא')
  })

  it('returns null when neither is known', () => {
    expect(parsePlaceNameResponse({ city: ' ', locality: '' })).toBeNull()
    expect(parsePlaceNameResponse({})).toBeNull()
  })

  it('rejects a malformed body with a schema error', () => {
    expect(() => parsePlaceNameResponse({ city: 42 })).toThrow(WeatherApiError)
    expect(() => parsePlaceNameResponse('רעננה')).toThrow(WeatherApiError)
  })
})

describe('request building', () => {
  it('sends only rounded coordinates to the forecast API', async () => {
    const fetchMock = stubFetchJson({
      current: { temperature_2m: 18, apparent_temperature: 17, weather_code: 0 },
    })

    await fetchCurrentWeather({ latitude: 32.18432, longitude: 34.87119 })

    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')).toBe('32.2')
    expect(url.searchParams.get('longitude')).toBe('34.9')
    expect(url.searchParams.get('current')).toBe('temperature_2m,apparent_temperature,weather_code')
    expect(url.searchParams.get('timezone')).toBe('auto')
  })

  it('sends only rounded coordinates to the reverse-geocode API', async () => {
    const fetchMock = stubFetchJson({ city: 'רעננה', locality: '' })

    await expect(fetchPlaceName({ latitude: 32.18432, longitude: 34.87119 })).resolves.toBe('רעננה')

    const url = requestedUrl(fetchMock)
    expect(url.searchParams.get('latitude')).toBe('32.2')
    expect(url.searchParams.get('longitude')).toBe('34.9')
    expect(url.searchParams.get('localityLanguage')).toBe('he')
  })

  it('encodes the city search term', async () => {
    const fetchMock = stubFetchJson({})

    await searchCities('תל אביב&count=500')

    const url = requestedUrl(fetchMock)
    expect(url.searchParams.get('name')).toBe('תל אביב&count=500')
    expect(url.searchParams.get('count')).toBe('5')
    expect(url.searchParams.get('language')).toBe('he')
  })
})

describe('request failures', () => {
  const coordinates = { latitude: 32.2, longitude: 34.9 }

  it('turns a non-OK status into an http error carrying the status', async () => {
    stubFetchJson({ error: true }, 503)

    const error: unknown = await fetchCurrentWeather(coordinates).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WeatherApiError)
    expect(error).toMatchObject({ kind: 'http', status: 503 })
  })

  it('turns a rejected fetch into a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))

    await expect(fetchCurrentWeather(coordinates)).rejects.toMatchObject({ kind: 'network' })
  })

  it('turns a non-JSON body into a schema error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 200 })))

    await expect(fetchCurrentWeather(coordinates)).rejects.toMatchObject({ kind: 'schema' })
  })

  it('turns an unexpected JSON shape into a schema error', async () => {
    stubFetchJson({ current: { temperature_2m: 'warm' } })

    await expect(fetchCurrentWeather(coordinates)).rejects.toMatchObject({ kind: 'schema' })
  })

  it('never puts coordinates in the error message', async () => {
    stubFetchJson({}, 500)

    const error: unknown = await fetchCurrentWeather({ latitude: 32.18, longitude: 34.87 }).catch(
      (caught: unknown) => caught,
    )
    expect(error instanceof Error && error.message).not.toMatch(/32|34/)
  })
})

describe('isRetryableWeatherError', () => {
  it('retries network failures, 5xx and 429 only', () => {
    expect(isRetryableWeatherError(new WeatherApiError('network', 'x'))).toBe(true)
    expect(isRetryableWeatherError(new WeatherApiError('http', 'x', 502))).toBe(true)
    expect(isRetryableWeatherError(new WeatherApiError('http', 'x', 429))).toBe(true)
    expect(isRetryableWeatherError(new WeatherApiError('http', 'x', 400))).toBe(false)
    expect(isRetryableWeatherError(new WeatherApiError('schema', 'x'))).toBe(false)
    expect(isRetryableWeatherError(new Error('other'))).toBe(false)
  })
})
