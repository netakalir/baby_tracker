import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner } from '../../components/ui/Banner'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type { Event, EventType } from '../../types/database'
import type { ImmediateEventType, TimerEventType } from './api'
import { eventColor } from './clock/eventColors'
import { formatStopwatch } from './clock/timeFormat'
import { useLogImmediateEvent, useStartTimerEvent, useStopTimerEvent } from './useTodayEvents'

interface QuickLogButtonsProps {
  childId: string
  /** The child's events for today, used to detect which timers are running. */
  events: Event[]
}

/** How long the success confirmation stays visible after a log (ms). */
const CONFIRMATION_DURATION_MS = 2000

interface MoodOption {
  /** Stored in `metadata.mood_level` - higher is happier. */
  level: number
  emoji: string
  label: string
}

/**
 * Mood options, worst to best. `mood_level` is a small ordinal scale so it can
 * be averaged/charted later without another migration (metadata is jsonb).
 */
const MOOD_OPTIONS: readonly MoodOption[] = [
  { level: 1, emoji: '😢', label: 'בוכה' },
  { level: 2, emoji: '😕', label: 'לא רגוע' },
  { level: 3, emoji: '😊', label: 'רגוע' },
  { level: 4, emoji: '😄', label: 'שמח' },
]

/** Confirmation text shown after an event is recorded (immediate log or timer stop). */
const LOGGED_LABELS: Record<EventType, string> = {
  sleep: 'נרשמה שינה',
  feeding: 'נרשמה האכלה',
  diaper: 'נרשם החתלה',
  mood: 'נרשם מצב רוח',
}

/** The round tap target shared by every quick-log button. */
const CIRCLE_CLASSES =
  'flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border text-3xl ' +
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
  sleep: 'border-transparent bg-sleep-500 text-neutral-0',
  feeding: 'border-transparent bg-feeding-500 text-neutral-0',
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
      className="flex flex-col items-center gap-1.5"
    >
      <span aria-hidden="true" className={`${CIRCLE_CLASSES} ${ringClass} ${surfaceClass}`}>
        {children}
      </span>
      <span className="text-xs font-medium text-neutral-700">{label}</span>
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
}

/**
 * A start/stop timer button (sleep / feeding). Idle it looks like the other
 * quick-log buttons; while running it fills with the event color and shows a
 * live stopwatch, and tapping it again stops the timer.
 */
function TimerButton({ type, emoji, activeEvent, now, disabled, onStart, onStop }: TimerButtonProps) {
  const { label } = eventColor(type)
  const isActive = activeEvent !== undefined

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

export function QuickLogButtons({ childId, events }: QuickLogButtonsProps) {
  const logMutation = useLogImmediateEvent(childId)
  const startTimerMutation = useStartTimerEvent(childId)
  const stopTimerMutation = useStopTimerEvent(childId)
  const [isMoodOpen, setIsMoodOpen] = useState(false)
  const [confirmedType, setConfirmedType] = useState<EventType | null>(null)
  const confirmationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The single running timer per type (if any). The UI toggles a button to
  // "stop" while its type is active, which is what enforces one-active-per-type.
  const activeTimers = useMemo(() => {
    const byType = new Map<TimerEventType, Event>()
    for (const event of events) {
      if (event.end_time !== null) continue
      if (event.type === 'sleep' || event.type === 'feeding') byType.set(event.type, event)
    }
    return byType
  }, [events])

  // Tick once a second only while at least one timer is running, so the live
  // stopwatch updates without re-rendering the whole screen when idle.
  const [now, setNow] = useState(() => Date.now())
  const hasActiveTimer = activeTimers.size > 0
  useEffect(() => {
    if (!hasActiveTimer) return
    setNow(Date.now())
    const intervalId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [hasActiveTimer])

  useEffect(() => {
    return () => {
      if (confirmationTimeout.current) {
        clearTimeout(confirmationTimeout.current)
      }
    }
  }, [])

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

  function handleStartTimer(type: TimerEventType) {
    startTimerMutation.mutate({ type })
  }

  function handleStopTimer(type: TimerEventType, eventId: string) {
    stopTimerMutation.mutate({ eventId }, { onSuccess: () => showConfirmation(type) })
  }

  const isPending =
    logMutation.isPending || startTimerMutation.isPending || stopTimerMutation.isPending
  const mutationError = logMutation.error ?? startTimerMutation.error ?? stopTimerMutation.error
  const isError = logMutation.isError || startTimerMutation.isError || stopTimerMutation.isError

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-neutral-50 via-neutral-50/90 to-transparent px-5 pb-6 pt-8">
      <div className="pointer-events-auto mx-auto max-w-sm space-y-3">
        {isError && <Banner message={toFriendlyDbErrorMessage(mutationError)} variant="error" />}

        {confirmedType && (
          <div
            role="status"
            className="rounded-full bg-success-500 px-4 py-2 text-center text-sm font-medium text-neutral-0 shadow-sm"
          >
            {LOGGED_LABELS[confirmedType]}
          </div>
        )}

        <div className="flex items-start justify-center gap-3">
          <TimerButton
            type="feeding"
            emoji="🍼"
            activeEvent={activeTimers.get('feeding')}
            now={now}
            disabled={isPending}
            onStart={() => handleStartTimer('feeding')}
            onStop={(eventId) => handleStopTimer('feeding', eventId)}
          />

          <TimerButton
            type="sleep"
            emoji="😴"
            activeEvent={activeTimers.get('sleep')}
            now={now}
            disabled={isPending}
            onStart={() => handleStartTimer('sleep')}
            onStop={(eventId) => handleStopTimer('sleep', eventId)}
          />

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

          <div className="relative flex flex-col items-center">
            {isMoodOpen && (
              <div
                role="menu"
                aria-label="בחירת מצב רוח"
                className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-2xl border border-neutral-200 bg-neutral-0 p-2 shadow-md"
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
              onClick={() => setIsMoodOpen((open) => !open)}
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
