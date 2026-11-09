import { useCallback, useState } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPlaceName, isExpectedWeatherOutage, isRetryableWeatherError } from './api'
import type { Coordinates } from './coordinates'
import {
  readDevicePosition,
  requestDevicePosition,
  type DevicePositionFailure,
  type DevicePositionResult,
} from './devicePosition'
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
  /** No saved city and no device position; `reason` explains why (see DevicePositionFailure). */
  | { status: 'needs-city'; reason: DevicePositionFailure }
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
  /**
   * Asks the device for a fresh position. Only on success does it switch to
   * it (dropping the saved city and refreshing the cached position); on
   * failure the current location is left exactly as it was. Resolves with the
   * outcome so the caller can explain a failure.
   */
  locateDevice: () => Promise<DevicePositionResult>
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * The device position query. It never errors (`readDevicePosition` resolves a
 * classified failure instead of rejecting) and needs no network, so it runs offline too
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
  const deviceResult = savedCity === null ? devicePosition.data : undefined
  const deviceCoordinates = deviceResult?.status === 'located' ? deviceResult.coordinates : null

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

  const locateDevice = useCallback(async (): Promise<DevicePositionResult> => {
    // Resolve the position FIRST: the working state (a saved city and its
    // forecast) is only replaced once we know the device location works.
    const result = await requestDevicePosition()

    if (result.status === 'located') {
      // Seed the query before re-enabling it, so it uses this fresh reading
      // instead of asking the device a second time.
      queryClient.setQueryData(devicePositionQuery.queryKey, result)
      clearSavedCity()
      setSavedCity(null)
    } else if (savedCity === null) {
      // Already on the "choose a city" fallback: just refresh its reason.
      queryClient.setQueryData(devicePositionQuery.queryKey, result)
    }
    return result
  }, [queryClient, savedCity])

  let location: WeatherLocation
  if (savedCity) {
    location = {
      status: 'ready',
      // Already rounded: a saved city is normalized on read and on save.
      coordinates: { latitude: savedCity.latitude, longitude: savedCity.longitude },
      source: 'saved-city',
      placeName: savedCity.name,
    }
  } else if (deviceResult === undefined) {
    location = { status: 'locating' }
  } else if (deviceResult.status !== 'located') {
    location = { status: 'needs-city', reason: deviceResult.status }
  } else {
    location = {
      status: 'ready',
      coordinates: deviceResult.coordinates,
      source: 'device',
      placeName: placeName.data ?? null,
    }
  }

  return { location, chooseCity, locateDevice }
}
