-- ============================================================
-- Allow at most one running timer per child per timer type.
--
-- The bug: starting a sleep/feeding timer is a plain client insert
-- of an events row with end_time = null (src/features/today/api.ts).
-- When both parents tap "start sleep" at nearly the same moment on
-- two phones, each client sees "no running sleep" and inserts its
-- own row, so the child ends up with two running sleeps. The UI
-- adopts one; the other is orphaned forever (nobody can see it to
-- stop it) and pollutes every duration/aggregation that treats a
-- null end_time as "still running".
--
-- The fix is a partial unique index, so the database itself refuses
-- the second running row. The losing insert fails with
-- unique_violation (SQLSTATE 23505); the client maps a 23505 on an
-- events insert to "adopt the already-running timer". That mapping
-- relies on this index being the only unique constraint on events
-- besides the generated primary key — revisit the client if another
-- unique constraint is ever added here.
--
-- Why the predicate also filters on type: diaper and mood are
-- point-in-time events and are ALSO stored with end_time = null
-- (they have no duration). Without `type in ('sleep', 'feeding')`
-- the index would forbid logging a second diaper for the same child.
--
-- Scope: index + one-off data repair only. RLS policies, grants and
-- the supabase_realtime publication on events are unaffected — an
-- index does not change who can read/write which rows, and closing
-- orphans is an ordinary UPDATE (which realtime will broadcast like
-- any other).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Repair existing duplicates (must run BEFORE the index).
--
-- `create unique index` fails outright if the race has already
-- produced duplicates in the hosted data, so close them first.
--
-- For each (child_id, type) with more than one running sleep/feeding
-- row we KEEP the newest one — latest start_time, tie-broken by
-- created_at then id so the choice is deterministic — because that
-- is the timer the parents most plausibly still consider live. Every
-- older running row is closed with a zero-length duration
-- (end_time = its own start_time). Its real end is unknown, and a
-- zero-length close never invents time: closing at the newer row's
-- start instead could turn an orphan from days ago into a
-- multi-day sleep/feeding that skews Today, Week, Compare and the
-- estimates. For a race duplicate (started seconds before the kept
-- row) the two choices differ by seconds anyway. This is
-- non-destructive — no rows are deleted, and end_time >= start_time
-- holds trivially (there is no CHECK constraint for it on events,
-- but every duration computation in the app assumes it).
--
-- Idempotent / no-op when clean: only groups with 2+ running rows
-- produce updates; once repaired (or if never broken) nothing
-- matches.
-- ------------------------------------------------------------

with running as (
  select id,
         child_id,
         type,
         start_time,
         row_number() over (
           partition by child_id, type
           order by start_time desc, created_at desc, id desc
         ) as recency_rank
  from public.events
  where end_time is null
    and type in ('sleep', 'feeding')
)
update public.events e
set end_time = running.start_time
from running
where e.id = running.id
  and running.recency_rank > 1;

-- ------------------------------------------------------------
-- 2. Enforce it going forward.
--
-- `if not exists` keeps the migration re-runnable over partial prior
-- state. Not created `concurrently`: migrations run inside a
-- transaction, and events is small enough that the brief lock is
-- harmless.
-- ------------------------------------------------------------

create unique index if not exists events_one_running_timer_per_type
  on public.events (child_id, type)
  where end_time is null
    and type in ('sleep', 'feeding');
