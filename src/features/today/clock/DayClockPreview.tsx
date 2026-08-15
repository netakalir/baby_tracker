import type { Event } from '../../../types/database'
import { DayClock } from '../DayClock'

/**
 * Local, standalone visual preview of {@link DayClock} for manual verification.
 *
 * This is a developer preview only and is intentionally NOT wired into routing or
 * `TodayScreen`. It fabricates a set of `Event` rows (including a midnight-crossing
 * sleep) so the clock can be eyeballed in isolation.
 */

const PREVIEW_DATE = new Date('2026-07-22T09:00:00Z')

function isoOnDay(day: string, hhmm: string): string {
  // Build an Israel-local time as a UTC ISO by using the +03:00 summer offset.
  return `${day}T${hhmm}:00+03:00`
}

const PREVIEW_EVENTS: Event[] = [
  {
    id: 'sleep-overnight',
    child_id: 'c1',
    type: 'sleep',
    // Starts previous night 23:30, ends 02:00 today -> should render 00:00..02:00.
    start_time: isoOnDay('2026-07-21', '23:30'),
    end_time: isoOnDay('2026-07-22', '02:00'),
    created_by: 'u1',
    metadata: null,
    created_at: isoOnDay('2026-07-22', '02:00'),
  },
  {
    id: 'feeding-morning',
    child_id: 'c1',
    type: 'feeding',
    start_time: isoOnDay('2026-07-22', '06:15'),
    end_time: isoOnDay('2026-07-22', '06:35'),
    created_by: 'u1',
    metadata: { amount_ml: 120, entered: { value: 120, unit: 'ml' } },
    created_at: isoOnDay('2026-07-22', '06:35'),
  },
  {
    id: 'diaper-morning',
    child_id: 'c1',
    type: 'diaper',
    start_time: isoOnDay('2026-07-22', '07:05'),
    end_time: null,
    created_by: 'u1',
    metadata: null,
    created_at: isoOnDay('2026-07-22', '07:05'),
  },
  {
    id: 'mood-midday',
    child_id: 'c1',
    type: 'mood',
    start_time: isoOnDay('2026-07-22', '12:40'),
    end_time: null,
    created_by: 'u1',
    metadata: { mood_level: 4 },
    created_at: isoOnDay('2026-07-22', '12:40'),
  },
  {
    id: 'nap-afternoon',
    child_id: 'c1',
    type: 'sleep',
    start_time: isoOnDay('2026-07-22', '13:30'),
    end_time: isoOnDay('2026-07-22', '15:00'),
    created_by: 'u1',
    metadata: null,
    created_at: isoOnDay('2026-07-22', '15:00'),
  },
]

export function DayClockPreview() {
  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-8 p-6">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">עם נתונים</h2>
        <DayClock
          events={PREVIEW_EVENTS}
          date={PREVIEW_DATE}
          onArcClick={(event) => window.alert(`אירוע: ${event.type}`)}
        />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">מצב ריק</h2>
        <DayClock events={[]} date={PREVIEW_DATE} />
      </section>
    </div>
  )
}
