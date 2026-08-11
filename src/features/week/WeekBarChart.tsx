import { useEffect, useState } from 'react'
import { eventColor } from '../today/clock/eventColors'
import type { DaySummary } from './weekAggregation'
import type { WeekDay } from './weekDate'
import { formatDayOfMonth, formatWeekday } from './weekFormat'

interface WeekBarChartProps {
  days: readonly DaySummary[]
  /** Event-type color channel — matches the Today clock/button colors. */
  channel: 'sleep' | 'feeding'
  /** The plotted value for a day (sleep minutes, or feeding count). */
  getValue: (summary: DaySummary) => number
  /** Short label shown above a bar (empty string hides it). */
  getLabel: (summary: DaySummary) => string
  /** Accessible description of a day's value (e.g. "12 שעות שינה"). */
  getValueText: (summary: DaySummary) => string
  /** The tallest value across the week, used to scale every bar. */
  max: number
  /**
   * Navigate to that day's Today view; not called for future days. Optional:
   * when omitted, columns render as non-interactive elements (no button, no
   * hover/focus affordance). This is the temporary state until historical-mode
   * Today ships — a clickable column that lands on the *live* day would be a
   * data-safety trap (accidental logging under a past date). See
   * screen-today-spec.md §9.
   */
  onDaySelect?: (day: WeekDay) => void
}

/** Vertical gradient (light `300` top → solid `500` bottom) for a bar. */
function barGradient(channel: 'sleep' | 'feeding'): string {
  const { base, light } = eventColor(channel)
  return `linear-gradient(to bottom, ${light}, ${base})`
}

/**
 * One primary weekly bar chart: seven day columns (Sunday first; RTL-natural,
 * so Sunday sits at the start edge), each a tappable target that opens that
 * day's Today view. A day with no data at all shows a faint gray track instead
 * of a zero-height bar, so it never implies "zero" (spec §6). Hand-built with
 * CSS rather than a chart library, reusing the app's event-type colors so the
 * channel reads identically to the clock. A single brief grow-in on mount is
 * the only animation.
 */
export function WeekBarChart({
  days,
  channel,
  getValue,
  getLabel,
  getValueText,
  max,
  onDaySelect,
}: WeekBarChartProps) {
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const scale = Math.max(max, 1)

  return (
    <div className="flex items-stretch justify-between gap-1.5">
      {days.map((summary) => {
        const { day } = summary
        const value = getValue(summary)
        const heightPct = grown && summary.hasData ? (value / scale) * 100 : 0
        const label = getLabel(summary)

        const weekdayLabel = (
          <span
            className={`text-xs ${
              day.isToday ? 'font-semibold text-brand-600' : 'font-medium text-neutral-800'
            }`}
          >
            {formatWeekday(day.date)}
          </span>
        )

        const column = (
          <>
            <span className="h-4 text-xs tabular-nums text-neutral-600">{label}</span>

            <div className="flex h-40 w-full flex-col justify-end">
              {summary.hasData ? (
                <div
                  className="w-full max-w-8 self-center rounded-md transition-[height] duration-base ease-out"
                  style={{ height: `${heightPct}%`, backgroundImage: barGradient(channel) }}
                />
              ) : (
                // No data at all: a short, flat gray track — never a "0" bar.
                <div className="h-1.5 w-full max-w-8 self-center rounded-full bg-neutral-200" />
              )}
            </div>

            <div className="flex flex-col items-center leading-tight">
              {weekdayLabel}
              <span className="text-xs tabular-nums text-neutral-400">
                {formatDayOfMonth(day.date)}
              </span>
            </div>
          </>
        )

        // Non-interactive until historical-mode Today ships (see prop docs).
        if (!onDaySelect) {
          return (
            <div
              key={day.dateString}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md py-1"
            >
              {column}
            </div>
          )
        }

        return (
          <button
            key={day.dateString}
            type="button"
            disabled={day.isFuture}
            onClick={() => onDaySelect(day)}
            aria-label={`${formatWeekday(day.date)} ${formatDayOfMonth(day.date)}: ${getValueText(summary)}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md py-1 transition-colors duration-fast hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-40"
          >
            {column}
          </button>
        )
      })}
    </div>
  )
}
