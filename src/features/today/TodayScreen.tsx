import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { ClockLegend } from './ClockLegend'
import { DayClock } from './DayClock'
import { EstimateBanners } from './EstimateBanners'
import { QuickLogButtons } from './QuickLogButtons'
import { useTodayEvents } from './useTodayEvents'
import { useTodayEventsRealtime } from './useTodayEventsRealtime'

/** "יום שלישי, 22 ביולי" - the current day, in Israel-local terms. */
const headerDateFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

interface TodayHeaderProps {
  childName: string
  onOpenWeek: () => void
  onOpenSettings: () => void
}

/**
 * Top app bar: the date on the start side, and a child "pill" (avatar + name) on
 * the end side - the entry point for the multi-child switcher (a later slice, so
 * for now it is a static identity). A week-chart icon and a settings gear sit as
 * compact icons at the edge, pushing the Week screen and the Settings hub.
 */
function TodayHeader({ childName, onOpenWeek, onOpenSettings }: TodayHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-neutral-900">
          {headerDateFormatter.format(new Date())}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-0 py-1 pe-2 ps-3 shadow-sm">
          <h1 className="max-w-28 truncate text-sm font-medium text-neutral-800">
            {childName}
          </h1>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-base"
            aria-hidden="true"
          >
            👶
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenWeek}
          aria-label="שבוע"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M4 20V10M10 20V4M16 20v-7M4 20h16"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="הגדרות"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}

interface TodayContentProps {
  childId: string
  childName: string
  /** The child's day boundary ('HH:MM', default '00:00'), scoping "today". */
  dayStart: string
  onOpenWeek: () => void
  onOpenSettings: () => void
}

/**
 * The live "Today" view for a single child: header, the 24-hour clock (hero)
 * fed by the child's events, a color legend, the estimate rows, and the sticky
 * quick-log bar. Split out so `useTodayEvents` only mounts once we have a child.
 */
function TodayContent({ childId, childName, dayStart, onOpenWeek, onOpenSettings }: TodayContentProps) {
  const today = new Date()
  const { data: events, isError, error } = useTodayEvents(childId, dayStart)

  // Live sync: reflect the other parent's logs/edits/deletes without a refresh.
  useTodayEventsRealtime(childId)

  return (
    <>
      <TodayHeader childName={childName} onOpenWeek={onOpenWeek} onOpenSettings={onOpenSettings} />

      {isError && (
        <div className="mt-4">
          <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
        </div>
      )}

      <section className="mt-6 flex flex-col items-center gap-4">
        <DayClock events={events ?? []} date={today} dayStart={dayStart} />
        <ClockLegend />
      </section>

      <div className="mt-6">
        <EstimateBanners childId={childId} dayStart={dayStart} />
      </div>

      <QuickLogButtons childId={childId} events={events ?? []} />
    </>
  )
}

export function TodayScreen() {
  const { data: onboardingState } = useOnboardingStatus()
  const navigate = useNavigate()

  if (!onboardingState) return <LoadingScreen />

  const child = onboardingState.firstChild

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-40 pt-6">
      <div className="mx-auto w-full max-w-sm">
        {child ? (
          <TodayContent
            childId={child.id}
            childName={child.name}
            dayStart={child.day_start}
            onOpenWeek={() => navigate('/week')}
            onOpenSettings={() => navigate('/settings')}
          />
        ) : (
          <p className="mt-10 text-center text-sm text-neutral-600">לא נמצא/ה ילד/ה במשפחה</p>
        )}
      </div>
    </div>
  )
}
