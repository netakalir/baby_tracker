-- ============================================================
-- Move the day boundary (day_start) to the child (per-child).
-- (CLAUDE.md timezone & day-boundary principle, revised Aug 2026.)
--
-- Rationale: "when does the baby's day start" is a fact about the
-- BABY's routine, not a preference of either parent, and it is an
-- aggregation boundary (it decides which events fall into "today"
-- for summaries/Insights). It therefore belongs on `children`, not
-- family_settings — matching the category leader (Huckleberry sets
-- the day start/end on the Child Profile) and correctly supporting
-- multi-child families where a newborn and a toddler have different
-- "days".
--
-- day_start is NOT applied yet: the Today clock still uses local
-- midnight. This migration only stores the column (default '00:00',
-- preserving current behaviour); wiring day_start into the clock is
-- the deferred "apply" layer (settings debt in PROGRESS.md).
--
-- family_settings keeps existing (family_id + updated_at) as a
-- deliberate placeholder for a future genuinely per-family setting
-- (decided: keep, do not drop). It no longer holds any real column.
--
-- Idempotent (IF NOT EXISTS / IF EXISTS) so it applies cleanly over
-- partial prior state. No backfill: existing children get the '00:00'
-- default, which equals the current hardcoded midnight boundary.
-- ============================================================

alter table children
  add column if not exists day_start time not null default '00:00';

alter table family_settings
  drop column if exists day_start;
