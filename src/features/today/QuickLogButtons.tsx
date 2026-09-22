import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner } from '../../components/ui/Banner'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type { Event, EventType } from '../../types/database'
import { isRunningTimerEvent, type ImmediateEventType, type TimerEventType } from './api'
import { eventColor } from './clock/eventColors'
import { getFeedingType } from './eventMetadata'
import {
  FEEDING_CHOICES,
  breastSideLabel,
  bottleAmountOptions,
  formatAmountInUnit,
  readLastBreastSide,
  writeLastBreastSide,
  type FeedingChoice,
} from './feedingChoice'
import { makeFeedingAmount, type Unit } from '../../lib/units'
import { formatStopwatch } from './clock/timeFormat'
import { MOOD_OPTIONS } from './moodOptions'
import { useDisplayUnit } from './useDisplayUnit'
import { useLogImmediateEvent, useStartTimerEvent, useStopTimerEvent } from './useTodayEvents'

interface QuickLogButtonsProps {
  childId: string
  /** The child's events for today, used to detect which timers are running. */
  events: Event[]
  /**
   * Current wall-clock time as epoch ms, ticked once a second by the parent
   * while a timer runs, for the live stopwatch on an active timer button. The
   * parent owns the single tick (shared with the clock) so the bar never runs a
   * second interval of its own; it is unused while `disabled`.
   */
  now: number
  /**
   * Neutralises every button (grey, non-interactive) without unmounting the bar
   * — used by the historical view so a past day cannot be logged under (spec
   * §9.3). Running-timer visuals are also suppressed so no live stopwatch ticks.
   */
  disabled?: boolean
}

/** How long the success confirmation stays visible after a log (ms). */
const CONFIRMATION_DURATION_MS = 2000

/** Confirmation text shown after an event is recorded (immediate log or timer stop). */
const LOGGED_LABELS: Record<EventType, string> = {
  sleep: 'נרשמה שינה',
  feeding: 'נרשמה האכלה',
  diaper: 'נרשם החתלה',
  mood: 'נרשם מצב רוח',
}

/**
 * The round tap target shared by every quick-log button. Its size is fluid: the
 * circle fills its column (each button gets an equal `flex-1` share of the bar)
 * but never grows past 5rem, so the four buttons scale down to fit any screen
 * width instead of overflowing on a narrow phone, while staying 5rem on roomy
 * screens. `aspect-square` keeps it a circle at every size.
 */
const CIRCLE_CLASSES =
  'flex aspect-square w-full max-w-20 flex-col items-center justify-center gap-0.5 rounded-full border text-3xl ' +
  'shadow-md transition-transform duration-fast active:scale-95 focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed'

/** Idle (unpressed) circle: white surface with a neutral border. */
const IDLE_CIRCLE_CLASSES = 'border-neutral-200 bg-neutral-0 disabled:opacity-60'

/** Per-type focus ring color, tying each button to its event color. */
const RING_BY_TYPE: Record<EventType, string> = {
  sleep: 'focus-visible:ring-sleep-500',
  feeding: 'focus-visible:ring-feeding-500',
  diaper: 'focus-visible:ring-diaper-500',
  mood: 'focus-visible:ring-mood-500',
}

/** Filled surface for an actively-running timer, per timer type. */
const ACTIVE_SURFACE_BY_TYPE: Record<TimerEventType, string> = {
  sleep: 'border-transparent bg-sleep-500 text-on-accent',
  feeding: 'border-transparent bg-feeding-500 text-on-accent',
}

interface QuickLogButtonProps {
  label: string
  ariaLabel: string
  ringClass: string
  surfaceClass: string
  disabled: boolean
  onClick: () => void
  ariaHasPopup?: boolean
  ariaExpanded?: boolean
  ariaPressed?: boolean
  children: React.ReactNode
}

/** One labelled round button (icon circle + caption below). */
function QuickLogButton({
  label,
  ariaLabel,
  ringClass,
  surfaceClass,
  disabled,
  onClick,
  ariaHasPopup,
  ariaExpanded,
  ariaPressed,
  children,
}: QuickLogButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-haspopup={ariaHasPopup ? 'menu' : undefined}
      aria-expanded={ariaHasPopup ? ariaExpanded : undefined}
      aria-pressed={ariaPressed}
      className="flex w-full flex-col items-center gap-1.5"
    >
      <span aria-hidden="true" className={`${CIRCLE_CLASSES} ${ringClass} ${surfaceClass}`}>
        {children}
      </span>
      <span className="w-full truncate text-center text-xs font-medium text-neutral-700">
        {label}
      </span>
    </button>
  )
}

