import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { Event } from '../../types/database'
import {
  fetchEventsForDate,
  fetchTodayEvents,
  logImmediateEvent,
  startTimerEvent,
  stopTimerEvent,
  type ImmediateEventType,
  type StartTimerResult,
  type StopTimerResult,
  type TimerEventType,
} from './api'
import { deviceDayKey } from './todayDate'

/**
 * The query key for a child's "today" events. The device-local child-day (the
 * date its `day_start` falls on) is part of the key so the cache re-scopes
 * automatically once the day rolls over past the child's `day_start`, rather
 * than serving yesterday's list.
 */
export function todayEventsKey(childId: string, dayStart = '00:00'): [string, string, string] {
  return ['today-events', childId, deviceDayKey(new Date(), dayStart)]
}

/**
 * The child-scoped prefix of {@link todayEventsKey}, without the day segment.
 * Used for invalidation so a mutation refetches the child's "today" list no
 * matter which child-day (i.e. which `day_start`-derived date) is cached.
 */
export function todayEventsKeyPrefix(childId: string): [string, string] {
  return ['today-events', childId]
}

/** Reads the child's events for the current device-local child-day. */
export function useTodayEvents(childId: string, dayStart = '00:00') {
  return useQuery({
    queryKey: todayEventsKey(childId, dayStart),
    queryFn: () => fetchTodayEvents(childId, dayStart),
  })
}

/**
 * The query key for a child's events on a *specific* past child-day. The
 * selected calendar date is part of the key so a historical day never collides
 * with the live "today" cache (spec §9.2). It shares the `['today-events',
 * childId]` prefix, so a mutation's invalidation still refetches it.
 */
export function dayEventsKey(childId: string, dateString: string): [string, string, string] {
  return ['today-events', childId, dateString]
}

/**
 * Reads the child's events for a specific past child-day (historical Today,
 * §9.2). Read-only: the historical view exposes no logging, so there is no
 * matching mutation hook.
 */
export function useDayEvents(childId: string, dateString: string, dayStart = '00:00') {
  return useQuery(dayEventsQueryOptions(childId, dateString, dayStart))
}

/**
 * The query definition for a child's events on a specific child-day, shared by
 * {@link useDayEvents} and multi-day readers (the Day-comparison screen's
 * `useQueries`), so every reader of a given day hits the same
 * {@link dayEventsKey} cache entry. For the current child-day the key equals
 * {@link todayEventsKey}, so it shares the live Today cache too.
 */
export function dayEventsQueryOptions(childId: string, dateString: string, dayStart = '00:00') {
  return queryOptions({
    queryKey: dayEventsKey(childId, dateString),
    queryFn: () => fetchEventsForDate(childId, dateString, dayStart),
  })
}

export interface LogImmediateEventVariables {
  type: ImmediateEventType
  metadata?: Record<string, unknown>
}

/** Inserts `event` into a chronological list, replacing any row with its id. */
function upsertByStartTime(events: Event[], event: Event): Event[] {
  return [...events.filter((existing) => existing.id !== event.id), event].sort(
    (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time),
  )
}

/**
 * Applies a mutation's result to the screen at once, instead of waiting for a
 * full refetch: the row the server just returned is written straight into the
 * live "today" cache, so the button flips and the clock redraws on the same
 * render as the confirmation. A background refetch then reconciles anything
 * else that changed (e.g. the other parent's edits).
 *
 * In-flight refetches (e.g. one triggered by a Realtime event) are cancelled
 * first, so a response that left before this write cannot overwrite it with
 * stale data.
 */
async function applyEventToTodayCache(
  queryClient: QueryClient,
  childId: string,
  dayStart: string,
  event: Event,
): Promise<void> {
  const prefix = todayEventsKeyPrefix(childId)
  await queryClient.cancelQueries({ queryKey: prefix })
  queryClient.setQueryData<Event[]>(todayEventsKey(childId, dayStart), (events) =>
    events ? upsertByStartTime(events, event) : events,
  )
  void queryClient.invalidateQueries({ queryKey: prefix })
}

/**
 * Logs an immediate event and shows it at once (see
 * {@link applyEventToTodayCache}), without a manual reload.
 */
export function useLogImmediateEvent(childId: string, dayStart: string) {
  const queryClient = useQueryClient()

  return useMutation<Event, unknown, LogImmediateEventVariables>({
    mutationFn: ({ type, metadata }) => logImmediateEvent(childId, type, metadata),
    onSuccess: (event) => applyEventToTodayCache(queryClient, childId, dayStart, event),
  })
}

/**
 * Starts a start/stop timer event (sleep / feeding) and shows the running arc
 * at once. When the other parent started the same timer first, the result is
 * `already-running` and their timer is shown instead.
 */
export function useStartTimerEvent(childId: string, dayStart: string) {
  const queryClient = useQueryClient()

  return useMutation<
    StartTimerResult,
    unknown,
    { type: TimerEventType; metadata?: Record<string, unknown> }
  >({
    mutationFn: ({ type, metadata }) => startTimerEvent(childId, type, metadata),
    onSuccess: (result) => applyEventToTodayCache(queryClient, childId, dayStart, result.event),
  })
}

/**
 * Stops a running timer event by its id and shows the completed arc at once.
 *
 * When the other parent already stopped it, the result is `already-stopped`
 * and there is no row to apply, so the list is refetched instead. That refetch
 * is awaited: the mutation stays pending until the screen shows the stopped
 * timer, so the caller's note appears on the same render as the button change
 * rather than a moment before it.
 */
export function useStopTimerEvent(childId: string, dayStart: string) {
  const queryClient = useQueryClient()

  return useMutation<StopTimerResult, unknown, { eventId: string; metadata?: Record<string, unknown> }>({
    mutationFn: ({ eventId, metadata }) => stopTimerEvent(eventId, metadata),
    onSuccess: (result) => {
      if (result.outcome === 'stopped') {
        return applyEventToTodayCache(queryClient, childId, dayStart, result.event)
      }
      return queryClient.invalidateQueries({ queryKey: todayEventsKeyPrefix(childId) })
    },
  })
}
