import { useEffect, useState } from 'react'
import { eventColor } from '../today/clock/eventColors'
import type { DayTotals } from './weekAggregation'
import { formatDayOfMonth, formatHoursShort, formatWeekday } from './weekFormat'

interface WeekChartProps {
  days: readonly DayTotals[]
  /** The tallest day's (sleep + feeding) total, used to scale every bar. */
  maxDayMinutes: number
}

/** Vertical gradient (light `300` top → solid `500` bottom) for a bar segment. */
function barGradient(type: 'sleep' | 'feeding'): string {
  const { base, light } = eventColor(type)
  return `linear-gradient(to bottom, ${light}, ${base})`
}

/**
 * A custom stacked bar chart of the week's sleep + feeding hours — one column
 * per child-day (oldest at the start edge, today at the end, RTL-natural). Each
 * bar splits into a blue sleep segment (bottom) and an orange feeding segment
 * (top), reusing the app's event-type colors so the chart reads the same as the
 * clock. Hand-built with CSS rather than a chart library, matching the clock's
 * bespoke look. A single brief grow-in on mount is the only animation.
 */
export function WeekChart({ days, maxDayMinutes }: WeekChartProps) {
  const [grown, setGrown] = useState(false)

  // One-shot entrance: bars grow from the baseline once, right after mount.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const scaleMinutes = Math.max(maxDayMinutes, 1)

  return (
    <div className="flex items-stretch justify-between gap-1.5">
      {days.map(({ day, sleepMinutes, feedingMinutes }) => {
        const dayMinutes = sleepMinutes + feedingMinutes
        const heightPct = grown ? (dayMinutes / scaleMinutes) * 100 : 0
        const label = formatHoursShort(dayMinutes)

        return (
          <div key={day.dateString} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="h-4 text-xs tabular-nums text-neutral-600">{label}</span>

            <div
              className="flex h-44 w-full flex-col justify-end"
              role="img"
              aria-label={`${formatWeekday(day.date)} ${formatDayOfMonth(day.date)}: ${
                label ? `${label} שעות` : 'ללא נתונים'
              }`}
            >
              <div
                className="flex w-full max-w-8 flex-col self-center overflow-hidden rounded-md transition-[height] duration-base ease-out"
                style={{ height: `${heightPct}%` }}
              >
                {feedingMinutes > 0 && (
                  <div
                    style={{ flexGrow: feedingMinutes, backgroundImage: barGradient('feeding') }}
                  />
                )}
                {sleepMinutes > 0 && (
                  <div style={{ flexGrow: sleepMinutes, backgroundImage: barGradient('sleep') }} />
                )}
              </div>
            </div>

            <div className="flex flex-col items-center leading-tight">
              <span
                className={`text-xs ${
                  day.isToday ? 'font-semibold text-brand-600' : 'font-medium text-neutral-800'
                }`}
              >
                {formatWeekday(day.date)}
              </span>
              <span className="text-xs tabular-nums text-neutral-400">
                {formatDayOfMonth(day.date)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
