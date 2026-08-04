# Project: Baby Tracking & Planning App

## Overview
A web app for parents to track a baby's day-to-day life - sleep, feeding, mood, growth - with a strong focus on a fast, visual, uncomplicated interface. This is not a "reports" app - it's a tool that should feel pleasant to use one-handed, even at 3am.

The user (Netanel) is an experienced fullstack developer (Java/Spring/MongoDB + React/TS) but **on this project he is not writing code himself** - he is directing and managing Claude Code, which builds the actual code. His goal is to develop skills in managing/directing an AI coding agent, not to practice coding.

## Guiding Principles
- **Fast input** - every logging action should take one or two taps, no forms
- **Visual before textual** - graphs, a daily clock face, colors - not tables of numbers
- **No "black box" / overcomplicated AI** - the AI insights feature surfaces simple, occasional comparisons (personal data vs. age norms), not deep psychological analysis or constant chatter
- **Sharing between parents is a core requirement** - both parents (or a caregiver) need to see and log to the same data, from any device
- **Design tone**: one consistent design system applied across every screen (colors, typography, spacing). Professional and distinctive, not generic/template-looking - but animations must be minimal and purely functional (brief feedback on tap), never decorative. The bar is "looks impressive but never busy or distracting"

## CRITICAL: Code Quality Standard (applies to every single task, no exceptions)
All code built for this project - by Claude Code or otherwise - must be professional, consistent, and uncompromising in quality. Follow widely-accepted conventions and high standards (naming, structure, error handling, typing) at all times throughout the entire project. This is a standing instruction that overrides any temptation to take shortcuts for speed. This includes secrets handling: the Supabase project URL and anon key live only in a `.env` file, which is explicitly listed in `.gitignore` - never hardcoded in source or committed to the repo.

## Tech Stack (decided)
- **Frontend**: React + TypeScript
- **Backend/DB**: Supabase (BaaS) - Postgres + Auth + Realtime + Storage, **no custom backend server that we maintain**
- Most logic is frontend calls directly to the Supabase SDK
- **Exception**: the AI Insights feature requires one Supabase Edge Function (a small managed serverless function, not a maintained server) to safely call an external AI/search service without exposing API keys in the frontend. This is the only planned exception to the "no backend code" principle.
- Access control for family data is handled via **Row Level Security (RLS)** in Supabase, not custom backend code
- **Schema management**: every schema change (table, column, RLS policy) is written as a `Supabase CLI` migration file committed to the repo - never done manually via the Dashboard.
- **Realtime**: live sync between parents is NOT automatic. Each table that needs it must be explicitly added to the `supabase_realtime` publication (Dashboard toggle or `alter publication supabase_realtime add table <table>;`), as a separate step from creating the table and its RLS policy.

## Data Model (initial schema for Supabase/Postgres)

### `families`
| Column | Type |
|---|---|
| id | uuid (PK) |
| name | text |
| created_at | timestamp |

### `family_members`
Links a user (managed by Supabase Auth) to a family.
| Column | Type |
|---|---|
| id | uuid (PK) |
| family_id | uuid (FK -> families) |
| user_id | uuid (FK -> auth.users) |
| role | text ("parent" only for MVP - see note below) |

**Note on "caregiver" role**: deliberately excluded from MVP. Restricted permissions for a caregiver are planned only in Phase 4 - adding the value now without enforcing any restriction would be misleading (a "caregiver" would silently get full parent-level access). Re-add `caregiver` only when Phase 4 actually implements its restrictions.

### `children`
| Column | Type |
|---|---|
| id | uuid (PK) |
| family_id | uuid (FK -> families) |
| name | text |
| birth_date | date |
| day_start | time (default '00:00') — per-child day boundary, see timezone principle below |
| created_at | timestamp |

### `events`
The core of the app - every logged event (sleep/feeding/diaper/mood).
| Column | Type |
|---|---|
| id | uuid (PK) |
| child_id | uuid (FK -> children) |
| type | text ("sleep" / "feeding" / "diaper" / "mood") |
| start_time | timestamp |
| end_time | timestamp (nullable - null = active timer) |
| created_by | uuid (FK -> auth.users) |
| metadata | jsonb (flexible: amount, feeding_type, mood_level, etc.) |
| created_at | timestamp |

**Key design decision**: `events` is a single flexible table for all event types, not separate tables per type. The `metadata` jsonb field allows adding new fields later without schema migrations.

### `family_invites`
Enables a second parent to join an existing family. See `user-flow-onboarding.md` for the full flow.
| Column | Type |
|---|---|
| id | uuid (PK) |
| family_id | uuid (FK -> families) |
| invited_by | uuid (FK -> auth.users) |
| token | text (unique) |
| created_at | timestamp |
| expires_at | timestamp |
| used_at | timestamp (nullable) |
| used_by | uuid (FK -> auth.users, nullable) |

RLS note: only existing family members can create an invite for their family. Anyone (even unauthenticated) can read a single invite by valid token (to validate it before signup), but not list all invites.

**Current product assumption (MVP)**: a user belongs to exactly one family. Multi-family membership is not supported yet.

