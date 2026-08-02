import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Event } from '../../types/database'
import {
  fetchTodayEvents,
  logImmediateEvent,
  type ImmediateEventType,
} from './api'
import { israelDateString } from './todayDate'

/**
 * The query key for a child's "today" events. The Israel-local date is part of
 * the key so the cache re-scopes automatically once the day rolls over past
 * Israel-local midnight, rather than serving yesterday's list.
 */
export function todayEventsKey(childId: string): [string, string, string] {
  return ['today-events', childId, israelDateString()]
}

/** Reads the child's events for the current Israel-local day. */
export function useTodayEvents(childId: string) {
  return useQuery({
    queryKey: todayEventsKey(childId),
    queryFn: () => fetchTodayEvents(childId),
  })
}

export interface LogImmediateEventVariables {
  type: ImmediateEventType
  metadata?: Record<string, unknown>
}

/**
 * Logs an immediate event and refetches the child's "today" list on success so
 * the new event appears without a manual reload.
 */
export function useLogImmediateEvent(childId: string) {
  const queryClient = useQueryClient()

  return useMutation<Event, unknown, LogImmediateEventVariables>({
    mutationFn: ({ type, metadata }) =>
      logImmediateEvent(childId, type, metadata),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: todayEventsKey(childId) })
    },
  })
}
