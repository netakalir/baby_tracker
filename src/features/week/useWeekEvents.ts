import { useQuery } from '@tanstack/react-query'
import { deviceDayKey } from '../today/todayDate'
import { fetchWeekEvents } from './api'

/**
 * The query key for a child's week events. The current child-day (the date its
 * `day_start` falls on) is part of the key so the cache re-scopes automatically
 * once the day rolls over past the child's `day_start`, sliding the seven-day
 * window forward rather than serving last night's week.
 */
export function weekEventsKey(childId: string, dayStart = '00:00'): [string, string, string] {
  return ['week-events', childId, deviceDayKey(new Date(), dayStart)]
}

/** Reads the child's events for the current seven-day window. */
export function useWeekEvents(childId: string, dayStart = '00:00') {
  return useQuery({
    queryKey: weekEventsKey(childId, dayStart),
    queryFn: () => fetchWeekEvents(childId, dayStart),
  })
}
