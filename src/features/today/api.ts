import { supabase } from '../../lib/supabase'
import type { Event, EventType } from '../../types/database'
import { deviceDayBounds, deviceDayBoundsForDate } from './todayDate'

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

/** The event types logged as a start/stop timer. */
const TIMER_EVENT_TYPE_LIST: readonly TimerEventType[] = ['sleep', 'feeding']

/** The event types logged as a start/stop timer, as a runtime set. */
const TIMER_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>(TIMER_EVENT_TYPE_LIST)

/**
 * True while `event` is a timer event (sleep/feeding) that is still running —
 * i.e. it has no `end_time` yet. This is the single source of truth for "there
 * is a live timer", shared by the clock, the quick-log bar, and the once-a-second
 * tick that keeps their live elapsed readouts advancing.
 */
export function isRunningTimerEvent(event: Event): boolean {
  return event.end_time === null && TIMER_EVENT_TYPES.has(event.type)
}

/**
 * The PostgREST `or` filter selecting events that overlap `[startIso, …)`, for
 * use together with `start_time < endIso`. An event overlaps when it:
 * - ends after the window starts (a finished duration event), or
 * - has no `end_time` and starts within the window (a point-in-time event, or
 *   a timer started inside the window), or
 * - is a timer that is still running, whenever it started. A sleep started
 *   last night and still running this morning spans today too, and readers
 *   draw it up to "now". Without this it would vanish at the day boundary and
 *   could neither be stopped nor replaced (one running timer per type is
 *   enforced by the database).
 */
export function overlapsWindowFilter(startIso: string): string {
  const runningTimer = `and(end_time.is.null,type.in.(${TIMER_EVENT_TYPE_LIST.join(',')}))`
  return [
    `end_time.gt.${startIso}`,
    `and(end_time.is.null,start_time.gte.${startIso})`,
    runningTimer,
  ].join(',')
}

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
 * Postgres `unique_violation`. On an `events` insert it can only come from the
 * `events_one_running_timer_per_type` partial unique index (the primary key is
 * generated), i.e. a timer of that type is already running for the child.
 */
const UNIQUE_VIOLATION_CODE = '23505'

/** True when `error` is a Postgres unique violation reported by PostgREST. */
function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === UNIQUE_VIOLATION_CODE
}

/**
 * The result of a start tap. `already-running` means another device (the other
 * parent) started a timer of the same type first, so this tap adopted that
 * running timer instead of opening a second one.
 */
export type StartTimerResult =
  | { outcome: 'started'; event: Event }
  | { outcome: 'already-running'; event: Event }

/**
 * The result of a stop tap. `already-stopped` means the timer was no longer
 * running when the update arrived — typically the other parent stopped it a
 * moment earlier — so nothing was changed.
 */
export type StopTimerResult =
  | { outcome: 'stopped'; event: Event }
  | { outcome: 'already-stopped' }

/** Fetches the child's currently running timer of `type`, if there is one. */
async function fetchRunningTimerEvent(
  childId: string,
  type: TimerEventType,
): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('child_id', childId)
    .eq('type', type)
    .is('end_time', null)
    .maybeSingle<Event>()

  if (error) throw error
  return data
}

/**
 * Starts a start/stop timer event: inserts a row with `start_time = now` and
 * `end_time = null`, i.e. an event that is still running.
 *
 * At most one running timer per child and type is enforced by the database
 * (the `events_one_running_timer_per_type` partial unique index), not just the
 * UI: two parents can tap "start" on two phones before either sees the other's
 * timer over Realtime. The second insert then fails with a unique violation,
 * and this tap adopts the timer that is already running instead of failing.
 */
export async function startTimerEvent(
  childId: string,
  type: TimerEventType,
  metadata?: Record<string, unknown>,
): Promise<StartTimerResult> {
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

  if (!error) return { outcome: 'started', event: data }
  if (!isUniqueViolation(error)) throw error

  const runningEvent = await fetchRunningTimerEvent(childId, type)
  // The running timer was stopped again between our failed insert and this
  // read. Surface the original conflict rather than silently doing nothing.
  if (!runningEvent) throw error
  return { outcome: 'already-running', event: runningEvent }
}

/**
 * Stops a running timer event by setting its `end_time` to now. The `end_time
 * is null` guard makes this idempotent: a double-stop (e.g. both parents tap
 * "stop" at once) closes the event exactly once instead of overwriting an
 * already-recorded end. The later stop matches no row and resolves as
 * `already-stopped` rather than an error.
 *
 * An optional `metadata` replaces the event's metadata as part of the same
 * update - used to record a bottle's amount, captured only when the feed ends.
 * The caller merges it with the existing metadata so earlier fields (feeding
 * type, side) are preserved; omit it to leave the metadata untouched. When the
 * timer was already stopped, the metadata is not applied, so the stop that won
 * keeps its own values.
 */
export async function stopTimerEvent(
  eventId: string,
  metadata?: Record<string, unknown>,
): Promise<StopTimerResult> {
  const { data, error } = await supabase
    .from('events')
    .update({
      end_time: new Date().toISOString(),
      ...(metadata ? { metadata } : {}),
    })
    .eq('id', eventId)
    .is('end_time', null)
    .select()
    .maybeSingle<Event>()

  if (error) throw error
  if (!data) return { outcome: 'already-stopped' }
  return { outcome: 'stopped', event: data }
}

/**
 * Fetches a child's events that *overlap* "today" — the device-local child-day
 * bounded by the child's `day_start` — ordered chronologically. RLS already
 * scopes rows to the caller's family, so we filter only by child and the day
 * window.
 *
 * Overlap (not just `start_time` within today) is required so an event that
 * crosses the day boundary - e.g. an overnight sleep that started yesterday and
 * ends this morning - is still returned and drawn on today's clock (spec
 * section 6). An event overlaps [startIso, endIso) when it starts before the
 * day ends and either ends after the day starts (duration events), is a timer
 * still running (however long ago it started), or, for a point-in-time event
 * (no `end_time`), starts within the day. See {@link overlapsWindowFilter}.
 */
export async function fetchTodayEvents(childId: string, dayStart = '00:00'): Promise<Event[]> {
  const { startIso, endIso } = deviceDayBounds(new Date(), dayStart)
  return fetchEventsInWindow(childId, startIso, endIso)
}

/**
 * Fetches a child's events overlapping a *specific* past child-day, identified
 * by its device-local calendar date (`YYYY-MM-DD`). Used by the historical Today
 * view (spec §9.2): the whole data chain is anchored on the selected date, not
 * on "now", so a midnight-crossing event clips to that day's bounds exactly as
 * it does on the live clock and the Week screen.
 */
export async function fetchEventsForDate(
  childId: string,
  dateString: string,
  dayStart = '00:00',
): Promise<Event[]> {
  const { startIso, endIso } = deviceDayBoundsForDate(dateString, dayStart)
  return fetchEventsInWindow(childId, startIso, endIso)
}

/**
 * Shared day-window query: a child's events overlapping `[startIso, endIso)`,
 * ordered chronologically. See {@link fetchTodayEvents} for the overlap rule.
 */
async function fetchEventsInWindow(
  childId: string,
  startIso: string,
  endIso: string,
): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('child_id', childId)
    .lt('start_time', endIso)
    .or(overlapsWindowFilter(startIso))
    .order('start_time', { ascending: true })
    .returns<Event[]>()

  if (error) throw error
  return data
}
