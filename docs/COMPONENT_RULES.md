# EduReach Component Rules

## Purpose

This document defines how shared UI components are created, reused and extended across EduReach.

## Mandatory rules

1. Before creating a UI element, search the existing component library and styles for an equivalent.
2. Reuse an existing component when the behavior and visual role are the same.
3. Do not create page-local duplicates of shared primitives.
4. If a pattern appears on two or more routes, evaluate it for promotion into `src/components/`.
5. Shared visual tokens belong in the design-system/global style layer, not scattered through JSX.
6. Shared product data belongs in `src/data/`; business logic belongs in `src/lib/`; shared types belong in `src/types/`.
7. Brand services use their approved brand asset. EduReach-owned services use the EduReach icon system.
8. Service cards must consume the central service definition rather than repeating title, route, category or icon values.
9. A new component must have one clear responsibility and typed props.
10. Do not create a second component merely because a route needs a small visual variation. Prefer composition, variants or typed props.
11. Responsive behavior belongs to the reusable component when the behavior is intrinsic to that component.
12. Loading, empty, error, disabled, focus and success states should use shared primitives where they recur.
13. Do not hide route-specific business logic inside generic presentation components.
14. Do not introduce a new CSS framework, icon library or styling system for a single route without an architecture decision.
15. Do not delete an existing component solely because it appears unused until imports and route usage have been checked.

## Service-card rule

Use the established compact service-card family. The expected pattern is:

`<BrandServiceCard service={...} />`
or
`<ServiceCard service={...} />`

depending on the service type and the existing implementation.

Do not create route-specific equivalents such as `JambCard`, `WaecCard` or `NelfundCard` when the only difference is service data or branding.

## Review gate

A component change is not complete until its consumers are checked in their real route context. Reusable components are tested at both the component level and through at least one consuming route.
