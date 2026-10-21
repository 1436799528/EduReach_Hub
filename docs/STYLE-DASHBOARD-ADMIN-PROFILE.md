# EduReach Hub — Style used for Dashboard, Admin & Profile

One design system serves all three areas. Tokens live in `src/styles/theme.css`
(`--er-*`), full spec in `docs/COLOR_THEME_SPEC.md`. No area has its own palette.

## Shared foundation (all three)
| Token | Value | Used for |
|---|---|---|
| `--er-primary` | `#174A3A` deep green (hover `#123A2D`, pressed `#0E3025`) | **Only** primary-button fill; selected/active states; links; focus ring |
| `--er-crimson` | `#B14933` (deep `#B3331A`) | Brand accent only: logo/wordmark, eyebrows, identity marks, unread-notification badge — never the current-nav state or default button |
| `--er-navy` | `#0F172A` | Headings, dark shells (admin sidebar, exam bar, footer) |
| `--er-tangerine` | `#D2732A` | Small secondary highlights only |
| Status | success `#166534`, warning `#92400E`, error `#B91C1C`, info `#1D4ED8` (each on its pale bg) | Semantic states only, never actions |
| Font | `Inter, Arial, sans-serif` (`--er-font-sans`) | Everything; weights on the shared type scale in `src/styles/type-system.css` |
| Background/surface | `#FAF8FF` bg, `#FFFFFF` cards, soft surfaces `#F2F3FF/#EAEDFF` | Page and card surfaces |

Rules enforced by tests (`brand-colors`, `type-system`, `touch-targets`, `a11y`):
white on green = 10.11:1; coarse-pointer targets ≥44px; visible focus ring
(`src/styles/a11y.css`, loaded last); primary buttons defined once in
`src/styles/brand-actions.css` (loaded after component sheets).

## 1. Student Dashboard — `pages/StudentDashboardV2.tsx`
CSS: `src/student-dashboard.css` + `src/dashboard-v2.css` (classes `edureach-dash-*`, `dash-*`).
- **Layout:** sticky top header (brand → home, service search, notification Bell
  with crimson unread badge — no badge at zero, profile menu) → desktop **left
  sidebar** (`edureach-dash-sidebar`, green selected surface) → mobile **bottom nav**.
- **Cards:** white `dash-card`, 14px-ish radius, hairline border, small icon+title
  header (`dash-card-title`), rows (`dash-row`), metric labels in muted caps.
- **Buttons:** `dash-btn dash-btn-primary` (green), `dash-btn-secondary` (white, green edge).
- Tabs: Overview · My Requests · My CBT · Tools & Saved (`?/dashboard/*` routes alias to them).

## 2. Admin Console — `pages/AdminLayout.tsx` + `pages/Admin*.tsx`
CSS: `src/admin.css` (classes `admin-*`), shared kit `src/components/admin/AdminKit.tsx`.
- **Layout:** dark navy (`#0F172A`) **left sidebar** 270px (230px ≤1050px), grouped
  nav (Content/Services/Academics/Examinations/Users/Analytics/Site), sticky topbar
  with API health pill, content max-width 1440px. Mobile (≤780px): sidebar stacks,
  nav becomes **one scrollable 44px row**.
- **Selected nav:** green surface `#174A3A` with pale-green inset bar (crimson is
  brand-only; `--admin-orange` variable is a legacy name for `#B14933` crimson).
- **Components:** `admin-page-header` (title + contextual action), KPI cards,
  tables in `admin-table-wrap` (horizontal scroll on mobile, 640px min table),
  status pills, health card in sidebar footer. Role/capability gating unchanged.

## 3. Profile — `pages/ProfileCompletionPage.tsx` (`/profile`, `/profile/complete`)
CSS: shared hub styles (`src/edu-portal.css`, `hub-*` classes) — deliberately the
public-site look, since it is a student-facing account page, not a console.
- **Layout:** `HubLayout` (site header/footer), centred 780px column, white
  `profile-summary-card` with avatar/initials, `profile-summary-grid` of fields;
  edit mode is a sectioned form (`profile-contact-section`, hub form labels/inputs).
- Crimson is used only for small icon accents; the primary action ("Edit Profile",
  save) is the green `hub-primary-btn`.

## Service-guide steps (fixed 2026-10-21)
Step cards (`.er-service-guide-step`, alternating 170px image left/right) must
show the action the step describes. `waec-result.jpg` (a "No WAEC Result?"
admission graphic) and `graduates.jpg` (graduation celebration) were removed
from guides; step-matched images live in `public/news/photos/step-*.jpg`.
Guarded by `tests/service-guide-images.test.ts`.
