---
name: typescript-conventions
description: Defines TypeScript and project structure conventions (naming, file organization, error handling patterns) for the baby-tracker app. Use whenever writing or modifying any TypeScript/React code in this project.
---

# TypeScript & Project Conventions - Baby Tracker App

## Strict Typing
- `strict` mode is enabled in `tsconfig.json` and must stay enabled.
- No `any` type. If a type is genuinely unknown, use `unknown` and narrow it properly.
- Supabase query results must use generated or explicitly defined types, never untyped objects accessed with bracket notation.

## Naming Conventions
- Components: `PascalCase` (e.g. `DailyClock.tsx`, `FeedingButton.tsx`)
- Functions, variables, hooks: `camelCase` (e.g. `useFilteredEvents`, `nextFeedingEstimate`)
- Custom hooks always start with `use` (e.g. `useChildEvents`)
- Types/interfaces: `PascalCase`, no `I` prefix (e.g. `Event`, not `IEvent`)
- Files containing a single component are named after that component; files with multiple utilities use descriptive lowercase names (e.g. `dateHelpers.ts`)

## File & Folder Structure
- Group by feature, not by file type: e.g. `features/today/`, `features/insights/`, `features/health/` - each containing its own components, hooks, and types - rather than one giant `components/` folder for the whole app.
- Shared/reusable UI primitives (buttons, cards, etc. from shadcn/ui) live in a `components/ui/` folder, separate from feature-specific components.
- One component per file, matching the component's name.

## Error Handling Pattern
- Every async call to Supabase follows the same pattern: check for an error object explicitly, handle it (log + user-facing message), and only then use the data.
- Never assume a Supabase call succeeded without checking its error field.
- User-facing error messages are short, plain-language, and never expose raw error text or stack traces.

## React/Component Conventions
- Functional components only, using hooks - no class components.
- Data fetching/caching goes through TanStack Query (React Query), not ad-hoc `useEffect` + `useState` data-fetching patterns.
- Form/input validation uses Zod schemas, defined once per data shape and reused, not inline ad-hoc checks scattered across components.
- Props are explicitly typed with an interface per component, even for simple components.

## What NOT to Do
- Do not duplicate a type definition that already exists elsewhere - import and reuse it.
- Do not bypass TanStack Query to fetch data directly in a component "just this once."
- Do not leave TODO comments without a clear description of what's missing and why it wasn't done now.

## When This Skill Should Trigger
Any time TypeScript or React code is being written or modified anywhere in this project.
