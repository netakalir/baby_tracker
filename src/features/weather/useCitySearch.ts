import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  isExpectedWeatherOutage,
  isRetryableWeatherError,
  searchCities,
  type CitySearchResult,
} from './api'

/** Wait this long after the last keystroke before searching. */
const SEARCH_DEBOUNCE_MS = 300

/** Shorter terms are not searched (too broad, and wasteful). */
export const MIN_SEARCH_LENGTH = 2

/** Returns `value` once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export interface CitySearchState {
  results: CitySearchResult[]
  /** True when the (debounced) term is long enough to search. */
  isActive: boolean
  isSearching: boolean
  /** The search failed, or is paused because the device is offline. */
  isUnavailable: boolean
}

/**
 * Debounced city search for the weather strip's "choose city" panel. Searches
 * once the trimmed term reaches {@link MIN_SEARCH_LENGTH} characters and has
 * been stable for {@link SEARCH_DEBOUNCE_MS}; keeps the previous results on
 * screen while the next term loads so the list doesn't flicker.
 */
export function useCitySearch(term: string): CitySearchState {
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS)
  const isActive = debouncedTerm.length >= MIN_SEARCH_LENGTH

  const query = useQuery({
    queryKey: ['weather', 'city-search', debouncedTerm],
    queryFn: ({ signal }) => searchCities(debouncedTerm, signal),
    enabled: isActive,
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => failureCount < 1 && isRetryableWeatherError(error),
    meta: { skipErrorReport: isExpectedWeatherOutage },
  })

  return {
    results: isActive ? (query.data ?? []) : [],
    isActive,
    isSearching: isActive && query.isFetching,
    isUnavailable: isActive && (query.isError || query.fetchStatus === 'paused'),
  }
}
