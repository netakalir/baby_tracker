import { formatDayNumber, formatLongDayLabel, formatShortWeekday } from './compareDate'

interface DayChipsProps {
  /** The selectable child-days (`YYYY-MM-DD`), oldest first. */
  dates: readonly string[]
  /** The currently selected days. */
  selected: readonly string[]
  /** The current child-day, emphasised so "today" is found at a glance. */
  todayString: string
  onToggle: (dateString: string) => void
}

/**
 * The day picker: one chip per recent child-day (weekday + day number), laid
 * out as two week-long rows. Chronological like the Week chart — the earliest
 * day at the RTL start edge, today last. Each chip is a toggle button
 * (`aria-pressed`); any number of days can be on at once. The only motion is
 * the brief color change confirming the tap.
 */
export function DayChips({ dates, selected, todayString, onToggle }: DayChipsProps) {
  const selectedSet = new Set(selected)

  return (
    <div role="group" aria-label="בחירת ימים להשוואה" className="grid grid-cols-7 gap-1.5">
      {dates.map((dateString) => {
        const isSelected = selectedSet.has(dateString)
        const isToday = dateString === todayString
        return (
          <button
            key={dateString}
            type="button"
            aria-pressed={isSelected}
            aria-label={formatLongDayLabel(dateString)}
            onClick={() => onToggle(dateString)}
            className={`flex min-w-0 flex-col items-center rounded-md border py-1.5 leading-tight transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isSelected
                ? 'border-brand-500 bg-brand-500 text-on-accent'
                : 'border-neutral-200 bg-neutral-0 text-neutral-800 hover:bg-neutral-100'
            }`}
          >
            <span className={`text-xs ${isToday ? 'font-semibold' : 'font-medium'}`}>
              {formatShortWeekday(dateString)}
            </span>
            <span
              className={`text-sm tabular-nums ${isToday ? 'font-semibold' : ''} ${
                isToday && !isSelected ? 'text-brand-600' : ''
              }`}
            >
              {formatDayNumber(dateString)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
