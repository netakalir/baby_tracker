# Screen Spec: Settings & User Preferences

Status: **Spec / not yet built**. Part of Phase 1 (MVP), added after the Today screen.

## 1. Purpose & tone

A single **Settings hub** the parent visits rarely (typically once a week or less).
It must feel like the calm, native "Settings" section of a good mobile app — not a
control panel. It does **not** occupy a slot in the bottom navigation bar; that
nav is reserved for the daily-use screens (Today / Week / Insights / later Health).

Entry point: a **gear / avatar icon** in the header of the Today screen. Tapping it
pushes the Settings hub onto the stack; a back arrow returns to Today.

## 2. The per-user vs. per-family distinction (core rule)

Every setting belongs to exactly one of two scopes. This is the single most
important design decision on this screen, because the whole app is built on two
parents sharing one dataset.

- **per-user** — private to the signed-in user, never shared. Different on each
  parent's account (and each may differ per device only if we also cache locally).
- **per-family / per-child** — shared; both parents see the same value. Changing it
  changes it for everyone in the family.

Rule of thumb applied below: anything that changes how *shared data is interpreted
or displayed as a value* (units, what counts as "today") is per-family, so the two
parents never see contradictory numbers. Anything that is purely *personal chrome*
(language, theme, my own reminders) is per-user.

## 3. Structure (drill-in hub)

```
⚙️  Settings
─────────────────────────
👤  Profile & account       >
👶  Baby & family           >
🎨  Display & language      >
🔔  Notifications           >
─────────────────────────
        [ Log out ]
```

Each row opens its own sub-screen. Grouping and drill-in match the iOS-Settings
pattern the user chose over a dedicated nav tab.

### 3.1 👤 Profile & account  (mostly per-user)

| Item | Scope | Source | Notes |
|---|---|---|---|
| Display name | per-user | `user_preferences.display_name` (or auth metadata) | Editable |
| Email | per-user | `auth.users` | Read-only |
| Log out | — | Supabase Auth `signOut()` | Confirm before |
| Delete account | per-user | — | Destructive; double-confirm. See §6 |

### 3.2 👶 Baby & family  (shared)

| Item | Scope | Source | Notes |
|---|---|---|---|
| Baby name + birth date | per-child | `children` | Editable |
| Family members list | per-family | `family_members` | Read + (later) remove |
| Invite second parent | per-family | `family_invites` | Existing onboarding invite flow |
| Switch / select child (multi-child) | per-family | `children` | Only shown when >1 child |

### 3.3 🎨 Display & language

| Item | Scope | Source | Notes |
|---|---|---|---|
| Language (Hebrew / English) + RTL | **per-user** | `user_preferences.language` | Drives text direction |
| Theme (light / dark / system) | **per-user** | `user_preferences.theme` | Follows the design system |
| Measurement units (ml / oz) | **per-user** | `user_preferences.units` | Lossless display choice — see rationale |
| Day-start time | **per-child** | `children.day_start` | Per-child day boundary. **Not exposed on this screen in MVP** (apply deferred) — see `settings-scoping-decisions.md` |

Rationale — **units are per-user**: feeding amounts are stored canonically in
millilitres (`events.metadata.amount`), so ml ⇄ oz is a lossless conversion of the
*same* physical quantity — exactly like the UTC-store / local-display timezone
principle. Each parent can view (and input) in their own unit without ever making the
shared number contradictory, so it is personal chrome, not shared data.

Rationale — **day-start is per-child**: it is not a transform of a single value but an
*aggregation boundary* deciding which events fall into "today". It is a fact about the
baby's routine (not a parent preference), matches the category leader (Huckleberry
sets it on the Child Profile), and is required for multi-child families. It therefore
lives on `children`, not per-user or per-family. Full reasoning, debate, and sources:
`settings-scoping-decisions.md`. The wall-clock timezone follows the **device** (not a
stored value) — see the CLAUDE.md timezone principle.

### 3.4 🔔 Notifications  (per-user, **preferences only in MVP**)

