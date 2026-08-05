-- ============================================================
-- Move measurement units from family_settings to user_preferences
-- (screen-settings-spec.md §3.3, revised scope decision).
--
-- Rationale: feeding amounts are already stored canonically in
-- millilitres (events.metadata.amount). ml <-> oz is a lossless
-- unit conversion of the SAME physical quantity, exactly like the
-- project's UTC-store / Israel-local-display timezone principle.
-- So the display unit is a purely PERSONAL presentation choice that
-- can differ per parent without ever making the shared data
-- contradictory - it belongs in the per-user preferences row, not
-- the shared family row.
--
-- day_start stays in family_settings: unlike units, it is an
-- aggregation boundary that feeds shared, server-computed rollups
-- (daily summaries, AI Insights), so a single family value keeps
-- those unambiguous.
--
-- Written idempotently (IF NOT EXISTS / IF EXISTS) so it applies
-- cleanly over partial prior state. No data backfill: units rows are
-- created lazily on first save, and the column default preserves the
-- previous 'ml' behaviour for any existing user_preferences rows.
-- ============================================================

alter table user_preferences
  add column if not exists units text not null default 'ml' check (units in ('ml', 'oz'));

alter table family_settings
  drop column if exists units;
