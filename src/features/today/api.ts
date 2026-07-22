import { supabase } from '../../lib/supabase'
import type { Event, EventType } from '../../types/database'
import { israelDayBounds } from './todayDate'

/**
 * Event types that are logged as a single instantaneous tap (no timer).
 * `sleep` is intentionally excluded here - it is a start/stop timer handled by
 * a separate slice (see QuickLogButtons.tsx).
 */
export type ImmediateEventType = Extract<EventType, 'feeding' | 'diaper' | 'mood'>

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
  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userResult.user?.id
  if (!userId) {
    throw new Error('Cannot log an event without an authenticated user')
  }

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
 * Fetches a child's events that fall within "today" in Israel local time,
 * ordered chronologically. RLS already scopes rows to the caller's family, so
 * we filter only by child and the Israel-local day window.
 */
export async function fetchTodayEvents(childId: string): Promise<Event[]> {
  const { startIso, endIso } = israelDayBounds()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('child_id', childId)
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .order('start_time', { ascending: true })
    .returns<Event[]>()

  if (error) throw error
  return data
}
