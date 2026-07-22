import type { EventType } from '../../../types/database'

/**
 * Per-event-type color definitions for the Today-screen clock.
 *
 * The design-system skill mandates one consistent color/gradient per event type,
 * reused everywhere (clock, buttons, charts, legends). Those tokens are declared
 * "not yet defined - add them once when the Today screen is built".
 *
 * They are defined here (scoped to the clock) rather than in `src/index.css`
 * `@theme` only because this component is built on an isolated branch that must
 * not edit shared files. When the data layer / logging buttons land, these values
 * should be promoted verbatim into `index.css` as `--color-event-*` tokens so the
 * whole app references a single source of truth.
 */
export interface EventColor {
  /** Solid stroke/fill base color. */
  readonly base: string
  /** Lighter gradient stop, used for the arc's gradient fill. */
  readonly light: string
  /** Human-readable Hebrew label for the event type (aria + legend). */
  readonly label: string
}

export const EVENT_COLORS: Readonly<Record<EventType, EventColor>> = {
  // Sleep - deep indigo, evokes night/rest, distinct from the brand violet.
  sleep: { base: '#4338ca', light: '#818cf8', label: 'שינה' },
  // Feeding - warm amber, evokes milk/warmth.
  feeding: { base: '#d97706', light: '#fbbf24', label: 'האכלה' },
  // Diaper - teal, clean and distinct from the warm tones.
  diaper: { base: '#0d9488', light: '#5eead4', label: 'החתלה' },
  // Mood - rose, expressive without competing with feeding's amber.
  mood: { base: '#e11d48', light: '#fb7185', label: 'מצב רוח' },
} as const

export function eventColor(type: EventType): EventColor {
  return EVENT_COLORS[type]
}
