import { eventColor } from '../today/clock/eventColors'
import {
  describeDaySummary,
  formatDaySummary,
  minutesToPercent,
  type DayComparison,
  type TimelineSegment,
} from './dayComparison'

/** The gentle per-row empty message — a day with nothing logged is not an error. */
const EMPTY_ROW_TEXT = 'אין אירועים ביום זה'

/**
 * Minimum visible length of a segment, so an instant (diaper) or a very short
 * feed still reads as a short line at 320px. Kept equal to the `min-w-2.5`
 * class on the segment so the end-edge clamp below matches it exactly.
 */
const MIN_SEGMENT_CLASS = 'min-w-2.5'
const MIN_SEGMENT_LENGTH = 'calc(var(--spacing) * 2.5)'

interface DayTimelineRowProps {
  /** The row title: "היום", "אתמול", or the full Hebrew date. */
  label: string
  /** The computed segments + summary, or null while the day has no data yet. */
  day: DayComparison | null
  isLoading: boolean
  /** Opens this day in the Today view (live for today, historical otherwise). */
  onOpen: () => void
}

interface SegmentProps {
  segment: TimelineSegment
}

/**
 * One event on the line. Positioned with logical insets, so minute 0 sits at
 * the RTL start (right) edge. The start is clamped so a minimum-length mark
 * near the day's end never spills past the track. A timer still running today
 * keeps a flat leading edge (rounded only at its start), reading as "not
 * finished yet" — the same cue the Today clock gives an ongoing arc.
 */
function Segment({ segment }: SegmentProps) {
  const startPercent = minutesToPercent(segment.startMinutes)
  const lengthPercent = minutesToPercent(segment.endMinutes) - startPercent

  return (
    <span
      className={`absolute inset-y-0 ${MIN_SEGMENT_CLASS} ${
        segment.isOngoing ? 'rounded-s-full' : 'rounded-full'
      }`}
      style={{
        insetInlineStart: `min(${startPercent}%, calc(100% - ${MIN_SEGMENT_LENGTH}))`,
        width: `${lengthPercent}%`,
        backgroundColor: eventColor(segment.type).base,
      }}
    />
  )
}

/**
 * One selected day on the comparison screen: its title, a single 24-hour line
 * (every event the same thickness, types told apart only by color), and a
 * one-line summary that may wrap at 320px but never overflows. The whole row is
 * a tap target that opens the day in the Today view.
 */
export function DayTimelineRow({ label, day, isLoading, onOpen }: DayTimelineRowProps) {
  const summaryText = day
    ? day.hasEvents
      ? formatDaySummary(day)
      : EMPTY_ROW_TEXT
    : isLoading
      ? 'טוען...'
      : ''
  const accessibleSummary = day?.hasEvents ? describeDaySummary(day) : summaryText

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={accessibleSummary ? `${label}: ${accessibleSummary}` : label}
        className="w-full min-w-0 rounded-md px-2 py-2 text-start transition-colors duration-fast hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="block truncate text-sm font-medium text-neutral-900">{label}</span>

        <span className="relative mt-1.5 block h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
          {day?.segments.map((segment) => <Segment key={segment.id} segment={segment} />)}
        </span>

        {summaryText && (
          <span className="mt-1.5 block break-words text-xs tabular-nums text-neutral-600">
            {summaryText}
          </span>
        )}
      </button>
    </li>
  )
}
