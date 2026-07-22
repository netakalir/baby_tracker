---
name: design-system
description: Defines the visual design system (colors, typography, spacing, animation rules, component conventions) for the baby-tracker app. Use whenever creating or modifying any UI component, screen, or style, to ensure visual consistency across the entire app.
---

# Design System - Baby Tracker App

## Design Tone
Professional and distinctive - never generic or "default component library" looking - but never busy or cluttered. The bar: "looks impressive but never distracting." This app is used quickly, often one-handed, sometimes at 3am - clarity and speed always win over visual flourish.

## Animation Rules (strict)
- Animations are **functional only** - brief feedback confirming an action (e.g. a tap registered), never decorative.
- No animation should exceed ~200-300ms.
- No animation should repeat, loop, or play automatically without a user action triggering it.
- The daily clock visualization may have a single subtle entrance animation on load - nothing beyond that.
- If in doubt whether an animation is "functional" or "decorative", default to removing it.

## Visual Language
- The 24-hour clock view uses gradient-filled arcs per event type (not flat default colors). Each event type (sleep, feeding, diaper, mood) must have one consistent color/gradient used everywhere in the app - in the clock, in buttons, in charts, in legends. Never reuse a color across event types.
- Charts (week view, day comparison) must use custom styling - not the out-of-the-box look of the charting library. Invest in custom colors, rounded corners/caps, and clear labels over chart-library defaults.
- Typography: one consistent type scale across the app (a small number of font sizes/weights, reused everywhere - not ad-hoc sizing per screen).
- Spacing: use a consistent spacing scale (e.g. a fixed set of spacing values) rather than arbitrary pixel values chosen per component.

## Design Tokens (defined, do not redefine ad-hoc)
Implemented as Tailwind v4 `@theme` CSS variables in `src/index.css`. Reference these tokens (via Tailwind utility classes) rather than hardcoding hex/px values in components.

**Layout direction:** the app UI is Hebrew, RTL. The root `<html>` has `dir="rtl" lang="he"`. Do not build components assuming LTR flow.

**Color**
- Brand (primary actions, links, focus rings): `brand-50/100/300/500/600/700` - a muted indigo-violet (`#5b5bd6` at 500). `600` is the hover/active shade.
- Neutrals (warm gray, not pure gray): `neutral-0/50/100/200/400/600/800/900` - backgrounds, borders, body/secondary text.
- Semantic: `error-50` (background)/`error-500` (text/border) for validation and blocking errors; `success-500` for confirmations.
- Event-type colors (defined once with the Today screen; one consistent color per type, reused everywhere - clock arcs, quick-log buttons, future charts/legends - never reused across types):
  - `sleep-50/300/500` - indigo (`#6366f1` at 500): night/rest.
  - `feeding-50/300/500` - orange (`#f97316` at 500): milk/warmth.
  - `diaper-50/300/500` - cyan (`#06b6d4` at 500): clean, distinct from the warm tones.
  - `mood-50/300/500` - fuchsia (`#d946ef` at 500): expressive, distinct from feeding.
  - Per type: `50` = tinted button surface, `300` = lighter clock-gradient stop, `500` = solid accent. Reference the tokens (Tailwind classes or `var(--color-<type>-<step>)`), never hardcode the hex.

**Typography**
- Font: system font stack (`--font-sans`) - no webfont download, keeps the app fast at 3am.
- Scale: `text-xs` (0.75rem) → `text-sm` (0.875rem, default body) → `text-base` (1rem) → `text-lg` (1.125rem) → `text-xl` (1.375rem, section headers) → `text-2xl` (1.75rem, screen titles). Do not introduce sizes outside this scale.

**Spacing**
- Use Tailwind's default spacing scale (`p-4`, `gap-2`, etc.) consistently - never an arbitrary pixel value (`p-[13px]`).

**Radius**
- `radius-sm` (0.375rem) - inputs, small controls. `radius-md` (0.625rem) - buttons. `radius-lg` (1rem) - cards/panels.

**Motion**
- `duration-fast` (150ms) - button/tap feedback. `duration-base` (200ms) - the clock's single entrance animation. Never exceed `duration-base`.

## Component Conventions
- Primary logging buttons (🍼 😴 🧷 😊) must be large, high-contrast, and visually identical in style (size, shape, shadow/elevation) across all screens that show them.
- Every screen/tab in the app must use the same header style, the same card style, and the same spacing rhythm - a user should never feel like they "left the app" when moving between tabs.
- Use the project's chosen component base (Tailwind CSS + shadcn/ui) consistently - do not introduce ad-hoc one-off styling that bypasses the design tokens.

## What NOT to do
- Do not introduce a new color, font size, spacing value, or animation pattern for a single component "because it looks nice there" - if something new is genuinely needed, it should be added to this skill so it becomes consistent everywhere, not a one-off.
- Do not add loading spinners, skeleton screens, or transition effects beyond what's needed for basic functional feedback.
- Do not make charts or the clock view "busy" with excessive labels, gridlines, or decorative elements - prioritize the few numbers/shapes that matter most.

## When This Skill Should Trigger
Any time a new screen, component, button, chart, or visual element is being created or modified anywhere in this project.
