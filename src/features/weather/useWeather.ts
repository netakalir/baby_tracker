import { useQuery } from '@tanstack/react-query'
import { fetchCurrentWeather, isExpectedWeatherOutage, isRetryableWeatherError } from './api'
import { roundCoordinates, type Coordinates } from './coordinates'

const THIRTY_MINUTES_MS = 30 * 60 * 1000

/**
 * The query key for current weather. Keyed on the *rounded* coordinates, so
 * small position jitter reuses the cache and nothing more precise than one
 * decimal ever appears in it.
 */
export function weatherKey(coordinates: Coordinates): [string, string, number, number] {
  const { latitude, longitude } = roundCoordinates(coordinates)
  return ['weather', 'forecast', latitude, longitude]
}

/**
 * Current conditions for `coordinates` (null = no location yet, query idle).
 * Weather changes slowly, so results stay fresh for 30 minutes; a failure is
 * retried once only when it is transient (network / 5xx / 429).
 */
export function useWeather(coordinates: Coordinates | null) {
  return useQuery({
    queryKey: coordinates ? weatherKey(coordinates) : ['weather', 'forecast', 'none'],
    queryFn: ({ signal }) => {
      if (!coordinates) throw new Error('weather query ran without coordinates')
      return fetchCurrentWeather(coordinates, signal)
    },
    enabled: coordinates !== null,
    staleTime: THIRTY_MINUTES_MS,
    gcTime: THIRTY_MINUTES_MS,
    retry: (failureCount, error) => failureCount < 1 && isRetryableWeatherError(error),
    meta: { skipErrorReport: isExpectedWeatherOutage },
  })
}