interface TimerButtonProps {
  type: TimerEventType
  emoji: string
  /** The running event of this type, if a timer is currently active. */
  activeEvent: Event | undefined
  /** Current wall-clock ms, ticked while a timer runs, for the live duration. */
  now: number
  disabled: boolean
  onStart: () => void
  onStop: (eventId: string) => void
  /**
   * When set, an idle tap opens a menu (via `onStart`) rather than starting the
   * timer directly - used by feeding to pick breast/bottle first. Ignored while
   * a timer is running (then the button is a plain "stop" toggle).
   */
  idleHasPopup?: boolean
  idleExpanded?: boolean
}

/**
 * A start/stop timer button (sleep / feeding). Idle it looks like the other
 * quick-log buttons; while running it fills with the event color and shows a
 * live stopwatch, and tapping it again stops the timer.
 */
function TimerButton({
  type,
  emoji,
  activeEvent,
  now,
  disabled,
  onStart,
  onStop,
  idleHasPopup,
  idleExpanded,
}: TimerButtonProps) {
  const { label } = eventColor(type)
  const isActive = activeEvent !== undefined
  const hasPopup = !isActive && idleHasPopup === true

  const elapsed = isActive
    ? formatStopwatch(now - new Date(activeEvent.start_time).getTime())
    : null

  return (
    <QuickLogButton
      label={label}
      // The stopwatch changes every second; keeping it out of the aria-label
      // avoids constant screen-reader chatter while a timer runs.
      ariaLabel={isActive ? `עצירת ${label}` : `התחלת ${label}`}
      ringClass={RING_BY_TYPE[type]}
      surfaceClass={isActive ? ACTIVE_SURFACE_BY_TYPE[type] : IDLE_CIRCLE_CLASSES}
      disabled={disabled}
      ariaPressed={isActive}
      ariaHasPopup={hasPopup}
      ariaExpanded={hasPopup ? idleExpanded : undefined}
      onClick={() => (isActive ? onStop(activeEvent.id) : onStart())}
    >
      {isActive ? (
        <>
          <span className="text-2xl leading-none">{emoji}</span>
          {/* LTR isolate so the "M:SS" clock keeps its order inside the RTL UI. */}
          <span className="text-xs font-semibold tabular-nums leading-none">{`⁦${elapsed}⁩`}</span>
        </>
      ) : (
        emoji
      )}
    </QuickLogButton>
  )
}

interface FeedingChoiceMenuProps {
  disabled: boolean
  onSelect: (choice: FeedingChoice) => void
}

/**
 * The breast/bottle quick-pick shown above the feeding button. One tap here
 * starts the feeding timer with the matching `metadata`, keeping logging to two
 * taps total. A hint recalls the last breastfed side so parents can alternate.
 */
function FeedingChoiceMenu({ disabled, onSelect }: FeedingChoiceMenuProps) {
  const lastSide = readLastBreastSide()

  return (
    <div
      role="menu"
      aria-label="בחירת אופן האכלה"
      // Anchored to the button's right edge (not centred) so the menu opens
      // inward and never spills past the screen edge on a narrow viewport - the
      // feeding button is the rightmost in the bar. See FeedingAmountMenu too.
      className="absolute bottom-full right-0 mb-2 flex flex-col items-stretch gap-1 rounded-2xl border border-neutral-200 bg-neutral-0 p-2 shadow-md"
    >
      {lastSide && (
        <p className="px-1 pb-0.5 text-center text-xs text-neutral-500">
          צד אחרון: {breastSideLabel(lastSide)}
        </p>
      )}
      {FEEDING_CHOICES.map((choice) => (
        <button
          key={choice.id}
          type="button"
          role="menuitem"
          onClick={() => onSelect(choice)}
          disabled={disabled}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 transition-transform duration-fast active:scale-95 hover:bg-feeding-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-feeding-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true" className="text-xl">
            {choice.emoji}
          </span>
          {choice.label}
        </button>
      ))}
    </div>
  )
}

interface FeedingAmountMenuProps {
  disabled: boolean
  /** The viewer's display unit; options are stepped and labelled in this unit. */
  displayUnit: Unit
  /** Receives the chosen amount expressed in `displayUnit`, or null when skipped. */
  onSelect: (value: number | null) => void
}

/**
 * A scrollable amount picker shown when a bottle feed is stopped, so the parent
 * can record how much the baby drank. Options are stepped in the viewer's unit
 * (ml or oz), keeping entered values clean. "דלג" stops the feed without an
 * amount - the amount is optional, keeping the fast path free of a form.
 */
