import { axisLabels } from './dayComparison'

interface TimelineAxisProps {
  /** The child's `day_start` ('HH:MM'); the axis starts at this wall-clock time. */
  dayStart: string
}

/**
 * The shared hour axis above the comparison rows: a label every six hours
 * (00/06/12/18/24 for a midnight day). Time runs from the RTL start (right)
 * edge to the end (left) edge — the same reading direction the Week chart
 * uses for its days — so the axis is positioned with logical insets only. The
 * end labels are pinned flush to their edges and the inner ones centred on
 * their mark, so no label ever spills past the row at 320px.
 */
export function TimelineAxis({ dayStart }: TimelineAxisProps) {
  const labels = axisLabels(dayStart)
  const lastIndex = labels.length - 1

  return (
    <div className="relative h-4 text-xs tabular-nums text-neutral-400" aria-hidden="true">
      {labels.map((label, index) => {
        if (index === 0) {
          return (
            <span key={`axis-${index}`} className="absolute start-0 top-0">
              {label}
            </span>
          )
        }
        if (index === lastIndex) {
          return (
            <span key={`axis-${index}`} className="absolute end-0 top-0">
              {label}
            </span>
          )
        }
        return (
          <span
            key={`axis-${index}`}
            className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2"
            style={{ insetInlineStart: `${(index / lastIndex) * 100}%` }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
