import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { ClockLegend } from './ClockLegend'
import { DayClock } from './DayClock'
import { QuickLogButtons } from './QuickLogButtons'
import {
  canGoToPrevDay,
  nextDateString,
  nextDayIsLive,
  prevDateString,
} from './historicalDate'
import { deviceDayStartOnDate } from './todayDate'
import { useDayEvents } from './useTodayEvents'

/** "יום שלישי, 18 ביוני" for a `YYYY-MM-DD` date, formatted from a noon-UTC instant. */
const historicalDateFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** The empty-past-day message (§9.4) — gentle, never an error. */
const EMPTY_HISTORICAL_TEXT = 'אין אירועים ביום זה'

function formatHistoricalTitle(dateString: string): string {
  return historicalDateFormatter.format(new Date(`${dateString}T12:00:00Z`))
}

interface DayNavProps {
  title: string
  canPrev: boolean
  onPrev: () => void
  onNext: () => void
}

/**
 * The day navigator for the historical view: a chevron to the earlier/later day
 * on each side and the historical date between them. Backward is clamped at the
 * child's creation day (the button disables); forward is always allowed and
 * returns to the live view once it reaches the current day (§9.5).
 */
function DayNav({ title, canPrev, onPrev, onNext }: DayNavProps) {
  const arrowClass =
    'flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-30'

  return (
    <div className="flex items-center justify-between gap-2">
      {/* RTL: the earlier day sits at the start (right) edge; its chevron points to the start. */}
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="יום קודם" className={arrowClass}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <p className="truncate text-sm font-medium text-neutral-900">{title}</p>

      <button type="button" onClick={onNext} aria-label="יום הבא" className={arrowClass}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

interface HistoricalHeaderProps {
  childName: string
  onBack: () => void
}

/**
 * Top bar of the historical view: a back arrow that returns to the Week screen
 * (where the day was picked, §9.5) and the child identity pill, mirroring the
 * live header's identity affordance without the live-only week/settings icons.
 */
function HistoricalHeader({ childName, onBack }: HistoricalHeaderProps) {
  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="חזרה"
        className="-ms-2 flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {/* RTL: the "back" chevron points to the start (right) edge. */}
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex flex-1 items-center justify-end">
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-0 py-1 pe-2 ps-3 shadow-sm">
          <h1 className="max-w-28 truncate text-sm font-medium text-neutral-800">{childName}</h1>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-base"
            aria-hidden="true"
          >
            👶
          </span>
        </div>
      </div>
    </header>
  )
}

interface HistoricalDayViewProps {
  childId: string
  childName: string
  /** The child's day boundary ('HH:MM', default '00:00'), scoping the selected day. */
  dayStart: string
  /** The child's `created_at` (ISO), the backward navigation floor. */
  createdAtIso: string
  /** The device-local calendar date (`YYYY-MM-DD`) being shown. */
  dateString: string
}

/**
 * The historical ("past day") Today view (spec §9): the same clock, legend and
 * quick-log bar as the live screen, but read-only. The entire data chain is
 * anchored on `dateString` rather than "now": events are fetched for that day's
 * window, the clock clips them to it, logging buttons are neutralised, and the
 * estimate banners are omitted entirely (a past day has no future to predict).
 */
export function HistoricalDayView({
  childId,
  childName,
  dayStart,
  createdAtIso,
  dateString,
}: HistoricalDayViewProps) {
  const navigate = useNavigate()
  const { data: events, isError, error } = useDayEvents(childId, dateString, dayStart)

  // An instant inside the selected child-day, for the clock's boundary math.
  const displayedDate = deviceDayStartOnDate(dateString, dayStart)
  const canPrev = canGoToPrevDay(dateString, createdAtIso, dayStart)

  function handlePrev() {
    navigate(`/today?date=${prevDateString(dateString)}`)
  }

  function handleNext() {
    // Reaching the current day returns to the live view (no "historical today").
    if (nextDayIsLive(dateString, dayStart)) {
      navigate('/today')
      return
    }
    navigate(`/today?date=${nextDateString(dateString)}`)
  }

  return (
    <>
      <HistoricalHeader childName={childName} onBack={() => navigate('/week')} />

      <div className="mt-4">
        <DayNav
          title={formatHistoricalTitle(dateString)}
          canPrev={canPrev}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      {isError && (
        <div className="mt-4">
          <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
        </div>
      )}

      <section className="mt-6 flex flex-col items-center gap-4">
        <DayClock
          events={events ?? []}
          date={displayedDate}
          dayStart={dayStart}
          readOnly
          emptyStateText={EMPTY_HISTORICAL_TEXT}
        />
        <ClockLegend />
      </section>

      {/* Estimate banners are intentionally omitted in historical mode (§9.3). */}

      <QuickLogButtons childId={childId} events={events ?? []} disabled />
    </>
  )
}
