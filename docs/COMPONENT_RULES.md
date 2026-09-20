# EduReach — Component Rules & Architecture

## Core Philosophy

Before creating a UI element, always ask:
> **Does EduReach already have a component that does this?**
- If yes → **Reuse it.**
- If no → **Determine whether the new element should become a reusable component.**

## Architectural Rules

1. **Shared Components in `src/components/`**: Any pattern appearing across multiple pages belongs in `src/components/`.
2. **Centralized Data in `src/data/`**: Product catalogs, service maps, and static options belong in `src/data/`, not hardcoded inside page files.
3. **Single Service Card Family**:
   - `<CardIdentityMark />`: Resolves the appropriate brand emblem or service theme icon.
   - Standard compact service cards consume centralized metadata from `src/data/services.ts`.
4. **Typed Props & Contracts**: Every shared component must have explicit TypeScript interfaces.
5. **Intrinsic Responsiveness**: Layout components and cards must handle their own responsive adjustments rather than forcing pages to inject custom CSS overrides.
6. **No CSS Framework Duplication**: Avoid introducing competing CSS systems for individual routes. Use the global design tokens in `src/styles/` and `src/myschool-clean.css`.
7. **Accessibility First**:
   - Meaningful `aria-label` on icon-only triggers.
   - Semantic tags (`<button>`, `<a>`, `<input>`) instead of unclickable `<div>` listeners.
   - Visible `:focus-visible` outlines.

## Evaluation Gate

A component is only verified when tested in its actual route context. See `docs/PAGE_QUALITY_GATE.md`.
