import { memo } from 'react'
import type { EventType } from '../../types/database'
import { eventColor } from './clock/eventColors'
import { RING_ORDER } from './clock/rings'

/** Legend order mirrors the clock's ring order (outermost first). */
const LEGEND_TYPES = RING_ORDER

interface ClockLegendProps {
  /**
   * The event types to list, in order. Defaults to every clock ring; a view
   * that omits a type (e.g. Day comparison, which does not draw mood) passes
   * only the types it actually shows, so the key never lists a missing color.
   */
  types?: readonly EventType[]
}

/**
 * A compact color key for the clock. Ties each event-type color to its Hebrew
 * label so the arcs/dots on the dial are readable at a glance - deliberately
 * minimal (a dot + a word), never a busy panel.
 *
 * Memoised: its only (optional) prop is a stable constant, so it never needs
 * to re-render — in particular not on the Today screen's once-a-second timer
 * tick, which re-renders its parent but must not cascade to this static key.
 */
export const ClockLegend = memo(function ClockLegend({ types = LEGEND_TYPES }: ClockLegendProps) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5" aria-label="מקרא צבעים">
      {types.map((type) => {
        const { base, label } = eventColor(type)
        return (
          <li key={type} className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: base }}
              aria-hidden="true"
            />
            {label}
          </li>
        )
      })}
    </ul>
  )
})
