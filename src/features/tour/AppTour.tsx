import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { padRect, placeTourCard, type Point, type Rect } from './tourPlacement'
import { findTourAnchor, TOUR_STEPS } from './tourSteps'

interface AppTourProps {
  /** Called when the tour ends: finished, skipped, or dismissed with Escape. */
  onClose: () => void
}

const BUTTON_BASE =
  'min-h-10 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

function toRect(domRect: DOMRect): Rect {
  return { top: domRect.top, left: domRect.left, width: domRect.width, height: domRect.height }
}

/**
 * A guided walk through the Today screen: a dimmed page with the current
 * region cut out and outlined, and a small card that explains it.
 *
 * - Rendered in a portal over the whole app (z-40, above the header menu at
 *   z-30). The full-screen layer swallows taps, so the page underneath cannot
 *   be used mid-tour; "דלג" or Escape ends it.
 * - A step whose anchor is not on the page (e.g. a region not rendered) is
 *   shown centred with no highlight instead of failing.
 * - Moving between steps is instant: the anchor is scrolled into view without
 *   smooth scrolling, and nothing animates (design-system motion rules).
 * - Accessibility: a modal dialog labelled by the step title; focus moves to
 *   the primary button on every step, Tab cycles inside the card, and focus
 *   returns to where it was when the tour opened. Escape and Tab are handled on
 *   `document`, and a tap on the dimmed layer never takes focus off the card,
 *   so neither can leak to the page behind it.
 */
export function AppTour({ onClose }: AppTourProps) {
  const [index, setIndex] = useState(0)
  const [highlight, setHighlight] = useState<Rect | null>(null)
  const [cardPosition, setCardPosition] = useState<Point | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()
  // Captured during the first render - before any effect moves focus into the
  // card - so closing the tour can hand focus back.
  const [returnFocusTo] = useState(() => document.activeElement)
  // The latest onClose, for the document key listener registered once.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  const step = TOUR_STEPS[index]
  const isFirst = index === 0
  const isLast = index === TOUR_STEPS.length - 1

  // Position the highlight and the card for the current step, and keep them in
  // place while the page scrolls or the viewport resizes. A layout effect, so
  // the first position is applied before paint (no flash at the corner).
  useLayoutEffect(() => {
    const anchor = step.anchor ? findTourAnchor(step.anchor) : null
    anchor?.scrollIntoView({ block: 'center', behavior: 'instant' })

    let frame = 0

    function measure() {
      frame = 0
      const card = cardRef.current
      if (!card) return
      const rect = anchor?.isConnected ? padRect(toRect(anchor.getBoundingClientRect())) : null
      setHighlight(rect)
      setCardPosition(
        placeTourCard(
          rect,
          { width: card.offsetWidth, height: card.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      )
    }

    function scheduleMeasure() {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('resize', scheduleMeasure)
    // Capture phase: also catches scrolling inside nested scroll containers.
    window.addEventListener('scroll', scheduleMeasure, true)
    return () => {
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [step])

  // Every step starts with focus on its primary action.
  useEffect(() => {
    primaryRef.current?.focus()
  }, [index])

  // Give focus back to whatever had it before the tour opened.
  useEffect(() => {
    return () => {
      if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) {
        returnFocusTo.focus()
      }
    }
  }, [returnFocusTo])

  // Modal keyboard handling, on `document` so it works wherever focus is:
  // Escape closes; Tab cycles through the card's buttons and is pulled back
  // into the card if focus ever ended up outside it.
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const card = cardRef.current
      const focusable = Array.from(card?.querySelectorAll<HTMLElement>('button') ?? [])
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!card || !first || !last) return

      const active = document.activeElement
      if (!card.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function goNext() {
    if (isLast) {
      onClose()
      return
    }
    setIndex((current) => current + 1)
  }

  function goBack() {
    setIndex((current) => Math.max(0, current - 1))
  }

  /** A tap on the dimmed layer does nothing - and must not move focus to <body>. */
  function handleLayerPress(event: MouseEvent<HTMLDivElement>) {
    if (!cardRef.current?.contains(event.target as Node)) event.preventDefault()
  }

  return createPortal(
    <div className="fixed inset-0 z-40" onPointerDown={handleLayerPress}
      // Some browsers move focus on mousedown even when pointerdown is cancelled.
      onMouseDown={handleLayerPress}
    >
      {highlight ? (
        // The cut-out: a transparent box whose huge spread shadow dims
        // everything around it.
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-lg shadow-[0_0_0_9999px_var(--color-scrim)] outline-2 outline-brand-500"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-scrim" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        // Hidden only for the instant before the first measurement.
        className={`fixed w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-lg ${
          cardPosition ? '' : 'invisible'
        }`}
        style={cardPosition ?? undefined}
      >
        <p className="text-xs text-neutral-600">
          {index + 1} מתוך {TOUR_STEPS.length}
        </p>
        <h2 id={titleId} className="mt-1 text-base font-semibold text-neutral-900">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1 text-sm text-neutral-600">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-2">
          {!isLast && (
            <button
              type="button"
              onClick={onClose}
              className={`${BUTTON_BASE} -ms-2 bg-transparent text-neutral-600 hover:bg-neutral-100`}
            >
              דלג
            </button>
          )}
          <div className="ms-auto flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={goBack}
                className={`${BUTTON_BASE} border border-neutral-200 bg-neutral-0 text-neutral-900 hover:bg-neutral-100`}
              >
                הקודם
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              onClick={goNext}
              className={`${BUTTON_BASE} bg-brand-500 text-on-accent hover:bg-brand-600`}
            >
              {isLast ? 'סיום' : 'הבא'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
