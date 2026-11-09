import type { Page, Route } from '@playwright/test'
import { expect, test } from '../support/fixtures'
import { signIn } from '../support/pageActions'

/**
 * The "what to dress the baby" weather strip on the live Today screen.
 *
 * All three external services are mocked with `page.route` - these tests never
 * touch the real network for weather. Geolocation is either granted through
 * Playwright (`grantPermissions` + `setGeolocation`) or, for the "denied" path,
 * stubbed to fail immediately (Playwright has no "deny" permission API, and a
 * headless prompt is not guaranteed to fail fast).
 */

const STRIP_REGION = 'מזג אוויר והמלצת לבוש'
const SAVED_CITY_KEY = 'baby-tracker:weather:saved-city'
const CACHED_COORDINATES_KEY = 'baby-tracker:weather:device-coordinates'
const FORECAST_URL = /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/
const CITY_SEARCH_URL = /^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?/
const REVERSE_GEOCODE_URL = /^https:\/\/api\.bigdatacloud\.net\/data\/reverse-geocode-client\?/

/** A precise device position; the app must only ever send it rounded (32.2, 34.9). */
const DEVICE_POSITION = { latitude: 32.18432, longitude: 34.87119 }

interface WeatherMockOptions {
  /** Forecast HTTP status (default 200). */
  forecastStatus?: number
  temperature?: number
  apparentTemperature?: number
  weatherCode?: number
  /** Reverse-geocode city name (default 'רעננה'). */
  placeName?: string
}

interface WeatherRequests {
  forecast: URL[]
  reverseGeocode: URL[]
  citySearch: URL[]
}

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  })
}

/** Mocks the forecast, reverse-geocode and city-search APIs; records every request URL. */
async function mockWeatherApis(page: Page, options: WeatherMockOptions = {}): Promise<WeatherRequests> {
  const requests: WeatherRequests = { forecast: [], reverseGeocode: [], citySearch: [] }

  await page.route(FORECAST_URL, (route) => {
    requests.forecast.push(new URL(route.request().url()))
    const status = options.forecastStatus ?? 200
    if (status !== 200) return fulfillJson(route, { error: true, reason: 'mocked failure' }, status)
    return fulfillJson(route, {
      current: {
        temperature_2m: options.temperature ?? 18.4,
        apparent_temperature: options.apparentTemperature ?? 19.6,
        weather_code: options.weatherCode ?? 0,
      },
    })
  })

  await page.route(REVERSE_GEOCODE_URL, (route) => {
    requests.reverseGeocode.push(new URL(route.request().url()))
    return fulfillJson(route, { city: options.placeName ?? 'רעננה', locality: '' })
  })

  await page.route(CITY_SEARCH_URL, (route) => {
    requests.citySearch.push(new URL(route.request().url()))
    return fulfillJson(route, {
      results: [
        { id: 293619, name: 'רעננה', latitude: 32.18, longitude: 34.87, country: 'ישראל', admin1: 'מחוז המרכז' },
        { id: 293620, name: 'רעננה צפון', latitude: 32.2, longitude: 34.88, country: 'ישראל' },
      ],
    })
  })

  return requests
}

/** Makes every geolocation request fail at once, as after a denied permission prompt. */
async function denyGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Geolocation.prototype, 'getCurrentPosition', {
      configurable: true,
      value: (_onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
        onError?.({
          code: 1,
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    })
  })
}

