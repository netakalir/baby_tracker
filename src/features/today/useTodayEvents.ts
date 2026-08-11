import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Event } from '../../types/database'
import {
  fetchEventsForDate,
  fetchTodayEvents,
  logImmediateEvent,
  startTimerEvent,
  stopTimerEvent,
  type ImmediateEventType,
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
  return useQuery({
    queryKey: dayEventsKey(childId, dateString),
    queryFn: () => fetchEventsForDate(childId, dateString, dayStart),
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
      void queryClient.invalidateQueries({ queryKey: todayEventsKeyPrefix(childId) })
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
      void queryClient.invalidateQueries({ queryKey: todayEventsKeyPrefix(childId) })
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
      void queryClient.invalidateQueries({ queryKey: todayEventsKeyPrefix(childId) })
    },
  })
}
