import { useId, useMemo } from 'react'
import type { Event } from '../../types/database'
import { clipEventToDay, MINUTES_IN_DAY, type DaySegment } from './clock/dayWindow'
import { eventColor } from './clock/eventColors'
import { minutesToAngle, pointOnCircle, ringArcPath, type Point } from './clock/geometry'
import { formatIsraelTime } from './clock/timeFormat'

interface DayClockProps {
  /** Events for the displayed day (from `src/types/database.ts`). */
  events: Event[]
  /** The day being displayed, in Israel local terms (used for midnight-crossing math). */
  date: Date
  /** Optional: called when an existing arc/marker is clicked. */
  onArcClick?: (event: Event) => void
}

/** A drawable event: the source event plus its clipped in-day segment. */
interface ClockSegment {
  readonly event: Event
  readonly segment: DaySegment
}

// --- Dimensions (viewBox units; the SVG scales responsively via CSS). ---
const VIEWBOX_SIZE = 240
const CENTER: Point = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 }
const OUTER_RADIUS = 104
const INNER_RADIUS = 74
const TRACK_STROKE = OUTER_RADIUS - INNER_RADIUS
const TRACK_RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2
const POINT_MARKER_RADIUS = 6
const TICK_INNER = OUTER_RADIUS + 4
const TICK_OUTER = OUTER_RADIUS + 9

const EMPTY_STATE_TEXT = 'עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל'

/** Hour labels drawn around the dial. Every 6 hours keeps it uncluttered. */
const HOUR_TICKS = [0, 6, 12, 18] as const

function toClockSegments(events: Event[], date: Date): ClockSegment[] {
  return events
    .map((event) => {
      const segment = clipEventToDay(event.start_time, event.end_time, date)
      return segment ? { event, segment } : null
    })
    .filter((entry): entry is ClockSegment => entry !== null)
}

function ariaLabelFor(event: Event, segment: DaySegment): string {
  const { label } = eventColor(event.type)
  if (segment.isPointInTime || event.end_time === null) {
    return `${label} בשעה ${formatIsraelTime(event.start_time)}`
  }
  return `${label} מ-${formatIsraelTime(event.start_time)} עד ${formatIsraelTime(event.end_time)}`
}

export function DayClock({ events, date, onArcClick }: DayClockProps) {
  // useId gives stable, collision-free ids so multiple clocks can coexist on a page.
  const idPrefix = useId()

  const segments = useMemo(() => toClockSegments(events, date), [events, date])
  const isEmpty = segments.length === 0

  const handleActivate = (event: Event) => {
    onArcClick?.(event)
  }

  const animationName = `${idPrefix}-clock-enter`.replace(/[^a-zA-Z0-9_-]/g, '')

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="h-auto w-full max-w-xs"
        role="img"
        aria-label="שעון 24 שעות של אירועי היום"
      >
        {/* Single, subtle entrance animation only (design-system: functional, <=200ms). */}
        <style>{`
          @keyframes ${animationName} {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
          }
          @media (prefers-reduced-motion: no-preference) {
            .${animationName} {
              transform-box: fill-box;
              transform-origin: center;
              animation: ${animationName} 200ms ease-out both;
            }
          }
        `}</style>

        <defs>
          {segments.map(({ event }, index) => {
            const color = eventColor(event.type)
            return (
              <linearGradient
                key={`${idPrefix}-grad-${index}`}
                id={`${idPrefix}-grad-${index}`}
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor={color.light} />
                <stop offset="100%" stopColor={color.base} />
              </linearGradient>
            )
          })}
        </defs>

        <g className={animationName}>
          {/* Neutral background track (also the empty-state ring). */}
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={TRACK_RADIUS}
            fill="none"
            stroke="var(--color-neutral-200)"
            strokeWidth={TRACK_STROKE}
          />

          {/* Hour ticks + labels (00 at bottom, 12 at top). */}
          {HOUR_TICKS.map((hour) => {
            const angle = minutesToAngle((hour / 24) * MINUTES_IN_DAY)
            const tickStart = pointOnCircle(CENTER, TICK_INNER, angle)
            const tickEnd = pointOnCircle(CENTER, TICK_OUTER, angle)
            const labelPoint = pointOnCircle(CENTER, TICK_OUTER + 7, angle)
            return (
              <g key={`tick-${hour}`}>
                <line
                  x1={tickStart.x}
                  y1={tickStart.y}
                  x2={tickEnd.x}
                  y2={tickEnd.y}
                  stroke="var(--color-neutral-400)"
                  strokeWidth={1}
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  fill="var(--color-neutral-600)"
                  fontSize={9}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {String(hour).padStart(2, '0')}
                </text>
              </g>
            )
          })}

          {/* Event segments: arcs for durations, dots for point-in-time events. */}
          {segments.map(({ event, segment }, index) => {
            const color = eventColor(event.type)
            const label = ariaLabelFor(event, segment)
            const clickable = onArcClick !== undefined

            if (segment.isPointInTime) {
              const angle = minutesToAngle(segment.startMinutes)
              const dot = pointOnCircle(CENTER, TRACK_RADIUS, angle)
              return (
                <circle
                  key={event.id}
                  cx={dot.x}
                  cy={dot.y}
                  r={POINT_MARKER_RADIUS}
                  fill={color.base}
                  stroke="var(--color-neutral-0)"
                  strokeWidth={1.5}
                  role={clickable ? 'button' : 'img'}
                  aria-label={label}
                  tabIndex={clickable ? 0 : undefined}
                  className={clickable ? 'cursor-pointer' : undefined}
                  onClick={clickable ? () => handleActivate(event) : undefined}
                  onKeyDown={
                    clickable
                      ? (keyboardEvent) => {
                          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                            keyboardEvent.preventDefault()
                            handleActivate(event)
                          }
                        }
                      : undefined
                  }
                />
              )
            }

            const path = ringArcPath(
              CENTER,
              INNER_RADIUS,
              OUTER_RADIUS,
              segment.startMinutes,
              segment.endMinutes,
            )
            return (
              <path
                key={event.id}
                d={path}
                fill={`url(#${idPrefix}-grad-${index})`}
                stroke="var(--color-neutral-0)"
                strokeWidth={0.75}
                role={clickable ? 'button' : 'img'}
                aria-label={label}
                tabIndex={clickable ? 0 : undefined}
                className={clickable ? 'cursor-pointer' : undefined}
                onClick={clickable ? () => handleActivate(event) : undefined}
                onKeyDown={
                  clickable
                    ? (keyboardEvent) => {
                        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                          keyboardEvent.preventDefault()
                          handleActivate(event)
                        }
                      }
                    : undefined
                }
              />
            )
          })}
        </g>
      </svg>

      {isEmpty && (
        <p className="max-w-xs text-center text-sm text-neutral-600">{EMPTY_STATE_TEXT}</p>
      )}
    </div>
  )
}
