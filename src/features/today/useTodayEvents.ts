import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Event } from '../../types/database'
import {
  fetchTodayEvents,
  logImmediateEvent,
  startTimerEvent,
  stopTimerEvent,
  type ImmediateEventType,
  type TimerEventType,
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

/**
 * Starts a start/stop timer event (sleep / feeding) and refetches the child's
 * "today" list so the new running arc appears immediately.
 */
export function useStartTimerEvent(childId: string) {
  const queryClient = useQueryClient()

  return useMutation<Event, unknown, { type: TimerEventType; metadata?: Record<string, unknown> }>({
    mutationFn: ({ type, metadata }) => startTimerEvent(childId, type, metadata),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: todayEventsKey(childId) })
    },
  })
}

/**
 * Stops a running timer event by its id and refetches the child's "today" list
 * so the arc updates from "in progress" to a completed, capped duration.
 */
export function useStopTimerEvent(childId: string) {
  const queryClient = useQueryClient()

  return useMutation<Event, unknown, { eventId: string; metadata?: Record<string, unknown> }>({
    mutationFn: ({ eventId, metadata }) => stopTimerEvent(eventId, metadata),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: todayEventsKey(childId) })
    },
  })
}
