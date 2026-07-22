import type { EventType } from '../../../types/database'

/**
 * Per-event-type color definitions for the Today-screen clock.
 *
 * The design-system skill mandates one consistent color/gradient per event type,
 * reused everywhere (clock, buttons, charts, legends). The canonical values live
 * once in `src/index.css` `@theme` as `--color-<type>-{50,300,500}` tokens; this
 * module references those variables (not raw hex) so the clock, the logging
 * buttons, and future charts all draw from a single source of truth. `base` is
 * the solid `500` accent; `light` is the `300` gradient stop.
 */
export interface EventColor {
  /** Solid stroke/fill base color (the `500` token). */
  readonly base: string
  /** Lighter gradient stop for the arc fill (the `300` token). */
  readonly light: string
  /** Human-readable Hebrew label for the event type (aria + legend). */
  readonly label: string
}

export const EVENT_COLORS: Readonly<Record<EventType, EventColor>> = {
  sleep: { base: 'var(--color-sleep-500)', light: 'var(--color-sleep-300)', label: 'שינה' },
  feeding: { base: 'var(--color-feeding-500)', light: 'var(--color-feeding-300)', label: 'האכלה' },
  diaper: { base: 'var(--color-diaper-500)', light: 'var(--color-diaper-300)', label: 'החתלה' },
  mood: { base: 'var(--color-mood-500)', light: 'var(--color-mood-300)', label: 'מצב רוח' },
} as const

export function eventColor(type: EventType): EventColor {
  return EVENT_COLORS[type]
}
