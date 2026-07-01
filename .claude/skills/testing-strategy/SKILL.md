---
name: testing-strategy
description: Defines the testing approach (Playwright E2E tests) and when tests are required in this project. Use whenever building a new user-facing feature, fixing a bug, or before marking any feature as complete.
---

# Testing Strategy - Baby Tracker App

## Core Principle
A feature is not "done" until it has a passing E2E test covering its main flow. Tests are written alongside the feature, not added later "when there's time" - there is never time later.

## Tooling
- **Playwright** is the testing tool for this project (chosen because the user already works with it professionally and can review test code even without writing it).
- Tests live in a dedicated `tests/` (or `e2e/`) directory, mirroring the structure of the features they test.

## What Must Be Tested
- **Every primary user flow**: logging an event (tap a button, confirm it appears on the "Today" screen), viewing the week chart, comparing days, switching between children.
- **Multi-user sharing behavior**: at least one test simulating two different users in the same family both interacting with the same data (e.g. one logs an event, the other sees it - this is the core value proposition of the app and must never silently break).
- **RLS boundaries**: at least one test confirming a user from Family A cannot see Family B's data. This overlaps with the `rls-policy-pattern` skill but should be verified at the application level too, not just in the Supabase dashboard.

## What Does NOT Need Exhaustive Testing (at this stage)
- Pure visual/styling details (covered by the `design-system` skill and manual review, not automated tests)
- The AI Insights feature's exact wording (test that it renders and doesn't crash, not the specific text it produces)

## Test Quality Standards
- Tests must not rely on arbitrary `sleep()`/timeout waits - use Playwright's built-in waiting mechanisms (`waitForResponse`, `waitForSelector`, etc.) for reliability.
- Flaky tests are treated as bugs, not ignored or retried blindly - if a test is flaky, the root cause (usually a race condition) must be fixed.
- Each test should be independent and runnable on its own, not dependent on a previous test's leftover state.

## When This Skill Should Trigger
Whenever a new feature is built, a bug is fixed, or a task is about to be marked complete (in coordination with the `code-review-checklist` skill).
