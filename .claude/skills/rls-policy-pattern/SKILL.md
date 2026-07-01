---
name: rls-policy-pattern
description: Defines how Row Level Security (RLS) policies must be written for every table in this project's Supabase database, based on the family-sharing data model. Use whenever creating a new table, or creating/modifying any RLS policy.
---

# RLS Policy Pattern - Baby Tracker App

## Core Rule
A user may view or edit a row only if that row belongs (directly or transitively) to a `family` they are a member of, according to the `family_members` table. This is the single security boundary for the entire app - there is no other access control layer (no custom backend checks this).

## Data Model Recap
- `families` - the family unit
- `family_members` - links a `user_id` (from `auth.users`) to a `family_id`, with a `role` ("parent" / "caregiver")
- `children` - belongs to a `family_id`
- `events` - belongs to a `child_id` (which belongs to a `family_id`)

## Required Policy Pattern
For any table with a direct `family_id` column (e.g. `children`):
```sql
-- Example pattern, adapt table/column names as needed
create policy "members can access their family's rows"
on <table_name>
for all
using (
  family_id in (
    select family_id from family_members where user_id = auth.uid()
  )
);
```
## Required Grants (in addition to RLS)

As of the current Supabase platform default, RLS alone is not enough - new tables also require an explicit Postgres GRANT before any role can access them at all. GRANT and RLS are two separate layers: GRANT controls whether a role can touch the table at all; RLS controls which rows it sees once it's in. Every new table must include both, in the same migration:

```sql
grant select, insert, update, delete on <table_name> to authenticated;
```

Without this grant, a correct RLS policy has no effect - the request is rejected before RLS is even evaluated, and the app will see "permission denied" errors instead of working correctly.
For any table that references family indirectly through another table (e.g. `events` -> `children` -> `families`):
```sql
create policy "members can access events for their family's children"
on events
for all
using (
  child_id in (
    select id from children where family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  )
);
```

## Non-Negotiable Rules
1. **Every new table must have RLS enabled** (`alter table <table> enable row level security;`) - a table with RLS disabled is a critical security bug in this project, not a minor oversight.
2. Every new table must also have an explicit GRANT to the `authenticated` role (select, insert, update, delete as appropriate) - bundled in the same migration as the RLS enable statement and policy. A table with RLS but no grant is just as broken as a table with no RLS at all, just in the opposite direction (it will deny everyone, including legitimate users).
3. **Every new table must have an explicit policy before any frontend code reads or writes to it.** Do not write frontend code against a table that doesn't have its RLS policy defined and tested yet.
4. Policies must be tested with at least two different users from two different families before being considered done: confirm User A cannot see or modify User B's family's data.
5. Do not write `using (true)` or any policy that grants blanket access "temporarily" - if a policy can't be written correctly yet, the table should remain inaccessible rather than open by default.
6. `created_by` fields should be set automatically (e.g. via a default of `auth.uid()`), not trusted from client input.

## When This Skill Should Trigger
Any time a new table is created in Supabase, or any time an existing RLS policy is created, reviewed, or modified.
