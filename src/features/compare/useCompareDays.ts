import { useQueries } from '@tanstack/react-query'
import type { Event } from '../../types/database'
import { dayEventsQueryOptions } from '../today/useTodayEvents'

/** One selected day's query state, in the order the days were passed in. */
export interface CompareDayQuery {
  readonly dateString: string
  readonly events: readonly Event[] | undefined
  readonly isLoading: boolean
  /** True when this day's fetch failed (the screen-level banner carries the message). */
  readonly isError: boolean
}

export interface CompareDaysResult {
  readonly days: readonly CompareDayQuery[]
  /** The first failed day's error (one banner for the screen), or null. */
  readonly error: unknown
}

/**
 * Reads the child's events for every selected day in parallel. Each day reuses
 * the exact query the historical Today view uses (`dayEventsQueryOptions`), so
 * days already seen there — and today, whose key equals the live Today key —
 * come straight from the shared cache, and a mutation's `today-events`
 * invalidation refreshes them here too.
 */
export function useCompareDays(
  childId: string,
  dateStrings: readonly string[],
  dayStart: string,
): CompareDaysResult {
  return useQueries({
    queries: dateStrings.map((dateString) => dayEventsQueryOptions(childId, dateString, dayStart)),
    combine: (results) => ({
      days: results.map((result, index) => ({
        dateString: dateStrings[index],
        events: result.data,
        isLoading: result.isLoading,
        isError: result.isError,
      })),
      error: results.find((result) => result.isError)?.error ?? null,
    }),
  })
}
