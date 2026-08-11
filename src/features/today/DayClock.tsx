import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import type { Event, EventType } from '../../types/database'
import { clipEventToDay, type DaySegment } from './clock/dayWindow'
import { eventColor } from './clock/eventColors'
import { minutesToAngle, pointOnCircle, strokeArcPath, type Point } from './clock/geometry'
import { RING_ORDER, RING_STROKE, RINGS, ringRadius } from './clock/rings'
import { formatDuration, formatIsraelTime } from './clock/timeFormat'
import { feedingDetailLabel } from './feedingChoice'
import { parseDayStartMinutes } from './todayDate'

interface DayClockProps {
  /** Events for the displayed day (from `src/types/database.ts`). */
  events: Event[]
  /** The day being displayed, in device-local terms (used for boundary-crossing math). */
  date: Date
  /**
   * The child's `day_start` ('HH:MM', default '00:00'). The dial's top (minute 0)
   * is this wall-clock time, so the ring spans the child's day rather than a
   * fixed calendar midnight.
   */
  dayStart?: string
  /** Optional: called when an existing arc/marker is clicked. */
  onArcClick?: (event: Event) => void
  /**
   * Read-only (historical) mode: a still-running timer event (no `end_time`) is
   * NOT extended to "now" — there is no live elapsed time on a past day (spec
   * §9.2). It renders from its stored data only, as a point on its ring.
   */
  readOnly?: boolean
  /** Message shown when the day has no events at all (overrides the live copy). */
  emptyStateText?: string
}

// --- Dimensions (viewBox units; the SVG scales responsively via CSS). ---
const VIEWBOX_SIZE = 300
const CENTER: Point = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 }
/**
 * Breathing room around the dial. The outermost halo (radius 158 from a centre
 * at 150) and the hour labels both extend past the 0..300 box; without this
 * margin the viewBox clips them - the left "18:00" label lost its leading "1".
 */
const VIEW_MARGIN = 20
const VIEWBOX = `${-VIEW_MARGIN} ${-VIEW_MARGIN} ${VIEWBOX_SIZE + VIEW_MARGIN * 2} ${VIEWBOX_SIZE + VIEW_MARGIN * 2}`
/** The white dial face the rings sit on. */
const FACE_RADIUS = 120
/** Hour ticks straddle the face edge; hour labels sit outside it. */
const TICK_OUTER_RADIUS = 126
const TICK_MINOR_LENGTH = 6
const TICK_MAJOR_LENGTH = 12
const LABEL_RADIUS = 139
/** Soft concentric halos behind the face - depth only, no motion. */
const HALO_RADII = [132, 144, 143 + 15] as const
/** Marker for an instantaneous event, drawn centred on its ring. */
const POINT_DOT_RADIUS = 5.5

const EMPTY_STATE_TEXT = 'עדיין אין נתונים היום - לחץ על אחד הכפתורים כדי להתחיל'

/**
 * Event types logged as a start/stop timer. While such an event is still running
 * (`end_time === null`) its arc is drawn up to "now" instead of collapsing to a
 * dot, so an in-progress sleep is visible on the dial. Every other type is a
 * single instantaneous tap and is genuinely a point in time.
 */
const TIMER_TYPES: ReadonlySet<EventType> = new Set<EventType>(['sleep', 'feeding'])

interface Drawable {
  readonly event: Event
  readonly segment: DaySegment
  /** True while a timer event is still running (drawn with an open end cap). */
  readonly isOngoing: boolean
}

interface EventDescription {
  /** The event-type name (e.g. "שינה"). */
  readonly label: string
  /** Short detail lines, kept narrow to fit inside the dial's hollow centre. */
  readonly lines: readonly string[]
}

/**
 * The event-type label, enriched for feeding with its breast/bottle detail
 * (e.g. "האכלה · הנקה · ימין"). Feeding stays one type/color; the split is a
 * metadata detail surfaced only in the label.
 */
function eventLabel(event: Event): string {
  const { label } = eventColor(event.type)
  if (event.type !== 'feeding') return label
  const detail = feedingDetailLabel(event.metadata)
  return detail ? `${label} · ${detail}` : label
}

/** Structured, human-readable summary of an event: its type and time details. */
function describeEvent({ event, segment, isOngoing }: Drawable): EventDescription {
  const label = eventLabel(event)
  if (isOngoing) {
    const elapsed = formatDuration(event.start_time, new Date().toISOString())
    return { label, lines: [`מ-${formatIsraelTime(event.start_time)}`, `בתהליך · ${elapsed}`] }
  }
  if (segment.isPointInTime || event.end_time === null) {
    return { label, lines: [`בשעה ${formatIsraelTime(event.start_time)}`] }
  }
  const duration = formatDuration(event.start_time, event.end_time)
  const range = `${formatIsraelTime(event.start_time)}–${formatIsraelTime(event.end_time)}`
  return {
    // The time range is wrapped in an LTR isolate (LRI…PDI) so "22:40–06:10"
    // keeps start-before-end order inside the RTL layout instead of flipping.
    label,
    lines: [`⁦${range}⁩`, duration],
  }
}

