import { useCallback, useState } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPlaceName, isExpectedWeatherOutage, isRetryableWeatherError } from './api'
import { clearCachedCoordinates } from './cachedCoordinates'
import type { Coordinates } from './coordinates'
import { readDevicePosition } from './devicePosition'
import {
  clearSavedCity,
  normalizeSavedCity,
  readSavedCity,
  writeSavedCity,
  type SavedCity,
} from './savedCity'

/** Where the weather strip's location currently stands. */
export type WeatherLocation =
  /** Reading the device position (may be showing the browser's permission prompt). */
  | { status: 'locating' }
  /** No saved city and no device position (denied / unsupported / error / timeout). */
  | { status: 'needs-city' }
  | {
      status: 'ready'
      /** Already rounded to one decimal. */
      coordinates: Coordinates
      source: 'saved-city' | 'device'
      /** Shown at the end of the strip; null while unknown (it is optional). */
      placeName: string | null
    }

export interface WeatherLocationControls {
  location: WeatherLocation
  /** Saves `city` on this device and uses it from now on. */
  chooseCity: (city: SavedCity) => void
  /** Forgets the saved city and cached position, then asks the device again. */
  locateDevice: () => void
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * The device position query. It never errors (`readDevicePosition` resolves
 * null for every failure) and needs no network, so it runs offline too
 * (`networkMode: 'always'`). It is read once per mount at most: no retries and
 * no focus/reconnect refetches, so the parent is never re-prompted in a loop.
 */
const devicePositionQuery = queryOptions({
  queryKey: ['weather', 'device-position'] as const,
  queryFn: readDevicePosition,
  networkMode: 'always',
  staleTime: 30 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
})

/**
 * Resolves the location the weather strip should use:
 * 1. a city chosen manually before (device-local storage), else
 * 2. the device position — requested automatically on mount (reusing a fresh
 *    cached position for up to 3 hours to avoid repeated prompts), else
 * 3. `needs-city`, so the strip offers a city search.
 *
 * For a device position the place name comes from a reverse-geocode lookup,
 * cached for a day per rounded coordinate; if it fails the name is simply
 * omitted (not an error).
 */
export function useWeatherLocation(): WeatherLocationControls {
  const queryClient = useQueryClient()
  const [savedCity, setSavedCity] = useState<SavedCity | null>(readSavedCity)

  const devicePosition = useQuery({ ...devicePositionQuery, enabled: savedCity === null })
  const deviceCoordinates = savedCity === null ? (devicePosition.data ?? null) : null

  const placeName = useQuery({
    queryKey: [
      'weather',
      'place-name',
      deviceCoordinates?.latitude,
      deviceCoordinates?.longitude,
    ] as const,
    queryFn: ({ signal }) => {
      if (!deviceCoordinates) throw new Error('place-name query ran without coordinates')
      return fetchPlaceName(deviceCoordinates, signal)
    },
    enabled: deviceCoordinates !== null,
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
    retry: (failureCount, error) => failureCount < 1 && isRetryableWeatherError(error),
    meta: { skipErrorReport: isExpectedWeatherOutage },
  })

  const chooseCity = useCallback((city: SavedCity) => {
    const normalized = normalizeSavedCity(city)
    writeSavedCity(normalized)
    setSavedCity(normalized)
  }, [])

  const locateDevice = useCallback(() => {
    clearSavedCity()
    clearCachedCoordinates()
    setSavedCity(null)
    // Drop any previous reading so the strip shows "locating" and the query
    // runs again (immediately if already active, else once re-enabled above).
    void queryClient.resetQueries({ queryKey: devicePositionQuery.queryKey })
  }, [queryClient])

  let location: WeatherLocation
  if (savedCity) {
    location = {
      status: 'ready',
      // Already rounded: a saved city is normalized on read and on save.
      coordinates: { latitude: savedCity.latitude, longitude: savedCity.longitude },
      source: 'saved-city',
      placeName: savedCity.name,
    }
  } else if (devicePosition.data === undefined) {
    location = { status: 'locating' }
  } else if (deviceCoordinates === null) {
    location = { status: 'needs-city' }
  } else {
    location = {
      status: 'ready',
      coordinates: deviceCoordinates,
      source: 'device',
      placeName: placeName.data ?? null,
    }
  }

  return { location, chooseCity, locateDevice }
}