/** The device-local calendar date (`YYYY-MM-DD`) `daysAgo` days before now. */
function localDateString(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

test.describe('Today screen - weather dressing strip', () => {
  test('with location granted, the strip loads on its own with temp, advice and city', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'אלה' })
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(DEVICE_POSITION)
    const requests = await mockWeatherApis(page, { temperature: 18.4, apparentTemperature: 19.6 })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    // No tap needed: actual temp (18°), advice from feels-like (20° → long bodysuit), city.
    const strip = page.getByRole('region', { name: STRIP_REGION })
    // The strip itself is the region's first button (the panel adds more once open).
    const stripButton = strip.getByRole('button').first()
    await expect(stripButton).toContainText('18°')
    await expect(stripButton).toContainText('בגד גוף ארוך + שמיכה דקה')
    await expect(stripButton).toContainText('רעננה')

    // Only rounded coordinates ever leave the browser.
    for (const url of [...requests.forecast, ...requests.reverseGeocode]) {
      expect(url.searchParams.get('latitude')).toBe('32.2')
      expect(url.searchParams.get('longitude')).toBe('34.9')
    }

    // Tapping opens the inline panel: feels-like, full advice and the disclaimer.
    await stripButton.click()
    await expect(stripButton).toHaveAttribute('aria-expanded', 'true')
    await expect(strip.getByText('מרגיש כמו')).toContainText('20°')
    await expect(strip.getByText('טיפ כללי, לא הנחיה רפואית')).toBeVisible()
    await expect(strip.getByRole('button', { name: 'החלף עיר' })).toBeVisible()
  })

  test('with location denied, a searched city is used and survives a reload', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'יואב' })
    await denyGeolocation(page)
    const requests = await mockWeatherApis(page, { temperature: 24, apparentTemperature: 24 })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    const strip = page.getByRole('region', { name: STRIP_REGION })
    await strip.getByRole('button', { name: /בחרו עיר/ }).click()

    await strip.getByLabel('חיפוש עיר').fill('רעננה')
    await strip.getByRole('button', { name: /רעננה.*מחוז המרכז/ }).click()

    const stripButton = strip.getByRole('button').first()
    // Focus returns to the strip (not <body>) once the panel closes.
    await expect(stripButton).toBeFocused()
    await expect(stripButton).toContainText('24°')
    await expect(stripButton).toContainText('בגד גוף קצר + מכנס דק')
    await expect(stripButton).toContainText('רעננה')
    expect(requests.citySearch.at(-1)?.searchParams.get('name')).toBe('רעננה')
    // A chosen city is resolved by name, never reverse-geocoded.
    expect(requests.reverseGeocode).toHaveLength(0)

    await page.reload()
    await expect(
      page.getByRole('region', { name: STRIP_REGION }).getByRole('button').first(),
    ).toContainText('רעננה')
    const lastForecast = requests.forecast.at(-1)
    expect(lastForecast?.searchParams.get('latitude')).toBe('32.2')
    expect(lastForecast?.searchParams.get('longitude')).toBe('34.9')
  })

  test('"use my location" drops the saved city and cached position and locates again', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'תמר' })
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(DEVICE_POSITION)
    const requests = await mockWeatherApis(page)

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)
    const strip = page.getByRole('region', { name: STRIP_REGION })
    const stripButton = strip.getByRole('button').first()
    await expect(stripButton).toContainText('רעננה')

    // Seed a saved city (Haifa) and a *different*, still-fresh cached position
    // (Jerusalem), then reload: the saved city wins.
    await page.evaluate(
      ([savedCityKey, cachedKey]) => {
        localStorage.setItem(
          savedCityKey,
          JSON.stringify({ name: 'חיפה', latitude: 32.8, longitude: 35 }),
        )
        localStorage.setItem(
          cachedKey,
          JSON.stringify({ latitude: 31.8, longitude: 35.2, savedAt: Date.now() }),
        )
      },
      [SAVED_CITY_KEY, CACHED_COORDINATES_KEY] as const,
    )
    await page.reload()
    await expect(stripButton).toContainText('חיפה')
    expect(requests.forecast.at(-1)?.searchParams.get('latitude')).toBe('32.8')

    const forecastsBefore = requests.forecast.length
    await stripButton.click()
    await strip.getByRole('button', { name: 'השתמש במיקום שלי' }).click()
    await expect(stripButton).toBeFocused()

    // Back on the device position: the cached Jerusalem fix was discarded and
    // geolocation was asked again (Raanana, rounded), not the stale cache.
    await expect(stripButton).toContainText('רעננה')
    const newForecasts = requests.forecast.slice(forecastsBefore)
    expect(newForecasts.length).toBeGreaterThan(0)
    for (const url of newForecasts) {
      expect(url.searchParams.get('latitude')).toBe('32.2')
      expect(url.searchParams.get('longitude')).toBe('34.9')
    }

    const stored = await page.evaluate(
      ([savedCityKey, cachedKey]) => ({
        savedCity: localStorage.getItem(savedCityKey),
        cached: localStorage.getItem(cachedKey),
      }),
      [SAVED_CITY_KEY, CACHED_COORDINATES_KEY] as const,
    )
    expect(stored.savedCity).toBeNull()
    expect(JSON.parse(stored.cached ?? 'null')).toMatchObject({ latitude: 32.2, longitude: 34.9 })
  })

  test('a weather API failure shows a quiet one-line fallback, not an error banner', async ({
    page,
    factory,
  }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'מאיה' })
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(DEVICE_POSITION)
    await mockWeatherApis(page, { forecastStatus: 500 })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    const strip = page.getByRole('region', { name: STRIP_REGION })
    await expect(strip.getByRole('button')).toHaveText('מזג האוויר לא זמין כרגע')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('at 320px the strip stays on one line inside the screen', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, { childName: 'נגה' })
    await page.setViewportSize({ width: 320, height: 720 })
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(DEVICE_POSITION)
    // The longest advice and a long place name - the worst case for overflow.
    await mockWeatherApis(page, {
      temperature: -3,
      apparentTemperature: -6,
      placeName: 'קריית שמונה המערבית',
    })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)

    const stripButton = page.getByRole('region', { name: STRIP_REGION }).getByRole('button')
    await expect(stripButton).toContainText('שכבות + אוברול חם + כובע')

    const box = await stripButton.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(-1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320 + 1)
    // One line: the strip keeps its fixed single-row height (h-10 = 40px).
    expect(box!.height).toBeLessThanOrEqual(40 + 1)
    // And the page as a whole never scrolls sideways.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(320)
  })

  test('the strip is not shown on a historical day', async ({ page, factory }) => {
    const user = await factory.createUser()
    await factory.seedFamilyWithChild(user, {
      childName: 'רוני',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation(DEVICE_POSITION)
    await mockWeatherApis(page)

    await signIn(page, user)
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('region', { name: STRIP_REGION })).toBeVisible()

    await page.goto(`/today?date=${localDateString(2)}`)
    await expect(page.getByRole('button', { name: 'יום קודם' })).toBeVisible()
    await expect(page.getByRole('region', { name: STRIP_REGION })).toHaveCount(0)
  })
})
