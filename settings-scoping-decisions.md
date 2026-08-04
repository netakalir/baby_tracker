# Decision Record: Settings Scoping (per-user / per-family / per-child)

**Status:** Decided & recorded. **Date:** August 2026.
**Participants:** Netanel (product/architecture direction) + Claude Code (analysis, research, implementation).
**Scope:** Which settings in the app belong to the individual user, to the whole
family, or to the specific child — and the technical model behind it.

This document is the single narrative record of *how and why* every settings-scope
decision was made, including the debate, the outside evidence, and the final calls.
`screen-settings-spec.md` holds the screen spec; `CLAUDE.md` holds the standing
principle; this file holds the reasoning trail.

---

## 1. The question

The app is built on **two parents sharing one dataset**. So every setting must be
placed in exactly one scope, or the parents will see contradictory data:

- **per-user** — private to the signed-in person; never shared (e.g. their language).
- **per-family** — shared; both parents see and change the same value.
- **per-child** — a fact about a specific baby; shared, but keyed to the child.

Getting this wrong is not cosmetic: if one parent saw a feed as `120` and the other
as a *different* number, or "today" started at a different hour and produced
different daily totals, the shared screens would disagree.

---

## 2. The decision framework we converged on

Three tools were used to classify each setting:

### 2.1 The "lossless" test (the key discriminator)
Ask: *is this a reversible transform of a single value, or does it change the value/aggregate itself?*

- **Lossless transform** (like UTC→local time): the underlying value is identical;
  only its presentation differs. Two people can differ with **zero** contradiction.
  → safe to be **per-user**.
- **Not lossless** (changes an aggregate): differing values produce genuinely
  different numbers on shared data. → must be **shared** (per-family or per-child).

### 2.2 The "three consumers" of a day boundary
A day-boundary setting feeds three different things, each with different sensitivity:

| Consumer | What it does | Sensitive to per-viewer difference? |
|---|---|---|
| Clock face | rotates the 24h dial's origin | **No** — pure visual, per device |
| "Today" query window | which events are *fetched* as today | **No** — a read filter; each view is internally consistent |
| Shared aggregates | daily summary, AI Insights | **Yes** — divergent boundaries → different numbers |

Only the third consumer creates real tension.

### 2.3 The precedent already in the codebase
The project **already** stores timestamps in UTC and converts to local time only for
display (`todayDate.ts`, `dayWindow.ts`, and the CLAUDE.md timezone principle). Any
new decision had to stay consistent with that "store canonical, present per-viewer"
model rather than contradict it.

---

## 3. The settings, one by one

### 3.1 Display name → **per-user**
Personal identifier; no reason two parents share one. Stored in
`user_preferences.display_name`. Uncontested.

### 3.2 Language (he/en) + RTL → **per-user**
Pure personal chrome. One parent can use Hebrew, the other English, with no effect
on the shared data. Stored in `user_preferences.language`. Uncontested.

### 3.3 Theme (light/dark/system) → **per-user**
Same as language — a personal visual preference. Stored in `user_preferences.theme`.
Uncontested.

### 3.4 Notification toggles (feeding / sleep / daily summary) → **per-user**
Each parent decides what pings *their own* phone. Stored in
`user_preferences.notif_feeding` / `notif_sleep` / `notif_daily_summary`. (MVP builds
the preferences + persistence only; push delivery is deferred per CLAUDE.md.)
Uncontested.

### 3.5 Measurement units (ml / oz) → **per-user**  *(reversed from an earlier call)*
**Originally placed as per-family**, on the (flawed) argument that "one parent seeing
ml and the other oz would look contradictory."

**Netanel challenged this**, drawing the exact analogy to the app's own UTC/timezone
rule: just as a timestamp is stored canonically and shown per-viewer, units can be
stored canonically and shown per-viewer.