function FeedingAmountMenu({ disabled, displayUnit, onSelect }: FeedingAmountMenuProps) {
  const options = bottleAmountOptions(displayUnit)
  return (
    <div
      role="menu"
      aria-label="בחירת כמות בקבוק"
      // Right-anchored for the same reason as FeedingChoiceMenu: keep the menu
      // fully on-screen on a narrow viewport instead of centring past the edge.
      className="absolute bottom-full right-0 mb-2 flex w-28 flex-col items-stretch gap-1 rounded-2xl border border-neutral-200 bg-neutral-0 p-2 shadow-md"
    >
      <p className="px-1 pb-0.5 text-center text-xs text-neutral-500">כמה שתה?</p>
      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            role="menuitem"
            onClick={() => onSelect(value)}
            disabled={disabled}
            className="rounded-xl px-3 py-2 text-center text-sm font-medium tabular-nums text-neutral-700 transition-transform duration-fast active:scale-95 hover:bg-feeding-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-feeding-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formatAmountInUnit(value, displayUnit)}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect(null)}
        disabled={disabled}
        className="rounded-xl px-3 py-2 text-center text-sm font-medium text-neutral-500 transition-transform duration-fast active:scale-95 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-feeding-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        דלג
      </button>
    </div>
  )
}

export function QuickLogButtons({ childId, events, now, disabled = false }: QuickLogButtonsProps) {
  const logMutation = useLogImmediateEvent(childId)
  const startTimerMutation = useStartTimerEvent(childId)
  const stopTimerMutation = useStopTimerEvent(childId)
  const displayUnit = useDisplayUnit()
  const [isMoodOpen, setIsMoodOpen] = useState(false)
  const [isFeedingOpen, setIsFeedingOpen] = useState(false)
  const [isAmountOpen, setIsAmountOpen] = useState(false)
  const [confirmedType, setConfirmedType] = useState<EventType | null>(null)
  const confirmationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Wrappers for the two buttons that own a popup menu. A pointer down outside
  // both dismisses any open menu (below); a tap on the button itself or a menu
  // item falls inside its wrapper and is left to that element's own handler.
  const feedingMenuWrapper = useRef<HTMLDivElement>(null)
  const moodMenuWrapper = useRef<HTMLDivElement>(null)

  // The single running timer per type (if any). The UI toggles a button to
  // "stop" while its type is active, which is what enforces one-active-per-type.
  const activeTimers = useMemo(() => {
    const byType = new Map<TimerEventType, Event>()
    // Historical (disabled) mode never shows a running timer: a past day has no
    // "live" active timer to stop, so the buttons stay in their idle look.
    if (disabled) return byType
    for (const event of events) {
      if (!isRunningTimerEvent(event)) continue
      // `isRunningTimerEvent` already narrows to the two timer types.
      byType.set(event.type as TimerEventType, event)
    }
    return byType
  }, [events, disabled])

  useEffect(() => {
    return () => {
      if (confirmationTimeout.current) {
        clearTimeout(confirmationTimeout.current)
      }
    }
  }, [])

  const isAnyMenuOpen = isFeedingOpen || isAmountOpen || isMoodOpen

  // Dismiss an open menu when the user taps anywhere outside it (including
  // another button or the background), so a menu never lingers. A tap on the
  // owning button or a menu item stays inside its wrapper and is handled there
  // (the button toggles, an item selects). The listener is attached only while a
  // menu is open. `pointerdown` covers both touch and mouse.
  useEffect(() => {
    if (!isAnyMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (feedingMenuWrapper.current?.contains(target)) return
      if (moodMenuWrapper.current?.contains(target)) return
      setIsFeedingOpen(false)
      setIsAmountOpen(false)
      setIsMoodOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isAnyMenuOpen])

  function showConfirmation(type: EventType) {
    setConfirmedType(type)
    if (confirmationTimeout.current) {
      clearTimeout(confirmationTimeout.current)
    }
    confirmationTimeout.current = setTimeout(() => {
      setConfirmedType(null)
    }, CONFIRMATION_DURATION_MS)
  }

  function handleLog(type: ImmediateEventType, metadata?: Record<string, unknown>) {
    logMutation.mutate(
      { type, metadata },
      {
        onSuccess: () => showConfirmation(type),
      },
    )
  }

  function handleMoodSelect(level: number) {
    setIsMoodOpen(false)
    handleLog('mood', { mood_level: level })
  }

  function handleStartTimer(type: TimerEventType, metadata?: Record<string, unknown>) {
    startTimerMutation.mutate({ type, metadata })
  }

  function handleFeedingSelect(choice: FeedingChoice) {
    setIsFeedingOpen(false)
    if (choice.side) writeLastBreastSide(choice.side)
    handleStartTimer('feeding', choice.metadata)
  }

  function handleStopTimer(type: TimerEventType, eventId: string) {
    stopTimerMutation.mutate({ eventId }, { onSuccess: () => showConfirmation(type) })
  }

  const feedingEvent = activeTimers.get('feeding')
  const isBottleFeeding = feedingEvent ? getFeedingType(feedingEvent) === 'bottle' : false

  /**
   * Stops the running feeding. A bottle first opens the amount picker (the
   * amount is only known once the feed ends); anything else stops immediately.
   */
  function handleFeedingStop(eventId: string) {
    if (isBottleFeeding) {
      setIsMoodOpen(false)
      setIsAmountOpen(true)
      return
    }
    handleStopTimer('feeding', eventId)
  }

  // Only one popup menu is open at a time: opening one closes the other, so a tap
  // on a second menu's button never leaves both showing.
  function toggleFeedingMenu() {
    setIsMoodOpen(false)
    setIsFeedingOpen((open) => !open)
  }

  function toggleMoodMenu() {
    setIsFeedingOpen(false)
    setIsAmountOpen(false)
    setIsMoodOpen((open) => !open)
  }

  /** Records the chosen bottle amount (or none, when skipped) and stops the feed. */
  function handleFeedingAmountSelect(value: number | null) {
    setIsAmountOpen(false)
    if (!feedingEvent) return

    const metadata =
      value === null
        ? undefined
        : { ...feedingEvent.metadata, ...makeFeedingAmount(value, displayUnit) }

    stopTimerMutation.mutate(
      { eventId: feedingEvent.id, metadata },
      { onSuccess: () => showConfirmation('feeding') },
    )
  }

  const isPending =
    disabled ||
    logMutation.isPending ||
    startTimerMutation.isPending ||
    stopTimerMutation.isPending
  const mutationError = logMutation.error ?? startTimerMutation.error ?? stopTimerMutation.error
  const isError = logMutation.isError || startTimerMutation.isError || stopTimerMutation.isError

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-neutral-50 via-neutral-50/90 to-transparent px-5 pb-6 pt-8">
      <div className="pointer-events-auto mx-auto max-w-sm space-y-3">
        {isError && <Banner message={toFriendlyDbErrorMessage(mutationError)} variant="error" />}

        {confirmedType && (
          <div
            role="status"
            className="rounded-full bg-success-500 px-4 py-2 text-center text-sm font-medium text-on-accent shadow-sm"
          >
            {LOGGED_LABELS[confirmedType]}
          </div>
        )}

        <div className="flex items-start justify-center gap-3">
          <div ref={feedingMenuWrapper} className="relative flex min-w-0 flex-1 flex-col items-center">
            {isFeedingOpen && <FeedingChoiceMenu disabled={isPending} onSelect={handleFeedingSelect} />}
            {isAmountOpen && (
              <FeedingAmountMenu
                disabled={isPending}
                displayUnit={displayUnit}
                onSelect={handleFeedingAmountSelect}
              />
            )}

            <TimerButton
              type="feeding"
              emoji="🍼"
              activeEvent={feedingEvent}
              now={now}
              disabled={isPending}
              idleHasPopup
              idleExpanded={isFeedingOpen}
              onStart={toggleFeedingMenu}
              onStop={handleFeedingStop}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center">
            <TimerButton
              type="sleep"
              emoji="😴"
              activeEvent={activeTimers.get('sleep')}
              now={now}
              disabled={isPending}
              onStart={() => handleStartTimer('sleep')}
              onStop={(eventId) => handleStopTimer('sleep', eventId)}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center">
            <QuickLogButton
              label="החתלה"
              ariaLabel="רישום החתלה"
              ringClass={RING_BY_TYPE.diaper}
              surfaceClass={IDLE_CIRCLE_CLASSES}
              disabled={isPending}
              onClick={() => handleLog('diaper')}
            >
              🧷
            </QuickLogButton>
          </div>

          <div ref={moodMenuWrapper} className="relative flex min-w-0 flex-1 flex-col items-center">
            {isMoodOpen && (
              <div
                role="menu"
                aria-label="בחירת מצב רוח"
                // Left-anchored (the mood button is the leftmost in the bar) so
                // the menu opens inward and stays on-screen on a narrow viewport.
                className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-2xl border border-neutral-200 bg-neutral-0 p-2 shadow-md"
              >
                {MOOD_OPTIONS.map((option) => (
                  <button
                    key={option.level}
                    type="button"
                    role="menuitem"
                    onClick={() => handleMoodSelect(option.level)}
                    disabled={isPending}
                    aria-label={option.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform duration-fast active:scale-95 hover:bg-mood-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mood-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span aria-hidden="true">{option.emoji}</span>
                  </button>
                ))}
              </div>
            )}

            <QuickLogButton
              label="מצב רוח"
              ariaLabel="רישום מצב רוח"
              ringClass={RING_BY_TYPE.mood}
              surfaceClass={IDLE_CIRCLE_CLASSES}
              disabled={isPending}
              onClick={toggleMoodMenu}
              ariaHasPopup
              ariaExpanded={isMoodOpen}
            >
              😊
            </QuickLogButton>
          </div>
        </div>
      </div>
    </div>
  )
}
