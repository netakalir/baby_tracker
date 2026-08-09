import { useMemo } from 'react'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { eventColor } from '../today/clock/eventColors'
import { SettingsHeader } from '../settings/SettingsHeader'
import { WeekChart } from './WeekChart'
import { aggregateWeek } from './weekAggregation'
import { DAYS_IN_WEEK, weekDays } from './weekDate'
import { formatDailyAverageHours } from './weekFormat'
import { useWeekEvents } from './useWeekEvents'

interface SummaryTileProps {
  label: string
  value: string
  /** Event-type accent dot color (a `500` token, via {@link eventColor}). */
  accent: string
}

/** One "daily average" figure with its event-type color dot. */
function SummaryTile({ label, value, accent }: SummaryTileProps) {
  return (
    <div className="flex-1 rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <span className="text-xs text-neutral-600">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  )
}

/** A compact color key tying each bar segment to its Hebrew label. */
function WeekLegend() {
  const sleep = eventColor('sleep')
  const feeding = eventColor('feeding')
  return (
    <ul
      className="flex items-center justify-center gap-x-4 gap-y-1.5"
      aria-label="מקרא צבעים"
    >
      {[sleep, feeding].map(({ base, label }) => (
        <li key={label} className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: base }}
            aria-hidden="true"
          />
          {label}
        </li>
      ))}
    </ul>
  )
}

interface WeekContentProps {
  childId: string
  /** The child's day boundary ('HH:MM', default '00:00'), scoping each day. */
  dayStart: string
}

/**
 * The live "Week" view for a single child: seven-day sleep + feeding totals as a
 * custom stacked bar chart, with daily-average summary tiles above it. Split out
 * so `useWeekEvents` only mounts once we have a child.
 */
function WeekContent({ childId, dayStart }: WeekContentProps) {
  const { data: events, isLoading, isError, error } = useWeekEvents(childId, dayStart)

  const totals = useMemo(
    () => aggregateWeek(events ?? [], weekDays(new Date(), dayStart), dayStart),
    [events, dayStart],
  )

  if (isError) {
    return (
      <div className="mt-6">
        <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
      </div>
    )
  }

  if (isLoading) {
    return <p className="mt-10 text-center text-sm text-neutral-600">טוען...</p>
  }

  return (
    <>
      <div className="mt-6 flex gap-3">
        <SummaryTile
          label="שינה ליום"
          value={formatDailyAverageHours(totals.totalSleepMinutes, DAYS_IN_WEEK)}
          accent={eventColor('sleep').base}
        />
        <SummaryTile
          label="האכלה ליום"
          value={formatDailyAverageHours(totals.totalFeedingMinutes, DAYS_IN_WEEK)}
          accent={eventColor('feeding').base}
        />
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        {totals.isEmpty ? (
          <p className="py-16 text-center text-sm text-neutral-600">
            עדיין אין נתוני שינה או האכלה השבוע
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <WeekChart days={totals.days} maxDayMinutes={totals.maxDayMinutes} />
            <WeekLegend />
          </div>
        )}
      </section>
    </>
  )
}

/**
 * The "Week" screen: a pushed screen reached from the Today header, showing the
 * last seven child-days of sleep and feeding as a polished custom chart
 * ("visual before textual"). A back arrow returns to Today.
 */
export function WeekScreen() {
  const { data: onboardingState } = useOnboardingStatus()

  if (!onboardingState) return <LoadingScreen />

  const child = onboardingState.firstChild

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="שבוע" backTo="/today" />

        {child ? (
          <WeekContent childId={child.id} dayStart={child.day_start} />
        ) : (
          <p className="mt-10 text-center text-sm text-neutral-600">לא נמצא/ה ילד/ה במשפחה</p>
        )}
      </div>
    </div>
  )
}