**Timezone & day-boundary principle** (revised Aug 2026 — see reasoning below):
- All `timestamp` columns are stored in UTC (the database default). This never changes.
- The **wall clock** (how an instant is shown, and which local calendar day it falls on) is derived from the **device timezone** — whatever zone the viewing phone is set to — computed client-side, never from raw UTC. This replaces the earlier "always convert to Israel local time" rule.
- The **day boundary** ("what counts as today") is the child's local calendar day, offset by a per-child **`day_start`** setting (default midnight). `day_start` lives on `children` (per-child), not per-user or per-family.

**Why this scoping** (decided with Netanel, Aug 2026, after researching the category leader Huckleberry + timestamp best practices):
- **Device timezone, not a stored per-child zone**: "where the baby is *right now*" = where the logging phone is right now. Every major baby app (Huckleberry et al.) follows the device zone and adjusts immediately on travel; a stored per-child zone would show the wrong wall clock until manually updated. Storing UTC keeps aggregations stable across zone changes; only presentation converts.
- **`day_start` is per-child**: it is an aggregation boundary (it decides which events fall into "today" for summaries/Insights), so it fails the lossless test that made *units* per-user. It belongs to the baby's routine, not a parent's preference — Huckleberry sets it on the Child Profile. Per-child is also required for multi-child families, where a newborn and a toddler genuinely have different "days".
- Consequence: there is no genuinely per-family setting. `units` is per-user (`user_preferences`); `day_start` is per-child (`children`). The short-lived `family_settings` table is therefore removed.

Applying `day_start` and switching the hardcoded `Asia/Jerusalem` to the device zone is the day-boundary "apply" layer (tracked as settings debt in PROGRESS.md); the scoping above is the committed target.

## RLS Policies (must be defined before any frontend code)
Rule: a user can view/edit only events belonging to children that belong to a family they are a member of (via `family_members`).
Recommended build order:
1. Define tables
2. Define RLS policies
3. Test the policies (user A cannot see family B's data)
4. Only then - frontend code

## Planned MVP Screens (Phase 1)
1. **"Today" screen** - a 24-hour graphical clock (gradient-filled colored arcs: sleep/feeding/active time, subtle entrance animation only) + large logging buttons (🍼 😴 🧷 😊) + "next feeding estimate" combining the personal recent-gap average with age-appropriate recommended norms, and "next sleep estimate" based on a "wake window" concept (time since last sleep ended + age-appropriate recommended wake window) rather than a personal-average alone, since wake windows lengthen with age. Both estimates are sourced via the AI Insights backend, not a live call per estimate. See `screen-today-spec.md` for full detail.
2. **Week screen** - a more visually polished chart (custom-styled Recharts/D3, not default library look) of feeding/sleep across the week
3. **AI Insights tab** - 2-4 simple, plain-language insight cards (e.g. "this week's average sleep vs. typical range for this age"), refreshed periodically (e.g. weekly) via the Edge Function, not real-time chatter. Deliberately minimal - no extra dashboards here.
4. **Day comparison view** - select **any number of days** (not limited to 2) and see them side by side as small multiples or an overlaid chart - built on the existing `events` table, no new schema needed
5. **Multi-child support** - a child selector in the main UI when a family has more than one child; every query filtered by the selected `child_id`. The data model already supports this (`children` is its own table linked to `family_id`), so this is primarily a UI/query concern, not a schema change

## Near-Term Technical Addition (after a working app exists)
- **PWA installability** - manifest.json + a basic service worker so the app can be "installed" to a phone home screen. Does not affect the data model; added as a final layer on top of a working app.

## Future Expansion Phases (not MVP - to be planned later)
- Phase 2: Growth (WHO growth curves) + developmental milestones
- Phase 3: **Dedicated "Health" tab** - vaccination schedule (Israeli standard) expanded with appointment calendar (well-baby clinic / pediatrician visits), periodic growth-checkup reminders, and developmental-check reminders by age. Also includes diaper/formula inventory tracking with "runs out in X days" alerts (may live in this tab or a separate "Home" tab - to be decided when designing screens).
- Phase 4: Social tools - night-shift split tracking between parents, "SOS" quick-tips mode, daily WhatsApp-style summary, "caregiver" mode with restricted permissions
- Deferred (explicitly not now): smart push notifications (e.g. "vaccination due", "inventory low"), offline mode with local caching/sync

## Future Features Agreed On But Not Yet Built
- **Google Photos Picker API**: attaching photos to milestones/weekly highlights. Important: this is NOT automatic pulling - it requires an active picker flow from the user each time, and Google's base URLs expire after 60 minutes (photos must be saved to our own storage - S3/Cloudinary - immediately after selection)
- **An interesting AI feature** - now partially defined as the AI Insights tab above; may be expanded further later

## How to Work With Claude Code on This Project
- Every task given to Claude Code should be small and focused (one table, one RLS policy, one component) - not "build everything"
- After each task, verify it actually works (e.g., create an event from 2 different users in the same family, and confirm both see it) before moving to the next task
- **Keep the NotebookLM source in sync**: whenever `PROGRESS.md` is updated at the close of a task, also refresh the Google Drive doc `baby-tracker – project state (for NotebookLM)` (Drive file id `1I3kMwcaj-bOgFFaTyohxZl07BGvTSgzT3iuUABpKdJE`, in the "baby tracker" folder) with the same state, via the Google Drive connector. This is a plain-language mirror of `PROGRESS.md` that Netanel adds as a source in NotebookLM and refreshes with "Sync with Google Drive". GitHub/`PROGRESS.md` remains the single source of truth; the Drive doc is a derived copy, so overwrite it rather than editing it by hand.