---
name: rls-policy-pattern
description: Defines how Row Level Security (RLS) policies must be written for every table in this project's Supabase database, based on the family-sharing data model. Use whenever creating a new table, or creating/modifying any RLS policy.
---

# RLS Policy Pattern - Baby Tracker App

## Core Rule
A user may view or edit a row only if that row belongs (directly or transitively) to a `family` they are a member of, according to the `family_members` table. This is the single security boundary for the entire app - there is no other access control layer (no custom backend checks this).

## Data Model Recap
- `families` - the family unit
- `family_members` - links a `user_id` (from `auth.users`) to a `family_id`, with a `role` (`'parent'` only for MVP; `caregiver` is deliberately excluded until Phase 4 enforces its restrictions)
- `children` - belongs to a `family_id`
- `events` - belongs to a `child_id` (which belongs to a `family_id`)

## Resolve membership via `auth_user_family_ids()` — not an inline subquery

Membership is resolved through a `security definer` helper function, **`auth_user_family_ids()`**, which returns the set of `family_id`s the current user belongs to. It was introduced in `supabase/migrations/20260712000000_fix_family_members_rls_recursion.sql` to avoid infinite RLS recursion: an inline `select family_id from family_members where user_id = auth.uid()` inside a policy re-triggers `family_members`' own RLS and recurses. Always call the helper instead:

```sql
using (family_id in (select auth_user_family_ids()))
```

## Required Policy Pattern

Split every policy **per command** (`for select` / `for insert` / `for update` / `for delete`) — do **not** use a single `for all`. A `for all ... using (...)` policy reuses its `using` clause as the INSERT `with check`, and a just-created row often isn't linked to the user's family yet, so that silently breaks row creation (this actually happened — see `20260713000000_families_insert_policy.sql`). `insert` and `update` therefore need their own explicit `with check`. Write the changes idempotently (`drop policy if exists ...` before each `create policy ...`) so a migration applies cleanly over partial prior state, as the existing migrations do.

For a table with a **direct `family_id` column** (e.g. `children`):
```sql
create policy "members can view their family's rows"
  on <table_name> for select
  using (family_id in (select auth_user_family_ids()));

create policy "members can insert rows for their family"
  on <table_name> for insert
  with check (family_id in (select auth_user_family_ids()));

create policy "members can update their family's rows"
  on <table_name> for update
  using (family_id in (select auth_user_family_ids()))
  with check (family_id in (select auth_user_family_ids()));

create policy "members can delete their family's rows"
  on <table_name> for delete
  using (family_id in (select auth_user_family_ids()));
```

For a table that references family **indirectly** through another table (e.g. `events` -> `children` -> `families`), use the transitive form in every clause, following the same per-command split:
```sql
create policy "members can view their family's events"
  on events for select
  using (
    child_id in (select id from children where family_id in (select auth_user_family_ids()))
  );
-- ...plus matching for insert (with check), update (using + with check),
-- and delete (using), each with the same child_id -> children -> family subquery.
```

## Required Grants (in addition to RLS)

As of the current Supabase platform default, RLS alone is not enough - new tables also require an explicit Postgres GRANT before any role can access them at all. GRANT and RLS are two separate layers: GRANT controls whether a role can touch the table at all; RLS controls which rows it sees once it's in. Every new table must include both, in the same migration:

```sql
grant select, insert, update, delete on <table_name> to authenticated;
```

Without this grant, a correct RLS policy has no effect - the request is rejected before RLS is even evaluated, and the app will see "permission denied" errors instead of working correctly.

## Non-Negotiable Rules
1. **Every new table must have RLS enabled** (`alter table <table> enable row level security;`) - a table with RLS disabled is a critical security bug in this project, not a minor oversight.
2. Every new table must also have an explicit GRANT to the `authenticated` role (select, insert, update, delete as appropriate) - bundled in the same migration as the RLS enable statement and policy. A table with RLS but no grant is just as broken as a table with no RLS at all, just in the opposite direction (it will deny everyone, including legitimate users).
3. **Every new table must have an explicit policy before any frontend code reads or writes to it.** Do not write frontend code against a table that doesn't have its RLS policy defined and tested yet.
4. Policies must be tested with at least two different users from two different families before being considered done: confirm User A cannot see or modify User B's family's data.
5. Do not write `using (true)` or any policy that grants blanket access "temporarily" - if a policy can't be written correctly yet, the table should remain inaccessible rather than open by default.
6. `created_by` fields should be set automatically (e.g. via a default of `auth.uid()`), not trusted from client input.

## When This Skill Should Trigger
Any time a new table is created in Supabase, or any time an existing RLS policy is created, reviewed, or modified.