**He was right, and the earlier reasoning was wrong.** Verified in the code: feeding
amounts are **already stored canonically in millilitres** (`events.metadata.amount`,
ml presets, `formatMilliliters`). ml ⇄ oz is a **lossless** conversion of the *same*
physical quantity — it passes the §2.1 test. 120 ml and 4 oz are the same value, not
two contradictory ones — exactly like one instant shown in two timezones. This holds
for input too (parent types in their unit; we convert and store ml).

→ **Moved to `user_preferences.units`.** Migration
`20260804000000_move_units_to_user_preferences.sql`.

### 3.6 Day-start / day boundary → **per-child**  *(after a long debate)*
This was the hard one. It went through three framings:

1. **First framing (mine): per-family.** Argument: it feeds shared aggregates
   (daily summary, AI Insights), so a single family value keeps them unambiguous. It
   *fails* the lossless test (a summary with a 00:00 boundary vs a 06:00 boundary
   gives genuinely different totals — an event at 02:00 falls in different days), so
   it can't be a free per-user choice like units.

2. **Second framing (mine): per-user with server complexity, or a hybrid.** Weighing
   whether night-shift parents (Phase 4) justify per-user boundaries.

3. **Netanel's decisive reframing: neither — it's per-child.** His point:
   > "The baby's day is where the baby lives, not the parent. So it must be defined
   > by where the baby is."

   This exposed that framings 1 and 2 were both *preference* framings. The day
   boundary is **not a preference at all** — it's an objective fact about the baby's
   routine/location. No parent legitimately "prefers" when the baby's day starts, any
   more than they prefer when the sun rises. Therefore it belongs to the **child**.

**This was confirmed by outside research** (see §4): the category leader (Huckleberry)
sets the day start/end **on the Child Profile** — i.e. per-child. It is also required
for multi-child families: a newborn and a toddler genuinely have different "days", so
a single family value would break the moment a family has two children of different
ages.

→ **`day_start` on `children`** (per-child). Migration
`20260804000001_day_start_to_children.sql`. Default `'00:00'`.

### 3.7 Timezone (wall clock) → **device timezone (not stored per-child)**  *(a mutual correction)*
While deciding §3.6, *both* of us drifted toward "store a timezone on the child."
**Research showed this is against the industry convention and we corrected it.**

Every major baby app follows the **device** timezone and adjusts immediately on
travel; none stores a per-child zone. The reasoning is sound: "where the baby is *now*"
= where the logging phone is now. A stored per-child zone would show the *wrong* wall
clock the moment you travel with the baby, until manually updated. Storing UTC keeps
aggregations stable; only presentation converts.

→ **Wall clock = device timezone.** This **revises** the CLAUDE.md rule that hardcoded
`Asia/Jerusalem`. The hardcoded Israel zone stays as an MVP placeholder; switching to
the device zone is part of the deferred "apply" layer. Documented in CLAUDE.md.

Note the clean split this produces, mapping onto §2.2:
- **day_start** (feeds aggregates) → a single shared value, per-child → consistent totals.
- **timezone** (pure wall-clock display) → device → free to float per viewer.

---

## 4. Outside evidence (sources)

Research was done specifically because Netanel asked for real-world convention and
push-back, not agreement in a vacuum.

- **Huckleberry — "How do I change the day's start and end times?"** — the day
  start/end is changed on the **Child Profile screen** ⇒ per-child.
  https://huckleberry.zendesk.com/hc/en-us/articles/4404729168147
- **Huckleberry — "Will the app automatically adjust if I travel to another
  timezone?"** — "The time in the app will automatically change to whatever time zone
  your phone is set to" ⇒ timezone follows the **device**, not a stored value.
  https://huckleberry.zendesk.com/hc/en-us/articles/7825120157971
- **Tinybird — "10 best practices for timestamps and time zones in databases"** —
  store UTC; choose **one** reference frame for day-bucketing, document it, and keep
  conversion centralized; presentation-time local labels shouldn't distort the data.
  https://www.tinybird.co/blog/database-timestamps-timezones

