import { supabase } from '../../lib/supabase'
import type { Event } from '../../types/database'
import { weekWindowBounds } from './weekDate'

/**
 * Fetches a child's events that *overlap* the displayed week — the seven
 * child-days ending with today, bounded by the child's `day_start` — ordered
 * chronologically. RLS already scopes rows to the caller's family, so we filter
 * only by child and the week window.
 *
 * Overlap (not just `start_time` within the week) mirrors {@link fetchTodayEvents}:
 * an event that crosses a day boundary — e.g. an overnight sleep — is still
 * returned so its duration can be split across the days it touches. An event
 * overlaps `[startIso, endIso)` when it starts before the window ends and either
 * ends after the window starts (duration events) or, for a point-in-time event
 * (no `end_time`), starts within the window.
 */
export async function fetchWeekEvents(childId: string, dayStart = '00:00'): Promise<Event[]> {
  const { startIso, endIso } = weekWindowBounds(new Date(), dayStart)

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
