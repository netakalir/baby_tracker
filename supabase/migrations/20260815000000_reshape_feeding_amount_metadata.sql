-- ============================================================
-- Reshape feeding events.metadata to the canonical unit-of-measure
-- shape (Documentation/unit-of-measure-spec.md, Decisions 1 & 2).
--
-- Before: feeding events stored a single loose key
--   { "amount": 118, ... }
-- where the integer was, per 20260804000000, "already stored
-- canonically in millilitres". So every historical amount was, in
-- effect, entered and stored in ml.
--
-- After: the spec splits this into two purpose-built keys
--   { "amount_ml": 118, "entered": { "value": 118, "unit": "ml" }, ... }
--
-- Why the split:
--   * amount_ml (integer) becomes the SINGLE source of truth for all
--     math/aggregation/charts. Nothing else is ever used for
--     calculation (Decision 1). We carry the old integer over
--     unchanged — it was already canonical ml, so no conversion and
--     no precision loss.
--   * entered preserves SOURCE FIDELITY (Decision 2): exactly what
--     the user typed, so "view in the entry unit" is byte-identical to
--     the original input and never drifts. Since all existing data was
--     entered in ml, we can honestly reconstruct entered as
--     { value: <old amount>, unit: 'ml' } — the ml viewer will show
--     the same number the parent originally logged. (New oz entries
--     will populate entered.unit = 'oz' at write time; that is the
--     app-side work, out of scope here.)
--
-- Scope: this is a jsonb DATA migration only — metadata is already a
-- flexible jsonb column, so no DDL/schema change is needed.
--
-- Idempotent / safe to re-run: the WHERE clause only touches feeding
-- rows that still carry the old `amount` key. A row already migrated
-- (has amount_ml, no amount) fails `metadata ? 'amount'` and is left
-- untouched. Rows with no numeric amount at all (e.g. breastfeeding
-- entries) are likewise skipped, and all other metadata keys are
-- preserved via `metadata - 'amount'` (subtract only the old key,
-- keep the rest).
-- ============================================================

update events
set metadata =
      (metadata - 'amount')
      || jsonb_build_object(
           'amount_ml', (metadata ->> 'amount')::int,
           'entered', jsonb_build_object(
             'value', (metadata ->> 'amount')::int,
             'unit',  'ml'
           )
         )
where type = 'feeding'
  and metadata ? 'amount';
