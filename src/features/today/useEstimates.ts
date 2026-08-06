import { useQuery } from '@tanstack/react-query'
import { fetchEstimates } from './estimates'
import { deviceDayKey } from './todayDate'

/**
 * Query key for a child's next-event estimates. The child-day date (device zone,
 * offset by the child's `day_start`) is part of the key — matching
 * `todayEventsKey` — so the estimates re-scope at the child's day boundary
 * instead of serving yesterday's prediction.
 */
export function estimatesKey(childId: string, dayStart: string): [string, string, string] {
  return ['estimates', childId, deviceDayKey(new Date(), dayStart)]
}

/** Reads the "next feeding" / "next sleep" estimates for a child (contract §3). */
export function useEstimates(childId: string, dayStart: string) {
  return useQuery({
    queryKey: estimatesKey(childId, dayStart),
    queryFn: () => fetchEstimates(childId),
  })
}
