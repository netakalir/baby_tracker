import { eventColor } from '../today/clock/eventColors'
import type { DaySummary } from './weekAggregation'
import { formatWeekday } from './weekFormat'

interface WeekSecondaryRowProps {
  days: readonly DaySummary[]
  /** The tallest diaper count across the week, for scaling the mini bars. */
  maxDiaperCount: number
}

/**
 * The secondary-metrics strip (spec §2.4) — deliberately smaller than the two
 * primary charts, for spotting an anomalous day at a glance, not for reading
 * exact values:
 *  - a low diaper mini bar-chart (7 count bars, diaper color);
 *  - a mood row of 7 small squares, each showing the day's dominant emoji.
 * View-only; not tappable, to keep it visually quiet.
 */
export function WeekSecondaryRow({ days, maxDiaperCount }: WeekSecondaryRowProps) {
  const diaper = eventColor('diaper')
  const mood = eventColor('mood')
  const scale = Math.max(maxDiaperCount, 1)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: diaper.base }}
            aria-hidden="true"
          />
          {diaper.label}
        </div>
        <div
          className="flex items-end justify-between gap-1.5"
          role="img"
          aria-label={`החתלות ליום: ${days.map((d) => d.diaperCount).join(', ')}`}
        >
          {days.map((summary) => (
            <div key={summary.day.dateString} className="flex h-8 flex-1 flex-col justify-end">
              {summary.diaperCount > 0 ? (
                <div
                  className="w-full max-w-6 self-center rounded-sm"
                  style={{
                    height: `${(summary.diaperCount / scale) * 100}%`,
                    backgroundColor: diaper.base,
                  }}
                />
              ) : (
                <div className="h-0.5 w-full max-w-6 self-center rounded-full bg-neutral-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: mood.base }}
            aria-hidden="true"
          />
          {mood.label}
        </div>
        <div className="flex items-stretch justify-between gap-1.5">
          {days.map((summary) => (
            <div
              key={summary.day.dateString}
              className="flex aspect-square flex-1 items-center justify-center rounded-sm border border-neutral-200 bg-neutral-50 text-base"
              aria-label={`${formatWeekday(summary.day.date)}: ${
                summary.dominantMood ? 'מצב רוח דומיננטי' : 'אין מצב רוח'
              }`}
            >
              <span aria-hidden={summary.dominantMood ? undefined : true}>
                {summary.dominantMood ?? ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