/**
 * A natural-language label for screen readers - a full sentence, unlike the
 * compact centre readout, so it reads clearly aloud (e.g. "שינה מ-22:40 עד
 * 06:10, משך 7ש׳ 30ד׳" rather than "22:40–06:10 · 7ש׳ 30ד׳").
 */
function ariaLabelFor({ event, segment, isOngoing }: Drawable): string {
  const label = eventLabel(event)
  if (isOngoing) {
    const elapsed = formatDuration(event.start_time, new Date().toISOString())
    return `${label} מ-${formatIsraelTime(event.start_time)}, עדיין בתהליך (${elapsed})`
  }
  if (segment.isPointInTime || event.end_time === null) {
    return `${label} בשעה ${formatIsraelTime(event.start_time)}`
  }
  const duration = formatDuration(event.start_time, event.end_time)
  const from = formatIsraelTime(event.start_time)
  const to = formatIsraelTime(event.end_time)
  return `${label} מ-${from} עד ${to}, משך ${duration}`
}

export function DayClock({
  events,
  date,
  dayStart = '00:00',
  onArcClick,
  readOnly = false,
  emptyStateText = EMPTY_STATE_TEXT,
}: DayClockProps) {
  // useId gives stable, collision-free ids so multiple clocks can coexist on a page.
  const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  // Minutes from midnight the dial's top represents; every hour label is offset
  // by this so the wall-clock times stay correct when day_start is not midnight.
  const dayStartMinutes = parseDayStartMinutes(dayStart)

  const { arcs, points } = useMemo(() => {
    // Recomputed whenever the event list changes (including via realtime), which
    // is also when a running timer's arc needs to grow.
    const nowIso = new Date().toISOString()
    const arcList: Drawable[] = []
    const pointList: Drawable[] = []

    for (const event of events) {
      const isOngoing = !readOnly && event.end_time === null && TIMER_TYPES.has(event.type)
      const segment = clipEventToDay(
        event.start_time,
        isOngoing ? nowIso : event.end_time,
        date,
        dayStart,
      )
      if (!segment) continue
      const drawable: Drawable = { event, segment, isOngoing }
      if (segment.isPointInTime) pointList.push(drawable)
      else arcList.push(drawable)
    }

    return { arcs: arcList, points: pointList }
  }, [events, date, dayStart, readOnly])

  const isEmpty = arcs.length === 0 && points.length === 0
  const clickable = onArcClick !== undefined
  const animationName = `${idPrefix}-clock-enter`

  // The event whose details are shown in the dial's centre. Set on hover/focus
  // (desktop) or tap (mobile); cleared by leaving it or tapping the dial face.
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeDrawable = useMemo(
    () => [...arcs, ...points].find((drawable) => drawable.event.id === activeId) ?? null,
    [arcs, points, activeId],
  )

  const interactionProps = (drawable: Drawable) => {
    const show = () => setActiveId(drawable.event.id)
    const hide = () => setActiveId((current) => (current === drawable.event.id ? null : current))
    // Pointer/focus handlers surface the centre readout on every element,
    // whether or not the clock is in editable (onArcClick) mode.
    const shared = {
      'aria-label': ariaLabelFor(drawable),
      tabIndex: 0,
      className: 'cursor-pointer focus:outline-none',
      onMouseEnter: show,
      onFocus: show,
      onMouseLeave: hide,
      onBlur: hide,
      onClick: (mouseEvent: { stopPropagation: () => void }) => {
        // Keep a tap on an element from bubbling to the face's clear-handler.
        mouseEvent.stopPropagation()
        show()
        onArcClick?.(drawable.event)
      },
    }
    if (clickable) {
      return {
        ...shared,
        role: 'button' as const,
        onKeyDown: (keyboardEvent: KeyboardEvent) => {
          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
            keyboardEvent.preventDefault()
            onArcClick(drawable.event)
          }
        },
      }
    }
    return { ...shared, role: 'img' as const }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={VIEWBOX}
        className="h-auto w-full max-w-xs"
        role="img"
        aria-label="שעון 24 שעות של אירועי היום"
        onClick={() => setActiveId(null)}
      >
        <style>{`
          @keyframes ${animationName} {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
          }
          @media (prefers-reduced-motion: no-preference) {
            .${animationName} {
              transform-box: fill-box;
              transform-origin: center;
              animation: ${animationName} var(--duration-base) ease-out both;
            }
          }
        `}</style>

        <defs>
          {RING_ORDER.map((type) => {
            const { base, light } = eventColor(type)
            return (
              <linearGradient
                key={type}
                id={`${idPrefix}-grad-${type}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={light} />
                <stop offset="100%" stopColor={base} />
              </linearGradient>
            )
          })}
        </defs>

        <g className={animationName}>
          {/* Soft halo ripples behind the face. */}
          {HALO_RADII.map((radius, index) => (
            <circle
              key={`halo-${radius}`}
              cx={CENTER.x}
              cy={CENTER.y}
              r={radius}
              fill="none"
              stroke="var(--color-brand-300)"
              strokeWidth={1.5}
              strokeOpacity={0.18 - index * 0.05}
            />
          ))}

          {/* White dial face. */}
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={FACE_RADIUS}
            fill="var(--color-neutral-0)"
            stroke="var(--color-neutral-200)"
            strokeWidth={1}
          />

          {/* A full set of 24 hour ticks. Multiples of 6 (00/06/12/18) are the
              strongest; every 3rd hour is emphasised and labelled, so there is a
              time reference roughly every eighth of the dial without crowding it. */}
          {Array.from({ length: 24 }, (_, hour) => {
            const angle = minutesToAngle(hour * 60)
            const isMajor = hour % 6 === 0
            const isLabelled = hour % 3 === 0
            // Wall-clock hour at this tick: dial top is day_start, so each tick's
            // label is offset by it (identical to the raw hour when day_start is
            // midnight).
            const wallHour = (hour + Math.floor(dayStartMinutes / 60)) % 24
            const wallMinute = dayStartMinutes % 60
            const outer = pointOnCircle(CENTER, TICK_OUTER_RADIUS, angle)
            const inner = pointOnCircle(
              CENTER,
              TICK_OUTER_RADIUS - (isMajor ? TICK_MAJOR_LENGTH : TICK_MINOR_LENGTH),
              angle,
            )
            const label = pointOnCircle(CENTER, LABEL_RADIUS, angle)
            return (
              <g key={`tick-${hour}`}>
                <line
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke={isMajor ? 'var(--color-neutral-400)' : 'var(--color-neutral-200)'}
                  strokeWidth={isMajor ? 2 : 1}
                  strokeLinecap="round"
                />
                {isLabelled && (
                  <text
                    x={label.x}
                    y={label.y}
                    fill={isMajor ? 'var(--color-neutral-600)' : 'var(--color-neutral-400)'}
                    fontSize={isMajor ? 10 : 8.5}
                    fontWeight={isMajor ? 600 : 500}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {wallMinute === 0
                      ? wallHour === 0
                        ? '00:00'
                        : `${wallHour}:00`
                      : `${String(wallHour).padStart(2, '0')}:${String(wallMinute).padStart(2, '0')}`}
                  </text>
                )}
              </g>
            )
          })}

          {/* One faint track per event type, so every ring reads as a lane even
              on a day with no events of that type. */}
          {RINGS.map(({ type, radius }) => (
            <circle
              key={`track-${type}`}
              cx={CENTER.x}
              cy={CENTER.y}
              r={radius}
              fill="none"
              stroke={`var(--color-${type}-50)`}
              strokeWidth={RING_STROKE}
            />
          ))}

          {/* Duration events: thick rounded arcs on their type's fixed ring. */}
          {arcs.map((drawable) => (
            <path
              key={drawable.event.id}
              d={strokeArcPath(
                CENTER,
                ringRadius(drawable.event.type),
                drawable.segment.startMinutes,
                drawable.segment.endMinutes,
              )}
              fill="none"
              stroke={`url(#${idPrefix}-grad-${drawable.event.type})`}
              strokeWidth={RING_STROKE}
              // An in-progress event gets a flat leading edge, so it reads as
              // "not finished yet" rather than a completed, capped block.
              strokeLinecap={drawable.isOngoing ? 'butt' : 'round'}
              {...interactionProps(drawable)}
            />
          ))}

          {/* Point-in-time events (feeding / diaper / mood): dots on their ring. */}
          {points.map((drawable) => {
            const dot = pointOnCircle(
              CENTER,
              ringRadius(drawable.event.type),
              minutesToAngle(drawable.segment.startMinutes),
            )
            return (
              <circle
                key={drawable.event.id}
                cx={dot.x}
                cy={dot.y}
                r={POINT_DOT_RADIUS}
                fill={eventColor(drawable.event.type).base}
                stroke="var(--color-neutral-0)"
                strokeWidth={2}
                {...interactionProps(drawable)}
              />
            )
          })}

          {/* Centre readout: the hovered/tapped event's type, time and duration,
              shown in the dial's hollow middle. This is the primary way to read
              exact start/end/duration - the arcs alone only show position. */}
          {activeDrawable &&
            (() => {
              const { label, lines } = describeEvent(activeDrawable)
              const allLines = [label, ...lines]
              const lineHeight = 14
              const firstLineY = CENTER.y - ((allLines.length - 1) * lineHeight) / 2
              return (
                <g pointerEvents="none">
                  {allLines.map((line, index) => {
                    const isLabel = index === 0
                    return (
                      <text
                        key={line + index}
                        x={CENTER.x}
                        y={firstLineY + index * lineHeight}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={
                          isLabel
                            ? eventColor(activeDrawable.event.type).base
                            : 'var(--color-neutral-600)'
                        }
                        fontSize={isLabel ? 13 : 11}
                        fontWeight={isLabel ? 700 : 500}
                      >
                        {line}
                      </text>
                    )
                  })}
                </g>
              )
            })()}
        </g>
      </svg>

      {isEmpty && (
        <p className="max-w-xs text-center text-sm text-neutral-600">{emptyStateText}</p>
      )}
    </div>
  )
}
