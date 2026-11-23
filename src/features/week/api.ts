import { supabase } from '../../lib/supabase'
import type { Event } from '../../types/database'
import { overlapsWindowFilter } from '../today/api'
import { weekBounds } from './weekDate'

/**
 * Fetches a child's events that *overlap* the calendar week anchored at `sunday`
 * (the seven Sunday–Saturday child-days), ordered chronologically. RLS already
 * scopes rows to the caller's family, so we filter only by child and the week
 * window.
 *
 * Overlap (not just `start_time` within the week) mirrors {@link fetchTodayEvents}:
 * an event that crosses a day boundary — e.g. an overnight sleep — is still
 * returned so its duration can be split across the days it touches. An event
 * overlaps `[startIso, endIso)` when it starts before the window ends and either
 * ends after the window starts (duration events), is a timer still running, or,
 * for a point-in-time event (no `end_time`), starts within the window. The rule
 * is shared via {@link overlapsWindowFilter}.
 */
export async function fetchWeekEvents(
  childId: string,
  sunday: string,
  dayStart = '00:00',
): Promise<Event[]> {
  const { startIso, endIso } = weekBounds(sunday, dayStart)

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
