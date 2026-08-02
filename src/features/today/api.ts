import { supabase } from '../../lib/supabase'
import type { Event, EventType } from '../../types/database'
import { israelDayBounds } from './todayDate'

/**
 * Event types logged as a single instantaneous tap (no duration). These are
 * genuine point-in-time moments, so they are stored with `end_time = null` and
 * drawn as a dot on the clock.
 */
export type ImmediateEventType = Extract<EventType, 'diaper' | 'mood'>

/**
 * Event types logged as a start/stop timer: tapping "start" opens the event
 * (`end_time = null`, still running), tapping "stop" closes it. Both sleep and
 * feeding genuinely span time, so they are drawn as arcs with a duration.
 */
export type TimerEventType = Extract<EventType, 'sleep' | 'feeding'>

/** Resolves the signed-in user's id, or throws if there is no session. */
async function requireUserId(): Promise<string> {
  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userResult.user?.id
  if (!userId) {
    throw new Error('Cannot log an event without an authenticated user')
  }
  return userId
}

/**
 * Logs an immediate event for a child: a single row with `start_time = now`
 * and no `end_time` (immediate events have no duration). RLS restricts the
 * insert to children in the caller's family.
 */
export async function logImmediateEvent(
  childId: string,
  type: ImmediateEventType,
  metadata?: Record<string, unknown>,
): Promise<Event> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('events')
    .insert({
      child_id: childId,
      type,
      start_time: new Date().toISOString(),
      end_time: null,
      created_by: userId,
      metadata: metadata ?? null,
    })
    .select()
    .single<Event>()

  if (error) throw error
  return data
}

/**
 * Starts a start/stop timer event: inserts a row with `start_time = now` and
 * `end_time = null`, i.e. an event that is still running. The single active
 * timer per type is enforced by the UI (the button toggles to "stop" while one
 * is running), so this never opens a second timer of the same type.
 */
export async function startTimerEvent(childId: string, type: TimerEventType): Promise<Event> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('events')
    .insert({
      child_id: childId,
      type,
      start_time: new Date().toISOString(),
      end_time: null,
      created_by: userId,
      metadata: null,
    })
    .select()
    .single<Event>()

  if (error) throw error
  return data
}

/**
 * Stops a running timer event by setting its `end_time` to now. The `end_time
 * is null` guard makes this idempotent: a double-stop (e.g. two devices) closes
 * the event exactly once instead of overwriting an already-recorded end.
 */
export async function stopTimerEvent(eventId: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update({ end_time: new Date().toISOString() })
    .eq('id', eventId)
    .is('end_time', null)
    .select()
    .single<Event>()

  if (error) throw error
  return data
}

/**
 * Fetches a child's events that *overlap* "today" in Israel local time, ordered
 * chronologically. RLS already scopes rows to the caller's family, so we filter
 * only by child and the Israel-local day window.
 *
 * Overlap (not just `start_time` within today) is required so an event that
 * crosses midnight - e.g. an overnight sleep that started yesterday and ends
 * this morning - is still returned and drawn on today's clock (spec section 6).
 * An event overlaps [startIso, endIso) when it starts before the day ends and
 * either ends after the day starts (duration events) or, for a point-in-time
 * event (no `end_time`), starts within the day.
 */
export async function fetchTodayEvents(childId: string): Promise<Event[]> {
  const { startIso, endIso } = israelDayBounds()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('child_id', childId)
    .lt('start_time', endIso)
    .or(`end_time.gt.${startIso},and(end_time.is.null,start_time.gte.${startIso})`)
    .order('start_time', { ascending: true })
    .returns<Event[]>()

  if (error) throw error
  return data
}
