import { useQuery } from '@tanstack/react-query'
import { fetchWeekEvents } from './api'

/**
 * The query key for a child's events in one calendar week. The week anchor
 * (its Sunday `YYYY-MM-DD`) is part of the key so navigating between weeks
 * swaps the cached dataset — reloading only the data, not the whole screen.
 */
export function weekEventsKey(childId: string, sunday: string): [string, string, string] {
  return ['week-events', childId, sunday]
}

/** Reads the child's events for the calendar week anchored at `sunday`. */
export function useWeekEvents(childId: string, sunday: string, dayStart = '00:00') {
  return useQuery({
    queryKey: weekEventsKey(childId, sunday),
    queryFn: () => fetchWeekEvents(childId, sunday, dayStart),
  })
}
