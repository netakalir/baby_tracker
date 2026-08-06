# Estimate Contract — `next feeding` / `next sleep`

Shared source of truth for **Task 5** (frontend banners) and **Task B** (Edge Function).
Both agents build to this contract so they can work in parallel: the frontend codes
against a stub of this shape, the Edge Function returns exactly this shape.

Owner of changes: this file. If either side needs a field change, it is edited here
first and both sides follow — neither side invents fields.

---

## 1. Endpoint

- **Name**: Supabase Edge Function `estimates`.
- **Invocation (frontend)**: `supabase.functions.invoke('estimates', { body: { child_id } })`.
- **Auth**: the user's JWT is forwarded automatically by `functions.invoke`. The
  function reads events **through the caller's RLS** (never the service role), so it
  can only ever see children the caller is allowed to see. `child_id` is validated
  to belong to the caller; otherwise `403`.
- **Method**: POST. No query params, no PII in the URL.

### Request body

```ts
interface EstimateRequest {
  child_id: string // uuid
}
```

### Response body

```ts
interface EstimateResponse {
  feeding: Estimate
  sleep: Estimate
  /** ISO-8601 UTC instant the server computed this. Lets the client show "as of". */
  generated_at: string
}

/** One card's worth of data. Discriminated by `status`. */
type Estimate =
  | { status: 'not_enough_data' }
  | {
      status: 'ready'
      /** ISO-8601 UTC instant of the predicted next event. Client formats to device tz. */
      predicted_at: string
      /**
       * Confidence bucket, drives copy tone only (not a number shown raw).
       * 'personal'  = enough of this child's own history to trust the average.
       * 'age_norm'  = fell back to age-appropriate norm (little/no personal data).
       */
      basis: 'personal' | 'age_norm'
    }
```

Notes:
- **Only two states per card**: `not_enough_data` and `ready`. Loading and error are
  **client-side** concerns (React Query `isLoading` / `isError`), never encoded in the body.
- The function returns **instants (`predicted_at`)**, not human strings. All wall-clock
  and "in 40 min" formatting is the frontend's job, using the device timezone
  (per the CLAUDE.md timezone principle). This keeps the function timezone-free.
- `basis` exists so the copy can differ ("לפי הקצב של התינוק" vs "לפי המקובל בגיל הזה")
  without the frontend re-deriving why.

---

## 2. Computation (Task B — Edge Function only)

These are the rules the function implements. The frontend does **not** re-implement them.

### Inputs the function reads
- `children` row for `child_id` → `birth_date` (for age), `day_start` (day boundary).
- Recent `events` for that child (last ~7 days is enough).

### Next feeding
- Compute gaps between consecutive **feeding** `start_time`s over recent history.
- `predicted_at = last_feeding_start + average_gap`.
- If fewer than **3** feedings in history → not enough personal data:
  - If age norm available → `basis: 'age_norm'` using the age's typical interval from
    `last_feeding_start`.
  - Else → `status: 'not_enough_data'`.
- With ≥3 feedings → `basis: 'personal'`.

### Next sleep (wake-window model, not a personal average)
- Find the **last completed sleep** (`type='sleep'`, `end_time` not null).
- `predicted_at = last_sleep_end + age_wake_window`.
- Wake window comes from the **age norms table** (below). If no completed sleep exists
  → `status: 'not_enough_data'`.
- Basis is `'age_norm'` whenever the wake window drives it (it always does for MVP);
  `'personal'` reserved for a later personalized-wake-window slice.

### Age norms table (constants inside the function for MVP)
Hardcoded in the function — **no external AI/search call yet** (that is a later slice;
CLAUDE.md's live-source is deferred). Rough, editable starting values keyed by age:

| Age              | Feeding interval | Wake window |
|------------------|------------------|-------------|
| 0–1 mo           | ~2.5 h           | ~45 min     |
| 1–3 mo           | ~3.5 h           | ~1 h 15 min |
| 3–6 mo           | ~4 h             | ~2 h        |
| 6–12 mo          | ~4.5 h           | ~2 h 45 min |
| 12+ mo           | ~4.5 h           | ~3 h 30 min |

Values are midpoints of published ranges from mainstream infant-care sources
(Huckleberry — the category leader named in CLAUDE.md — AAP/HealthyChildren,
Cleveland Clinic, Pampers). Wake windows: newborn 30–60 min → ~2.5–3.5 h at 6–12 mo.
Feeding: ~2–3 h newborn → ~4–5 h by 6 mo. They live in one clearly-labeled constant
so they can be tuned or later replaced by the deferred live-AI source without touching
the response shape. Threshold for "enough personal data" = **3 feedings** (confirmed).

---

## 3. Presentation (Task 5 — frontend only)

The banner renders **four** UI states per card, mapped from the contract + query state:

| UI state          | Condition                                            |
|-------------------|------------------------------------------------------|
| Loading           | React Query `isLoading`                              |
| Unavailable       | `isError` **or** `status === 'not_enough_data'`      |
| Ready             | `status === 'ready'`                                 |

- **Unavailable** copy = the honest positive placeholder from `error-handling-spec`
  (same tone as today's "עוד אין מספיק נתונים"), never a red error.
- **Ready** copy formats `predicted_at` to the **device timezone**, and picks wording
  from `basis`.
- Styling stays within the existing card design (design-system skill); no new colors.

---

## 4. Non-goals (both agents)
- No schema migration (uses existing `events` / `children`).
- No real external AI/search call (age norms are in-function constants).
- No caching/persistence of estimates (computed on demand for MVP).
- Frontend never computes predictions; function never formats wall-clock strings.