Takeaways: (a) per-child day boundary matches the market leader; (b) per-child
timezone does **not** — device zone is the convention; (c) the "pick one boundary,
store UTC, convert at edges" rule from DB best-practice aligns with keeping day_start
a single shared (per-child) value.

---

## 5. The four explicit decisions (as put to Netanel)

| # | Decision | Choice | Detail |
|---|---|---|---|
| 1 | Scope of `day_start` | **per-child** | On `children`. Matches Huckleberry; handles multi-child; keeps summary totals consistent. |
| 2 | Wall-clock timezone | **device timezone** | Revises the hardcoded Israel rule; documented in CLAUDE.md; apply-layer deferred. |
| 3 | Fate of `family_settings` | **keep as placeholder** | Both its columns left (units→user, day_start→child). Table kept (family_id + updated_at) with RLS intact, as a home for a future genuinely per-family setting. |
| 4 | Configurable `day_start` in MVP | **defer the apply** | Column exists (default midnight); no UI control and no clock rewrite now. (Data point: Huckleberry's own day-start article was rated helpful by only 1 of 6 — a power-user feature.) |

---

## 6. Resulting model

| Setting | Scope | Storage |
|---|---|---|
| Display name | per-user | `user_preferences.display_name` |
| Language (+RTL) | per-user | `user_preferences.language` |
| Theme | per-user | `user_preferences.theme` |
| Measurement units | per-user | `user_preferences.units` |
| Notification toggles | per-user | `user_preferences.notif_*` |
| Day boundary (`day_start`) | **per-child** | `children.day_start` |
| Wall-clock timezone | device (not stored) | derived client-side from the device |
| *(none genuinely per-family)* | per-family | `family_settings` kept empty as a placeholder |

**Key realization:** there turned out to be **no genuinely per-family setting**. Every
candidate was either personal chrome (per-user) or a fact about the baby (per-child).
"per-family" was an illusion; `family_settings` survives only as a deliberate,
empty placeholder.

---

## 7. Implementation & consequences

- **Migrations** (committed; applied to the hosted DB by Netanel via `supabase db push`):
  - `20260804000000_move_units_to_user_preferences.sql` — add `units` to
    `user_preferences`, drop from `family_settings`.
  - `20260804000001_day_start_to_children.sql` — add `day_start` to `children`, drop
    from `family_settings`.
- **Types** (`src/types/database.ts`): `units` on `UserPreferences`; `day_start` on
  `Child`; `FamilySettings` reduced to `{ family_id, updated_at }`.
- **UI** (`src/features/settings/DisplayScreen.tsx`): now purely per-user
  (language/theme/units). The `day_start` control was **removed** (per Decision 4).
- **Tests**: `family-settings-isolation.spec.ts` updated to the placeholder shape;
  per-child `day_start` is covered by the existing `children` RLS
  (`family-isolation.spec.ts`).
- **Standing docs**: CLAUDE.md timezone principle rewritten (device zone + per-child
  `day_start`); `children` table gains `day_start`.

---

## 8. Deferred (explicitly not now)

- **Applying `day_start`** to the clock/summaries (rewrite of the day-boundary math so
  the day starts at the chosen hour instead of local midnight).
- **Switching the wall clock from hardcoded `Asia/Jerusalem` to the device zone.**
- **A UI control** to edit a child's `day_start` (likely on the Baby & family screen,
  once the apply layer exists).
- **Applying theme, live i18n/RTL, and unit conversion** in the UI (the values are
  stored now; nothing reads them yet — tracked as settings debt in PROGRESS.md).

---

## 9. Process note

Netanel explicitly asked to be **challenged, not agreed with**, and for decisions to
be checked against real-world convention. That process changed the outcome twice:
his units-are-lossless argument reversed a wrong per-family call, and his
"it's the baby's day" reframing moved `day_start` to per-child — while research in
turn corrected *both* of us away from storing a per-child timezone. The friction
produced a better model than either initial position.
