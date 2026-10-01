# 06 — Design System Requirements

This document extends the existing rules in `docs/DESIGN_RULES.md`,
`docs/COMPONENT_RULES.md`, `docs/COLOR_THEME_SPEC.md` and
`docs/PAGE_QUALITY_GATE.md`. Those stay authoritative for the visual language;
this one defines what must exist for a **_connected_** product, and what must not
be invented per page.

## 1. The rule that matters most

> **The same thing must look and behave the same everywhere.**

The repository contains 16 stylesheets (`src/myschool-clean.css`,
`src/compact-*.css`, `src/card-system.css`, `src/image-card-system.css`,
`src/dashboard-v2.css`, `src/admin.css`, `src/cbt-engine.css`,
`src/student-dashboard.css`, `src/hub*.css`, `src/edu-portal.css`,
`src/home-card-first.css`, `src/data-control.css`, `src/theme.css` …). That is a
consequence of fast iteration, not a plan. The 2026-09-30 audit warned about
exactly the cascade problem this creates, and the September audit before it made
the same point.

**Decision: no new stylesheet, and no page-local class, without a documented
reason.** New work consumes existing tokens and components. Where a page needs a
variant, the variant is added to the shared component, not to the page.

## 2. Tokens

Source of truth: `src/styles/theme.css` plus the values documented in
`docs/COLOR_THEME_SPEC.md`. Required token categories (all must exist before new
UI work):

| Category | Tokens | Notes |
|---|---|---|
| Colour — brand | primary, primary-strong, primary-soft | Used for primary actions and active states |
| Colour — surface | background, surface, surface-muted, border (`#e2e8f0` in the current card language) | Cards are lightly bordered and lightly tinted |
| Colour — text | text, text-muted, text-inverse | Muted text must still pass contrast |
| Colour — status | success, warning, error, info | Never the only signal — always paired with an icon or label |
| Typography | display, h1, h2, h3, body, caption, label | One scale; pages do not set their own font sizes |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 | No arbitrary values in new components |
| Radius | card, control, pill | Card radius is consistent across the card family |
| Elevation | none / sm / md | Cards are bordered by default, not shadowed |
| Motion | duration-fast (120ms), duration-base (200ms), ease-standard | Respect `prefers-reduced-motion` |

## 3. Component inventory (existing)

Reuse before creating. Current shared components:

**Shell and layout** — `HubLayout`, `HubSideRail`, `PageBar`, `BrandLogo`,
`Skeleton`.

**Content and service cards** — `ServiceCard` (whole card is the link),
`CardIdentityMark` (official statutory emblems: JAMB, WAEC, NECO, NELFUND,
NABTEB, NYSC — never substitute a generic icon), `ExamSimulatorGrid`,
`NewsSections` (`NewsRow`, `FeaturedNews`, `TrendingNews`, `newsThumbFor`),
`SectionHead`, `FilterPills`.

**Exam and tools** — `CbtResultSlip`, `ScientificCalculator`,
`dashboard/CgpaCalculatorCard`, `dashboard/SchoolFinderCard`.

**Admin** — `AdminKit` (`StatusBadge`, `Metric`, `TableSkeleton`,
`RowSkeleton`, `AdminEmptyState`, `AuditTimeline`, `BarStat`, `SectionLabel`,
`RequestActions`, `TimeAgo`, `useAdminHealth`), `AdminRichTextEditor`,
`AdminNewsroomQueue`.

**Missing and required** (create only when a second real use appears):
`EduButton` variants beyond the existing admin/card actions, `EduToast` (current
feedback is inline banners — acceptable, but must not be duplicated per page),
`EduPagination` (only if a list exceeds one screen), `CBTOption`,
`CBTTimer` (currently embedded in the practice page — extract when a second CBT
surface needs them).

## 4. State completeness

Every data-driven view defines all five states. No exceptions, no blank panels.

| State | Requirement |
|---|---|
| Loading | Skeleton or labelled busy indicator matching the final layout (avoid layout shift) |
| Success | Real data; numbers traceable to a record the user can open |
| Empty | Plain explanation of why there is nothing **plus** the next useful action |
| Error | Human message from `userFacingError`, a retry where retrying can help, and no internal detail |
| Offline | Shell renders; actions requiring the network say so; queued CBT answers re-sync |

`docs/PAGE_QUALITY_GATE.md` remains the sign-off gate for a page; this table is
the subset that fails most often and must be verified in every review.

## 5. Responsive rules

Per `docs/DESIGN_RULES.md`, unchanged and mandatory:

- Desktop 1280–1440: 3–4 compact cards per row.
- Tablet 768–1024: 2 cards per row.
- Mobile 360–480: 1 card per row, sticky compact navigation, **zero horizontal overflow**.

Additional requirements from the audit's mobile findings: test at 375 and 390
explicitly (the `/schools` overflow defect lived here), verify touch targets of at
least 44×44 px, verify tables degrade to stacked cards on mobile (the admin
console is desktop-first but operational staff do use phones), and verify the CBT
question view at 360 px with the timer and options visible without scrolling
sideways.

## 6. Accessibility requirements

Target: WCAG 2.2 AA for public and student surfaces, and for the CBT hall.

| Area | Requirement |
|---|---|
| Keyboard | Every action reachable, logical tab order, no keyboard trap in modals, Escape closes |
| Focus | Visible `:focus-visible` outline on all interactive elements; focus moves into modals and returns to the trigger on close |
| Forms | Every input has a real `<label>`; errors are announced (see below) with a text message, not colour alone |
| Errors | Error text is programmatically associated with the field and announced to screen readers |
| Semantics | `<button>` for actions, `<a>` for navigation; icon-only controls need accessible names |
| Headings | One `h1` per screen; hierarchy without skipped levels |
| Contrast | 4.5:1 body text, 3:1 large text and UI boundaries |
| Motion | Respect `prefers-reduced-motion` for transitions and confetti-style effects |
| CBT specifics | Question and options are navigable and selectable by keyboard; the timer announces its state without stealing focus; progress is conveyed by text as well as visual bar; the answer-sheet grid is a real list of buttons, not clickable divs |
| Colour independence | Status badges always carry a label; success/error never rely on colour alone |

## 7. Content and tone rules for UI copy

1. Say what will happen before it happens ("We will open the official NELFUND
   portal in a new tab").
2. Never promise an outcome the official body controls.
3. Empty states explain, they do not apologise excessively.
4. Error messages state the next action ("Check your connection and try again"),
   never the internal cause.
5. Numbers shown to students are real. If a count is unavailable, say so rather
   than showing zero.

## 8. Adding to the design system

A new shared component is justified only when the same pattern appears (or is
about to appear) in at least two places. To add one:

1. Confirm no existing component covers it (`COMPONENT_RULES.md` question).
2. Put it in `src/components/` with explicit TypeScript props.
3. Use tokens, not literal values.
4. Implement all five states where it is data-driven.
5. Test it in its real route context — not in isolation.
6. Add it to the inventory table above.
