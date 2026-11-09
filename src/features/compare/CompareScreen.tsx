import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '../../components/ui/Banner'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { toFriendlyDbErrorMessage } from '../../lib/errorMessages'
import { useOnboardingStatus } from '../onboarding/useOnboardingStatus'
import { SettingsHeader } from '../settings/SettingsHeader'
import { isRunningTimerEvent } from '../today/api'
import { ClockLegend } from '../today/ClockLegend'
import { currentChildDateString } from '../today/todayDate'
import { useNowTick } from '../today/useNowTick'
import {
  defaultSelectedDates,
  formatRowLabel,
  selectableDates,
  toggleDate,
} from './compareDate'
import { DayChips } from './DayChips'
import { buildDayComparison, type TimelineEventType } from './dayComparison'
import { DayTimelineRow } from './DayTimelineRow'
import { TimelineAxis } from './TimelineAxis'
import { useCompareDays } from './useCompareDays'

/** The legend lists only the types drawn here — mood is not shown on this screen. */
const LEGEND_TYPES: readonly TimelineEventType[] = ['sleep', 'feeding', 'diaper']

interface CompareContentProps {
  childId: string
  createdAtIso: string
  /** The child's day boundary ('HH:MM', default '00:00'), scoping each day. */
  dayStart: string
  /** The explicit selection, or null for the default (today + yesterday). */
  selected: readonly string[] | null
  onSelectedChange: (selected: string[]) => void
}

/**
 * The live comparison: the day chips, then one 24-hour line per selected day
 * (newest first) under a shared hour axis. Each day is its own cached query, so
 * toggling a chip fetches only the day it adds.
 */
function CompareContent({
  childId,
  createdAtIso,
  dayStart,
  selected,
  onSelectedChange,
}: CompareContentProps) {
  const navigate = useNavigate()
  const todayString = currentChildDateString(new Date(), dayStart)
  const dates = selectableDates(createdAtIso, dayStart)
  // Drop any selected day that left the 14-day range (e.g. after midnight).
  const selectedDates = (selected ?? defaultSelectedDates(dates)).filter((date) =>
    dates.includes(date),
  )
  const rowDates = [...selectedDates].reverse()

  const { days, error } = useCompareDays(childId, rowDates, dayStart)

  // Tick once a second only while a timer runs today, so its line grows live.
  const todayEvents = days.find((day) => day.dateString === todayString)?.events
  const now = useNowTick(todayEvents?.some(isRunningTimerEvent) ?? false)

  // Cheap pure math over a handful of days, so it is simply recomputed per render.
  const rows = days.map((day) => ({
    ...day,
    comparison: day.events
      ? buildDayComparison(day.events, day.dateString, dayStart, {
          isToday: day.dateString === todayString,
          now: new Date(now),
        })
      : null,
  }))

  // Today opens the live Today view (no param); a past day opens it in
  // historical mode via `?date=` — the same routing the Week chart uses.
  const handleOpen = (dateString: string) => {
    navigate(dateString === todayString ? '/today' : `/today?date=${dateString}`)
  }

  return (
    <>
      <div className="mt-4">
        <DayChips
          dates={dates}
          selected={selectedDates}
          todayString={todayString}
          onToggle={(dateString) => onSelectedChange(toggleDate(selectedDates, dateString, dates))}
        />
      </div>

      {error !== null && (
        <div className="mt-4">
          <Banner message={toFriendlyDbErrorMessage(error)} variant="error" />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-neutral-600">יש לבחור לפחות יום אחד להשוואה</p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <section className="rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm">
            <div className="px-2">
              <TimelineAxis dayStart={dayStart} />
            </div>
            <ul aria-label="ימים להשוואה" className="mt-1 flex flex-col gap-1">
              {rows.map((row) => (
                <DayTimelineRow
                  key={row.dateString}
                  label={formatRowLabel(row.dateString, todayString)}
                  day={row.comparison}
                  isLoading={row.isLoading}
                  onOpen={() => handleOpen(row.dateString)}
                />
              ))}
            </ul>
          </section>

          <ClockLegend types={LEGEND_TYPES} />
        </div>
      )}
    </>
  )
}

/**
 * The "Day comparison" screen: a pushed screen reached from the Week screen.
 * Pick any number of the last 14 days and see each as a horizontal 24-hour
 * line — sleep, feeding and diapers in their usual colors — stacked for an
 * at-a-glance comparison. The selection lives here so it survives data reloads.
 */
export function CompareScreen() {
  const { data: onboardingState } = useOnboardingStatus()
  const [selected, setSelected] = useState<string[] | null>(null)

  if (!onboardingState) return <LoadingScreen />

  const child = onboardingState.firstChild

  return (
    <div className="min-h-screen bg-neutral-50 px-5 pb-16 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <SettingsHeader title="השוואת ימים" backTo="/week" />

        {child ? (
          <CompareContent
            childId={child.id}
            createdAtIso={child.created_at}
            dayStart={child.day_start}
            selected={selected}
            onSelectedChange={setSelected}
          />
        ) : (
          <p className="mt-10 text-center text-sm text-neutral-600">לא נמצא/ה ילד/ה במשפחה</p>
        )}
      </div>
    </div>
  )
}