| Item | Scope | Source |
|---|---|---|
| Feeding / sleep reminders | per-user | `user_preferences.notif_*` |
| Daily summary | per-user | `user_preferences.notif_daily_summary` |

**MVP scope:** build only the preferences UI + persistence (toggles saved to DB).
No push-delivery mechanism is built now — CLAUDE.md explicitly defers push
notifications. The stored toggles are read later when the delivery layer is added.

## 4. Data model

### 4.1 New table: `user_preferences`  (per-user)

One row per user. RLS: a user can select/update **only their own** row.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid (PK, FK → auth.users) | one row per user |
| display_name | text (nullable) | |
| language | text | `'he'` \| `'en'`, default `'he'` |
| theme | text | `'light'` \| `'dark'` \| `'system'`, default `'system'` |
| units | text | `'ml'` \| `'oz'`, default `'ml'` — personal display unit (amounts stored canonically in ml) |
| notif_feeding | boolean | default false |
| notif_sleep | boolean | default false |
| notif_daily_summary | boolean | default false |
| updated_at | timestamptz | |

### 4.2 Table: `family_settings`  (empty placeholder)

**Current state:** a deliberately **empty placeholder**, kept as a home for a future
genuinely per-family setting. It was originally created for `units` + `day_start`, but
both left (units → per-user, day_start → per-child), and it turned out there is **no
genuinely per-family setting** yet.

| Column | Type | Notes |
|---|---|---|
| family_id | uuid (PK, FK → families) | one row per family |
| updated_at | timestamptz | |

> **Scope revisions** (full reasoning + sources in `settings-scoping-decisions.md`):
> - `units` → moved to `user_preferences` (per-user), migration
>   `20260804000000_move_units_to_user_preferences`.
> - `day_start` → moved to `children` (per-child), migration
>   `20260804000001_day_start_to_children`.
> - The table is **kept** (not dropped) as a placeholder (decided).

The row is created (with defaults) when the family is created, or lazily on first read.

RLS: only members of the family (via `family_members`) can select; only members can
update. Follows the standard family-sharing RLS pattern.

### 4.3 Migrations & realtime

- Every schema change is a Supabase CLI migration committed to the repo (per CLAUDE.md).
- `user_preferences` does **not** need realtime (a user's own device).
- `family_settings` does **not** get realtime in MVP (**decided**). A units /
  day-start change is extremely rare, so it simply appears on the other parent's
  next load. Add to the `supabase_realtime` publication only if a future need arises.

## 5. Language / RTL note

The app is Hebrew-first (RTL). The `language` preference drives both copy and text
direction. Default `'he'`. This ties into a future i18n layer — out of scope for the
first Settings build beyond storing and applying the preference.

## 6. Destructive & sensitive actions

- **Log out** — confirm; clears the Supabase session.
- **Delete account** — **decided: "leave only".** Deleting an account removes the
  user from `family_members`; it does **not** delete the family, child, or events.
  - If another parent remains, they keep full access to all shared data.
  - If this was the **last** member, the family/child/events become orphaned. Cleanup
    of orphaned families is handled as a **separate** task (not part of this MVP
    build) — the delete flow itself only removes the membership + the user's
    `user_preferences` row and calls Supabase Auth delete.
  - UI: double-confirm, and state plainly that shared data stays for the other parent.

## 7. Resolved decisions

1. **Family-scoped storage** → dedicated `family_settings` table keyed by `family_id`
   (§4.2).
2. **Delete-account semantics** → "leave only"; shared data survives for a remaining
   parent; orphaned-family cleanup is a separate task (§6).
3. **Realtime for family settings** → not in MVP (§4.3).

No open questions remain for the MVP build of this screen. (Orphaned-family cleanup
and the token-validity session policy in §8 are tracked as their own tasks.)

## 8. Related / deferred

- **Token-validity session policy** (raised by Netanel, to spec separately): on app
  entry, check the existing token's validity instead of forcing re-auth every time;
  only prompt login when the token is expired / can't be refreshed. Interacts with
  the Log-out flow here. Tracked as a separate spec task.
