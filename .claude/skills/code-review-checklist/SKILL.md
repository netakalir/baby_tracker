---
name: code-review-checklist
description: A non-negotiable checklist that every piece of code in this project must pass before a task is considered complete. Use when finishing any coding task, before reporting a feature or fix as done.
---

# Code Review Checklist - Baby Tracker App

## Why This Skill Exists
This project has a standing rule: code must be professional, consistent, and uncompromising. This checklist makes that principle concrete and checkable, rather than a vague aspiration. No task is "done" until it passes this checklist - speed is never a reason to skip it.

## Checklist (run through all of these before reporting a task as complete)

### Types & Correctness
- [ ] No `any` types in TypeScript - every variable, prop, and return type is explicit or properly inferred
- [ ] No `@ts-ignore` or `@ts-expect-error` without a comment explaining exactly why it's needed
- [ ] All Supabase query results are typed (using generated types or explicit interfaces), not treated as loose objects

### Error Handling
- [ ] Every Supabase call (insert/update/select/delete) has explicit error handling - never assume success
- [ ] User-facing errors show a clear, simple message - never a raw error object or stack trace
- [ ] No empty `catch` blocks that silently swallow errors

### Consistency
- [ ] Naming follows the same convention as the rest of the codebase (e.g. camelCase for variables/functions, PascalCase for components)
- [ ] New UI elements follow the `design-system` skill (colors, spacing, animation rules) - no one-off styling
- [ ] New tables/policies follow the `rls-policy-pattern` skill

### Cleanliness
- [ ] No commented-out code left in place "just in case"
- [ ] No leftover `console.log` debugging statements
- [ ] No unused imports, variables, or files
- [ ] No hardcoded values that should be constants or config (e.g. magic numbers, repeated strings)

### Testing
- [ ] Per the `testing-strategy` skill, a new user-facing feature has at least one E2E test covering its main flow
- [ ] Existing tests still pass after the change (not just the new one)

### Security
- [ ] No new table without RLS enabled and tested
- [ ] No secrets, API keys, or tokens committed to the repository (check `.env` is in `.gitignore`)

## When This Skill Should Trigger
At the end of every coding task, before telling the user the task is complete - whether it's a new feature, a bug fix, or a refactor.
