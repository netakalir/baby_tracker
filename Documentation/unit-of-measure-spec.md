# Unit of Measure — Design Decision & Implementation Spec

**Status:** Decided. This is the single agreed approach. Do not deviate without explicit discussion.

## Problem

Users may enter and view quantities in different units (e.g. `ml` vs `fl oz`). The
conversion factor (`1 fl oz = 29.5735295625 ml`) is non-integer, so no quantity can be a
whole number in both units simultaneously. Naive convert-and-store causes round-trip drift:
a user enters `4 oz`, the system stores `118 ml`, and the user later sees `3.99 oz`. This spec
eliminates that class of bug architecturally rather than mathematically.

## Core Decisions

1. **Single canonical unit, stored as an integer, in the smallest sensible unit.** All
   quantities are stored as `amount_ml: integer`. This column is the single source of truth
   for every calculation, aggregation, chart, and comparison. Nothing else is ever used for
   math.

2. **Preserve the original input verbatim (source fidelity).** Alongside the canonical value,
   store exactly what the user entered:

   ```json
   { "amount_ml": 118, "entered": { "value": 4, "unit": "oz" } }
   ```

   Rule: when the viewing unit equals `entered.unit`, display `entered.value` verbatim — no
   conversion, no rounding. The user who typed 4 always sees exactly 4. Conversion happens only
   when viewing in a unit different from the entry unit.

3. **Display unit is a user-level preference, not per-record.** `display_unit` lives on the
   user profile/settings. Records never store a display preference — only what was entered.

4. **Round only at the presentation layer, exactly once.**
   - Never round or truncate before storing the canonical value beyond integer-ml resolution.
   - Never chain conversions. Always convert from `amount_ml`, never from an already-converted
     or already-rounded value.
   - Aggregations (e.g. daily totals): sum `amount_ml` across records first, convert the total
     once, round once at display. Never sum per-record converted values.

5. **One centralized conversion module.** A single utility owns the constant
   `ML_PER_FL_OZ = 29.5735295625` and all convert/format functions. No conversion constants or
   ad-hoc math anywhere else in the codebase.

## Input UX (enforcing clean values without visible fractions)

- Quantity input uses unit-aware steppers/increments:
  - `ml`: steps of 5 (configurable to 10)
  - `oz`: steps of 0.5
- This guarantees entered values are always "clean" in the entry unit; rounding questions
  exist only in cross-unit display.

## Cross-unit display (snap-to-grid)

When displaying in a unit other than the entry unit:

- Convert from `amount_ml`, then snap to the target unit's step grid (`ml` → nearest 5;
  `oz` → nearest 0.5).
- Example: entered `4 oz` → stored `118 ml` → ml-viewer sees `120 ml`; entered `100 ml` →
  oz-viewer sees `3.5 oz`.
- This is an approximation by design and is acceptable: the entering user's view is always
  exact (Decision 2).

## Conversion module contract

```ts
// single source of conversion truth
const ML_PER_FL_OZ = 29.5735295625;

toCanonicalMl(value: number, unit: Unit): number       // returns integer ml (round-half-up)
fromCanonicalMl(amountMl: number, unit: Unit): number  // full precision, no rounding
formatForDisplay(record, viewUnit: Unit): string
// formatForDisplay logic:
//   if viewUnit === record.entered.unit → return record.entered.value verbatim
//   else → fromCanonicalMl → snap to viewUnit grid → format
formatTotal(totalMl: number, viewUnit: Unit): string   // convert once, round once
```

## Testing requirements

- Round-trip test: for every valid stepper value in every unit, enter → store → display in
  same unit must be byte-identical to input.
- Aggregation test: sum of N entries displayed as total must equal `convert(sum(amount_ml))`,
  not `sum(convert(each))`.
- No conversion constant may appear outside the conversion module (lint/grep check).

## Explicitly rejected alternatives

- Storing floats in the canonical column (precision drift).
- Storing per-record display unit as the value's unit of truth (breaks aggregation).
- Rounding on write to make both units whole (mathematically impossible; causes drift).
- Converting displayed values from other displayed values (chained conversion drift).
