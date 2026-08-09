import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { eventColor } from '../today/clock/eventColors'
import { SettingsHeader } from '../settings/SettingsHeader'
import { WeekBarChart } from './WeekBarChart'
import { WeekSecondaryRow } from './WeekSecondaryRow'
import { aggregateWeek } from './weekAggregation'
import {
  canGoToNextWeek,
  canGoToPrevWeek,
  currentChildDateString,
  currentWeekSunday,
  shiftWeekSunday,
  weekBounds,
  weekDaysForSunday,
  weekRangeLabel,
  type WeekDay,
} from './weekDate'
import { formatAverageSleep, formatHoursShort } from './weekFormat'
import { useWeekEvents } from './useWeekEvents'

interface WeekNavProps {
  rangeLabel: string
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

/**
 * The week navigator: a chevron for the earlier/later week on each side and the
 * displayed date range between them. Forward is capped at the current week and
 * backward at the child's creation week (buttons disable at the limits).
 */
function WeekNav({ rangeLabel, canPrev, canNext, onPrev, onNext }: WeekNavProps) {
  const arrowClass =
    'flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-30'

  return (
    <div className="flex items-center justify-between gap-2">
      {/* RTL: the earlier week sits at the start (right) edge; its chevron
          points to the start. */}
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="שבוע קודם" className={arrowClass}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <p className="text-sm font-medium tabular-nums text-neutral-900">{rangeLabel}</p>

      <button type="button" onClick={onNext} disabled={!canNext} aria-label="שבוע הבא" className={arrowClass}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

interface WeekContentProps {
  childId: string
  createdAtIso: string
  /** The child's day boundary ('HH:MM', default '00:00'), scoping each day. */
  dayStart: string
  /** The selected week's Sunday anchor, kept in the parent so it survives child change. */
  sunday: string
  onWeekChange: (sunday: string) => void
}

interface ChartCardProps {
  title: string
  accent: string
  children: React.ReactNode
}

/** A titled surface wrapping one chart, matching the app's card rhythm. */
function ChartCard({ title, accent, children }: ChartCardProps) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

/**
 * The live week view: navigator + two primary charts (sleep hours, feeding
 * count), a secondary diaper/mood strip, and a one-line summary. Only this
 * subtree re-queries when the week changes, so navigation reloads data, not the
 * whole screen.
 */
function WeekContent({ childId, createdAtIso, dayStart, sunday, onWeekChange }: WeekContentProps) {
  const navigate = useNavigate()
  const { data: events, isLoading, isError, error } = useWeekEvents(childId, sunday, dayStart)

  const summary = useMemo(() => {
    const days = weekDaysForSunday(sunday, dayStart)
    const { endIso } = weekBounds(sunday, dayStart)
    return aggregateWeek(events ?? [], days, endIso, dayStart)
  }, [events, sunday, dayStart])

  const handleDaySelect = (day: WeekDay) => {
    // A past day opens Today in historical mode via a date param; the current
    // day opens plain Today. NOTE: historical Today is not built yet — see the
    // handover summary. Today currently ignores the param and shows the live day.
    const todayString = currentChildDateString(new Date(), dayStart)
    navigate(day.dateString === todayString ? '/today' : `/today?date=${day.dateString}`)
  }

  const canPrev = canGoToPrevWeek(sunday, createdAtIso, dayStart)
  const canNext = canGoToNextWeek(sunday, new Date(), dayStart)

  return (
    <>
      <div className="mt-4">
        <WeekNav
          rangeLabel={weekRangeLabel(sunday)}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => onWeekChange(shiftWeekSunday(sunday, -1))}
          onNext={() => onWeekChange(shiftWeekSunday(sunday, 1))}
        />
      </div>

      {isError && (
        <div className="mt-4">
          <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
        </div>
      )}

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-neutral-600">טוען...</p>
      ) : summary.isEmpty ? (
        <p className="mt-16 text-center text-sm text-neutral-600">
          עדיין אין מספיק נתונים לשבוע הזה
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <ChartCard title="שינה" accent={eventColor('sleep').base}>
            <WeekBarChart
              days={summary.days}
              channel="sleep"
              max={summary.maxSleepMinutes}
              getValue={(day) => day.sleepMinutes}
              getLabel={(day) => formatHoursShort(day.sleepMinutes)}
              getValueText={(day) =>
                day.hasData ? `${formatHoursShort(day.sleepMinutes) || '0'} שעות שינה` : 'אין נתונים'
              }
              onDaySelect={handleDaySelect}
            />
          </ChartCard>

          <ChartCard title="האכלות" accent={eventColor('feeding').base}>
            <WeekBarChart
              days={summary.days}
              channel="feeding"
              max={summary.maxFeedingCount}
              getValue={(day) => day.feedingCount}
              getLabel={(day) => (day.feedingCount > 0 ? String(day.feedingCount) : '')}
              getValueText={(day) => (day.hasData ? `${day.feedingCount} האכלות` : 'אין נתונים')}
              onDaySelect={handleDaySelect}
            />
          </ChartCard>

          <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
            <WeekSecondaryRow days={summary.days} maxDiaperCount={summary.maxDiaperCount} />
          </section>

          <p className="text-center text-sm text-neutral-600">
            ממוצע שינה: {formatAverageSleep(summary.avgSleepMinutes, !summary.isEmpty)} · סך האכלות:{' '}
            {summary.totalFeedings}
          </p>
        </div>
      )}
    </>
  )
}

/**
 * The "Week" screen: a pushed screen reached from the Today header, showing one
 * Sunday–Saturday calendar week of sleep, feeding, diaper and mood as polished
 * custom charts ("visual before textual"). The selected week lives in state so
 * it survives data reloads and child switches; a back arrow returns to Today.
 */
export function WeekScreen() {
  const { data: onboardingState } = useOnboardingStatus()
  const [sunday, setSunday] = useState<string | null>(null)

  if (!onboardingState) return <LoadingScreen />

  const child = onboardingState.firstChild
  // Default to the current week on first render; keep it across child changes.
  const selectedSunday = sunday ?? currentWeekSunday(new Date(), child?.day_start ?? '00:00')

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="שבוע" backTo="/today" />

        {child ? (
          <WeekContent
            childId={child.id}
            createdAtIso={child.created_at}
            dayStart={child.day_start}
            sunday={selectedSunday}
            onWeekChange={setSunday}
          />
        ) : (
          <p className="mt-10 text-center text-sm text-neutral-600">לא נמצא/ה ילד/ה במשפחה</p>
        )}
      </div>
    </div>
  )
}
