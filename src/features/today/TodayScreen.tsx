import { memo, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { WeatherStrip } from '../weather/WeatherStrip'
import { isRunningTimerEvent } from './api'
import { ClockLegend } from './ClockLegend'
import { DayClock } from './DayClock'
import { EstimateBanners } from './EstimateBanners'
import { HeaderMenu } from './HeaderMenu'
import { HistoricalDayView } from './HistoricalDayView'
import { resolveTodayMode } from './historicalDate'
import { QuickLogButtons } from './QuickLogButtons'
import { useDisplayUnit } from './useDisplayUnit'
import { useNowTick } from './useNowTick'
import { useTodayEvents } from './useTodayEvents'
import { useTodayEventsRealtime } from './useTodayEventsRealtime'

/** "יום שלישי, 22 ביולי" - the current day, in device-local terms. */
const headerDateFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

interface TodayHeaderProps {
  childName: string
  onOpenWeek: () => void
  onOpenCompare: () => void
  onOpenSettings: () => void
}

/**
 * Top app bar: the date on the start side, and a child "pill" (avatar + name) on
 * the end side - the entry point for the multi-child switcher (a later slice, so
 * for now it is a static identity). A single menu button at the edge opens the
 * navigation to the Week screen, Day comparison and the Settings hub.
 *
 * Fits down to 320px without horizontal overflow. The date truncates first:
 * it takes only the space the pill and menu button leave, with an ellipsis. The
 * child name is shown in full up to its `max-w-28` cap (a very long name still
 * truncates at the cap). Only if the date is already down to its small
 * `min-w-12` floor (e.g. a large root font size) does the name shrink further,
 * so the header never overflows horizontally.
 */
const TodayHeader = memo(function TodayHeader({
  childName,
  onOpenWeek,
  onOpenCompare,
  onOpenSettings,
}: TodayHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-12 flex-1">
        <p className="truncate text-lg font-semibold text-neutral-900">
          {headerDateFormatter.format(new Date())}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-neutral-0 py-1 pe-2 ps-3 shadow-sm">
          <h1 className="min-w-0 max-w-28 truncate text-sm font-medium text-neutral-800">
            {childName}
          </h1>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base"
            aria-hidden="true"
          >
            👶
          </span>
        </div>

        <HeaderMenu
          onOpenWeek={onOpenWeek}
          onOpenCompare={onOpenCompare}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </header>
  )
})

interface TodayContentProps {
  childId: string
  childName: string
  /** The child's day boundary ('HH:MM', default '00:00'), scoping "today". */
  dayStart: string
  onOpenWeek: () => void
  onOpenCompare: () => void
  onOpenSettings: () => void
}

/**
 * The live "Today" view for a single child: header, the weather/dressing strip
 * (live view only - never on a historical day), the 24-hour clock (hero)
 * fed by the child's events, a color legend, the estimate rows, and the sticky
 * quick-log bar. Split out so `useTodayEvents` only mounts once we have a child.
 */
function TodayContent({
  childId,
  childName,
  dayStart,
  onOpenWeek,
  onOpenCompare,
  onOpenSettings,
}: TodayContentProps) {
  const today = new Date()
  const displayUnit = useDisplayUnit()
  const { data: events, isError, error } = useTodayEvents(childId, dayStart)

  // Live sync: reflect the other parent's logs/edits/deletes without a refresh.
  useTodayEventsRealtime(childId)

  // A single once-a-second tick, shared by the clock and the quick-log bar and
  // live ONLY while an open-ended timer exists. It is the one interval that
  // grows the in-progress arc, its centre/aria readout, and the button
  // stopwatch in lockstep; when nothing runs there is no interval and no tick.
  const hasRunningTimer = useMemo(
    () => (events ?? []).some(isRunningTimerEvent),
    [events],
  )
  const now = useNowTick(hasRunningTimer)

  return (
    <>
      <TodayHeader
        childName={childName}
        onOpenWeek={onOpenWeek}
        onOpenCompare={onOpenCompare}
        onOpenSettings={onOpenSettings}
      />

      <div className="mt-3">
        <WeatherStrip />
      </div>

      {isError && (
        <div className="mt-4">
          <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
        </div>
      )}

      <section className="mt-6 flex flex-col items-center gap-4">
        <DayClock
          events={events ?? []}
          date={today}
          dayStart={dayStart}
          displayUnit={displayUnit}
          now={now}
        />
        <ClockLegend />
      </section>

      <div className="mt-6">
        <EstimateBanners childId={childId} dayStart={dayStart} />
      </div>

      <QuickLogButtons childId={childId} dayStart={dayStart} events={events ?? []} now={now} />
    </>
  )
}

export function TodayScreen() {
  const { data: onboardingState } = useOnboardingStatus()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  if (!onboardingState) return <LoadingScreen />

  const child = onboardingState.firstChild

  // A `date=YYYY-MM-DD` param opens a past day read-only; anything invalid,
  // today, future or pre-creation falls back to the live view (spec §9.1).
  const mode = child
    ? resolveTodayMode(searchParams.get('date'), child.day_start, child.created_at)
    : { kind: 'live' as const }

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-40 pt-6">
      <div className="mx-auto w-full max-w-sm">
        {child ? (
          mode.kind === 'historical' ? (
            <HistoricalDayView
              childId={child.id}
              childName={child.name}
              dayStart={child.day_start}
              createdAtIso={child.created_at}
              dateString={mode.dateString}
            />
          ) : (
            <TodayContent
              childId={child.id}
              childName={child.name}
              dayStart={child.day_start}
              onOpenWeek={() => navigate('/week')}
              onOpenCompare={() => navigate('/compare')}
              onOpenSettings={() => navigate('/settings')}
            />
          )
        ) : (
          <p className="mt-10 text-center text-sm text-neutral-600">לא נמצא/ה ילד/ה במשפחה</p>
        )}
      </div>
    </div>
  )
}
