import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { todayEventsKeyPrefix } from './useTodayEvents'

/**
 * Keeps a child's "today" events live across devices: subscribes to Postgres
 * changes on the `events` table for this child and invalidates the child's
 * "today" query on every INSERT / UPDATE / DELETE, so when the other parent
 * logs, edits, or deletes an event the clock updates without a manual refresh.
 *
 * `events` is RLS-protected, so Realtime only delivers a row to a client whose
 * JWT is allowed to SELECT it. We therefore push the current session's access
 * token to the Realtime socket (`realtime.setAuth`) before subscribing;
 * otherwise the socket authenticates as the anon role, which the events RLS
 * policy grants nothing, and no changes would ever arrive.
 *
 * Invalidation (rather than surgically patching the cache) is deliberate: it
 * re-runs the same device-local child-day query the initial fetch used, so a
 * cross-boundary or out-of-window row is handled by one source of truth.
 *
 * The channel is torn down on unmount and re-created when `childId` changes, so
 * no channels leak and StrictMode's double-mount does not leave a duplicate.
 */
export function useTodayEventsRealtime(childId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | undefined

    async function subscribe(): Promise<void> {
      const { data } = await supabase.auth.getSession()
      // If the effect was cleaned up while awaiting the session, do nothing.
      if (cancelled) return

      // Authenticate the Realtime socket so RLS lets this family member receive
      // the child's event changes.
      await supabase.realtime.setAuth(data.session?.access_token)
      if (cancelled) return

      channel = supabase
        .channel(`today-events:${childId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events',
            filter: `child_id=eq.${childId}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: todayEventsKeyPrefix(childId) })
          },
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [childId, queryClient])
}
