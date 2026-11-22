import { useQueryClient } from '@tanstack/react-query'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Event } from '../../types/database'
import { todayEventsKeyPrefix } from '../today/useTodayEvents'
import './tour.css'
import { isTourAnchorShown, TOUR_STEPS, tourAnchorSelector, type TourStep } from './tourSteps'

interface InteractiveTourProps {
  /** The practice child, whose saves the tour watches. */
  childId: string
  /** The practice child's events for today - what action steps wait on. */
  events: readonly Event[]
  /** Called once when the tour ends: finished, skipped, or closed with Escape. */
  onEnd: () => void
}

/** Fallback when the `--color-scrim` token cannot be read. */
const FALLBACK_SCRIM = 'rgba(28, 25, 23, 0.55)'

function toDriveStep(step: TourStep): DriveStep {
  const isAction = step.isComplete !== undefined
  return {
    element: step.anchor ? tourAnchorSelector(step.anchor) : undefined,
    popover: {
      title: step.title,
      description: step.body,
      // Action steps move on only when the action happens - no "הבא".
      showButtons: isAction ? ['close'] : ['next', 'close'],
    },
    // Info steps only explain: the highlighted element stays inert, so e.g. the
    // header menu cannot be used to leave Today mid-tour.
    disableActiveInteraction: !isAction,
  }
}

/**
 * The interactive tour, on driver.js. It highlights one element at a time on
 * the live Today screen - which, while the tour runs, shows the practice child -
 * and the parent really uses it: action steps wait until the action has truly
 * happened (an event saved, a menu opened), then move on by themselves.
 *
 * - Progress is checked whenever the events change and whenever the DOM
 *   changes (popup menus open and close without any event being saved).
 * - No going back: a finished action cannot be "undone" by stepping back, so
 *   there is no "הקודם" and ArrowLeft does nothing.
 * - No animation and no smooth scrolling (design-system motion rules); the
 *   overlay uses the `scrim` token, the popover is themed in tour.css.
 * - Renders nothing itself: driver.js owns its overlay and popover DOM.
 */
export function InteractiveTour({ childId, events, onEnd }: InteractiveTourProps) {
  const queryClient = useQueryClient()
  const driverRef = useRef<Driver | null>(null)
  const eventsRef = useRef(events)
  const onEndRef = useRef(onEnd)

  useLayoutEffect(() => {
    eventsRef.current = events
    onEndRef.current = onEnd
  })

  const checkProgress = useCallback(() => {
    const tour = driverRef.current
    const index = tour?.getActiveIndex()
    if (!tour?.isActive() || index === undefined) return

    const step = TOUR_STEPS[index]
    if (!step?.isComplete) return

    const context = { events: eventsRef.current, isAnchorShown: isTourAnchorShown }

    if (step.isComplete(context)) {
      if (tour.hasNextStep()) tour.moveNext()
      else tour.destroy()
      return
    }

    // The step's popup menu was closed without choosing (an outside tap). A
    // choice also closes the menu, but then its save - and the events refetch
    // that brings it in, which outlives the mutation - is still in flight; wait
    // for both, or the tour would flick back a step after every choice.
    if (
      step.backWhenAnchorGone &&
      step.anchor &&
      !isTourAnchorShown(step.anchor) &&
      queryClient.isMutating() === 0 &&
      queryClient.isFetching({ queryKey: todayEventsKeyPrefix(childId) }) === 0
    ) {
      tour.movePrevious()
    }
  }, [childId, queryClient])

  useEffect(() => {
    let isTearingDown = false
    const scrim = getComputedStyle(document.documentElement).getPropertyValue('--color-scrim').trim()

    const tour = driver({
      steps: TOUR_STEPS.map(toDriveStep),
      animate: false,
      smoothScroll: false,
      overlayColor: scrim || FALLBACK_SCRIM,
      // The token's own alpha sets the dimming.
      overlayOpacity: 1,
      overlayClickBehavior: 'none',
      stagePadding: 6,
      stageRadius: 16,
      allowKeyboardControl: true,
      showProgress: true,
      progressText: '{{current}} מתוך {{total}}',
      nextBtnText: 'הבא',
      doneBtnText: 'סיום',
      closeBtnLabel: 'דלג על הסיור',
      popoverClass: 'app-tour',
      onNextClick: (_element, _step, { driver: active }) => {
        // Blocks "הבא"/ArrowRight on an action step: only the action advances it.
        const step = TOUR_STEPS[active.getActiveIndex() ?? -1]
        if (step?.isComplete) return
        if (active.hasNextStep()) active.moveNext()
        else active.destroy()
      },
      onPrevClick: () => {
        // No going back (see the component doc).
      },
      onHighlighted: () => checkProgress(),
      onDestroyed: () => {
        driverRef.current = null
        // Unmounting (or StrictMode's re-run) is not the user ending the tour.
        if (!isTearingDown) onEndRef.current()
      },
    })

    driverRef.current = tour
    tour.drive()

    const observer = new MutationObserver(checkProgress)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      isTearingDown = true
      observer.disconnect()
      tour.destroy()
    }
  }, [checkProgress])

  useEffect(() => {
    checkProgress()
  }, [events, checkProgress])

  return null
}
