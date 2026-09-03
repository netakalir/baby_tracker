import { memo } from 'react'
import { eventColor } from './clock/eventColors'
import { RING_ORDER } from './clock/rings'

/** Legend order mirrors the clock's ring order (outermost first). */
const LEGEND_TYPES = RING_ORDER

/**
 * A compact color key for the clock. Ties each event-type color to its Hebrew
 * label so the arcs/dots on the dial are readable at a glance - deliberately
 * minimal (a dot + a word), never a busy panel.
 *
 * Memoised: it takes no props, so it never needs to re-render — in particular
 * not on the Today screen's once-a-second timer tick, which re-renders its
 * parent but must not cascade to this static key.
 */
export const ClockLegend = memo(function ClockLegend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5" aria-label="מקרא צבעים">
      {LEGEND_TYPES.map((type) => {
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
