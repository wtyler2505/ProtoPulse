# ADR-0005: shadcn/ui with Dark Neon Cyan Theme

**Status:** Accepted
**Date:** 2026-01-15 (retroactive)
**Deciders:** Tyler

## Context

EDA tools require a dense, information-rich UI with consistent styling across 40+ component types. The design language must support long working sessions (dark mode essential) and convey technical precision.

## Decision

Use shadcn/ui (New York variant) as the component foundation with a custom dark theme featuring Neon Cyan (`#00F0FF`) as the primary accent color. Components are copy-pasted into the project (not installed as a package), giving full control.

## Rationale

- **Full ownership**: Unlike Ant Design or MUI, shadcn/ui components live in our codebase. We can modify internals without fighting an upstream API.
- **Tailwind v4 integration**: Built on Tailwind CSS — consistent utility-class approach, excellent dark mode support via CSS variables.
- **Radix UI primitives**: Accessible by default (keyboard navigation, ARIA attributes, focus management).
- **Dark theme for EDA**: Engineers spend hours in EDA tools — dark backgrounds reduce eye strain. Neon cyan provides high-contrast callouts without the "gamer" feel of full neon palettes.

## Consequences

- **40+ UI primitives**: Large component surface to maintain, but changes are rare.
- **Bundle size**: Radix UI adds vendor weight (159KB chunk) — mitigated by code splitting (TD-24).
- **No built-in design tokens**: Theme consistency relies on disciplined use of CSS variables and `cn()` utility.
