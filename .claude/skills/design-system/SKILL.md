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
