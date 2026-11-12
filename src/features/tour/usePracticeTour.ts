import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Child } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { createPracticeChild, deleteOwnPracticeChildren, deletePracticeChild } from './practiceChild'
import { clearTourRequest, isTourRequested } from './tourStart'

/**
 * Leftover practice children (from a tour abandoned midway) are cleaned up once
 * per signed-in user per app session, on their first Today visit - not on every
 * visit. Keyed by user, so a different account in the same tab is cleaned too.
 */
let leftoversCleanedFor: string | null = null

export interface PracticeTour {
  /** The practice child while a tour runs; null otherwise. */
  readonly practiceChild: Child | null
  readonly isStarting: boolean
  /** True when the last attempt to start the tour failed. */
  readonly hasStartFailed: boolean
  readonly start: () => void
  readonly end: () => void
}

/**
 * Runs the interactive tour's data side for the Today screen: creates the
 * practice child when a tour starts, deletes it (and its events) when the tour
 * ends, and starts the tour by itself once after onboarding (see tourStart).
 *
 * `realChild` is the family's real child: the practice child copies its birth
 * date and day boundary.
 */
export function usePracticeTour(realChild: Child | null): PracticeTour {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [practiceChild, setPracticeChild] = useState<Child | null>(null)
  // Mirrors of state for the unmount cleanup, which must not depend on renders.
  const practiceChildRef = useRef<Child | null>(null)
  const isMountedRef = useRef(false)

  // Errors are reported by the global mutation handler (lib/queryClient); a
  // failed cleanup is retried on the next tour start or app session. A mutation
  // started from an unmount cleanup still runs to completion.
  const { mutate: cleanUp } = useMutation({ mutationFn: deleteOwnPracticeChildren })
  // For an abandoned tour: removes just that tour's child, never a newer one.
  const { mutate: discard } = useMutation({ mutationFn: deletePracticeChild })

  const { mutate: create, isPending: isStarting, isError: hasStartFailed } = useMutation({
    mutationFn: (input: { child: Child; ownerId: string }) =>
      createPracticeChild({
        familyId: input.child.family_id,
        ownerId: input.ownerId,
        birthDate: input.child.birth_date,
        dayStart: input.child.day_start,
      }),
    onSuccess: (child) => {
      // Today was left while the practice child was being created: nobody will
      // end this tour, so remove the child straight away.
      if (!isMountedRef.current) {
        discard(child.id)
        return
      }
      practiceChildRef.current = child
      setPracticeChild(child)
    },
  })

  const start = useCallback(() => {
    if (!realChild || !userId || isStarting || practiceChild) return
    create({ child: realChild, ownerId: userId })
  }, [create, isStarting, practiceChild, realChild, userId])

  const end = useCallback(() => {
    practiceChildRef.current = null
    setPracticeChild(null)
    if (userId) cleanUp(userId)
  }, [cleanUp, userId])

  // Leaving Today mid-tour (Back, or a link inside a highlighted element) ends
  // the tour without `end`: delete the practice child on the way out. Safe under
  // StrictMode - its simulated unmount happens before any tour has started.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      const leftover = practiceChildRef.current
      if (leftover) {
        practiceChildRef.current = null
        discard(leftover.id)
      }
    }
  }, [discard])

  useEffect(() => {
    if (!userId || !realChild) return

    // Onboarding asked for the tour: start it once.
    if (isTourRequested()) {
      clearTourRequest()
      leftoversCleanedFor = userId // creating the practice child cleans up first
      create({ child: realChild, ownerId: userId })
      return
    }

    if (leftoversCleanedFor !== userId) {
      leftoversCleanedFor = userId
      cleanUp(userId)
    }
  }, [cleanUp, create, realChild, userId])

  return { practiceChild, isStarting, hasStartFailed, start, end }
}
