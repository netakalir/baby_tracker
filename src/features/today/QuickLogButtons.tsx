import { useEffect, useRef, useState } from 'react'
import { Banner } from '../../components/ui/Banner'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import type { ImmediateEventType } from './api'
import { useLogImmediateEvent } from './useTodayEvents'

interface QuickLogButtonsProps {
  childId: string
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

const CONFIRMATION_LABELS: Record<ImmediateEventType, string> = {
  feeding: 'נרשמה האכלה',
  diaper: 'נרשם החתלה',
  mood: 'נרשם מצב רוח',
}

interface LogButtonStyle {
  surface: string
  ring: string
}

const BUTTON_STYLES: Record<ImmediateEventType, LogButtonStyle> = {
  feeding: { surface: 'bg-feeding-50 text-feeding-500', ring: 'focus-visible:ring-feeding-500' },
  diaper: { surface: 'bg-diaper-50 text-diaper-500', ring: 'focus-visible:ring-diaper-500' },
  mood: { surface: 'bg-mood-50 text-mood-500', ring: 'focus-visible:ring-mood-500' },
}

const BASE_BUTTON_CLASSES =
  'flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-3xl ' +
  'transition-transform duration-fast active:scale-95 focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

export function QuickLogButtons({ childId }: QuickLogButtonsProps) {
  const logMutation = useLogImmediateEvent(childId)
  const [isMoodOpen, setIsMoodOpen] = useState(false)
  const [confirmedType, setConfirmedType] = useState<ImmediateEventType | null>(null)
  const confirmationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (confirmationTimeout.current) {
        clearTimeout(confirmationTimeout.current)
      }
    }
  }, [])

  function showConfirmation(type: ImmediateEventType) {
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

  function handleFeeding() {
    handleLog('feeding')
  }

  function handleDiaper() {
    handleLog('diaper')
  }

  function handleMoodSelect(level: number) {
    setIsMoodOpen(false)
    handleLog('mood', { mood_level: level })
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-4 pb-4">
      <div className="pointer-events-auto mx-auto max-w-md space-y-3">
        {logMutation.isError && (
          <Banner message={toFriendlyDbErrorMessage(logMutation.error)} variant="error" />
        )}

        {confirmedType && (
          <div
            role="status"
            className="rounded-md bg-success-500 px-4 py-2 text-center text-sm font-medium text-neutral-0"
          >
            {CONFIRMATION_LABELS[confirmedType]}
          </div>
        )}

        <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={handleFeeding}
              disabled={logMutation.isPending}
              aria-label="רישום האכלה"
              className={`${BASE_BUTTON_CLASSES} ${BUTTON_STYLES.feeding.surface} ${BUTTON_STYLES.feeding.ring}`}
            >
              <span aria-hidden="true">🍼</span>
              <span className="text-xs font-medium">האכלה</span>
            </button>

            {/*
              Sleep is a start/stop timer, not an immediate tap - it is owned by
              a later slice, so the button is a disabled placeholder for now.
            */}
            <button
              type="button"
              disabled
              aria-label="שינה (בקרוב)"
              className={`${BASE_BUTTON_CLASSES} bg-sleep-50 text-sleep-500`}
            >
              <span aria-hidden="true">😴</span>
              <span className="text-xs font-medium">שינה</span>
            </button>

            <button
              type="button"
              onClick={handleDiaper}
              disabled={logMutation.isPending}
              aria-label="רישום החתלה"
              className={`${BASE_BUTTON_CLASSES} ${BUTTON_STYLES.diaper.surface} ${BUTTON_STYLES.diaper.ring}`}
            >
              <span aria-hidden="true">🧷</span>
              <span className="text-xs font-medium">החתלה</span>
            </button>

            <div className="relative flex flex-1">
              {isMoodOpen && (
                <div
                  role="menu"
                  aria-label="בחירת מצב רוח"
                  className="absolute bottom-full mb-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg border border-neutral-200 bg-neutral-0 p-2 shadow-sm"
                >
                  {MOOD_OPTIONS.map((option) => (
                    <button
                      key={option.level}
                      type="button"
                      role="menuitem"
                      onClick={() => handleMoodSelect(option.level)}
                      disabled={logMutation.isPending}
                      aria-label={option.label}
                      className="flex h-12 w-12 items-center justify-center rounded-md text-2xl transition-transform duration-fast active:scale-95 hover:bg-mood-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mood-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsMoodOpen((open) => !open)}
                disabled={logMutation.isPending}
                aria-label="רישום מצב רוח"
                aria-haspopup="menu"
                aria-expanded={isMoodOpen}
                className={`${BASE_BUTTON_CLASSES} ${BUTTON_STYLES.mood.surface} ${BUTTON_STYLES.mood.ring}`}
              >
                <span aria-hidden="true">😊</span>
                <span className="text-xs font-medium">מצב רוח</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
