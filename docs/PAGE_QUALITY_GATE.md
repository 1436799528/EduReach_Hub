# EduReach — Page/Path Quality Standard & Quality Gate

> **MANDATORY PROJECT RULE:**
> **No EduReach page or path is complete until it passes the Global Design System, Project Architecture, Route, Accessibility, Responsive, Functional, Performance, Code, and Page-Specific Quality Gates.**
> A page is **not** considered complete simply because it renders.

Every route/path must inherit the same project architecture, design system, coding standards, and quality gates. We build one route completely, verify it, lock the pattern, then move to the next route.

---

## 1. Project Integrity

Every route must respect the existing EduReach architecture:

```text
src/
├── app/          # App entry and centralized route definitions
├── components/   # Shared, reusable UI components
├── pages/        # Route page views (single responsibility)
├── data/         # Single source of truth data models
├── lib/          # Helper logic, utilities, and API clients
├── styles/       # Centralized design tokens and stylesheets
└── types/        # Shared TypeScript interfaces and contracts
```

### Non-Negotiable Rules
* ❌ No random new folders.
* ❌ No duplicate components created for an existing component.
* ❌ No page-specific replacement for a global component unless genuinely necessary.
* ❌ No hard-coded service information when it belongs in `data/services.ts`.
* ❌ No random colors scattered through JSX inline styles.
* ❌ No repeated CSS values when a design token already exists.
* ❌ No duplicate service definitions.
* ❌ No page importing assets from another page's private folder.
* ✅ Shared elements belong in `components/`.
* ✅ Shared data belongs in `data/`.
* ✅ Business/helper logic belongs in `lib/`.
* ✅ TypeScript definitions belong in `types/`.
* ✅ Global visual rules belong in `styles/`.

---

## 2. Design System Integrity

Every route must look like **EduReach**. The page can have a different function, but it cannot invent a completely different visual language.

### Must Inherit:
* EduReach typography (Inter / system fonts, standard hierarchy)
* EduReach colors (Primary Academic Crimson `#D9381E`, Deep Crimson `#B51D04`, Institutional Navy `#0F172A`, Secondary Tangerine `#F97316`, Borders `#e2e8f0`) — see `docs/COLOR_THEME_SPEC.md` as the single source of truth. Success Green `#16A34A` and Trust Gold `#CA8A04` are reserved for status/verification only, never as primary brand color.
* EduReach spacing and density
* EduReach border radius (Standard 6px–10px, Pill 999px)
* EduReach shadows (Subtle `0 1px 3px rgba(15, 23, 42, 0.04)`)
* EduReach icon treatment
* EduReach compact card structure
* EduReach header/navigation (Normal clean header; three-dot menu on mobile only)
* EduReach responsive behavior
* EduReach interaction states (hover, focus, active, disabled)

---

## 3. Global Component Rule

Before creating any new UI element, always ask:
> **Does EduReach already have a component that does this?**
- If yes → **Reuse it.**
- If no → **Determine whether the new element should become a reusable component.**

### Standard Component Families:
* `<CardIdentityMark />` / `<BrandServiceCard />`
* `<ServiceCard />`
* `<HubLayout />` / `<HubSideRail />`
* `<WalletModal />`

### Anti-Pattern Ban:
❌ Do **NOT** create page-isolated variations (`<div className="jamb-special-card">`, `<div className="waec-special-card">`).  
✅ Use `<BrandServiceCard service={jamb} />` and `<BrandServiceCard service={waec} />`.

---

## 4. Page Structure Standard

Every standard EduReach page must follow a predictable, logical hierarchy:

```text
Page
│
├── Global Header (Logo | Search | Nav/Actions | 3-dot on Mobile)
│
├── Page Container (hub-container / max-width boundary)
│   │
│   ├── Page Header (Breadcrumb, H1, concise context)
│   │
│   ├── Main Content Area
│   │
│   └── Supporting Content / Side Rail
│
└── Global Footer
```

The template adapts to the function, while the design language stays constant.

---

## 5. One Page = One Primary Purpose

Every route must answer clearly:
> **What is the user here to do?**

* `/` → Portal gateway, news feed, and primary entry point
* `/services` → Browse and filter verified academic services catalog
* `/services/apply/:slug` → Submit a specific service application
* `/services/track` → Check real-time application processing status
* `/cbt` → Start timed exam simulator
* `/cbt/practice` → Take active CBT practice test session
* `/cbt/results` → Review test scores, corrections, and answers
* `/screening-calculator` → Calculate tertiary aggregate screening scores
* `/news` → Read verified educational announcements and noticeboard
* `/news/:slug` → Read detailed official announcement
* `/jobs` → Search student scholarships, grants, and opportunities
* `/login` & `/register` → Streamlined, privacy-focused student authentication
* `/profile/complete` → Complete academic institution, department, and preferences
* `/dashboard` → Comprehensive student workspace (applications, tests, saved, tools)

If a page starts becoming an incoherent collection of unrelated features, split it.

---

## 6. Card Standard

All cards must adhere to the compact EduReach card system:

```text
┌─────────────────────────────────┐
│  [icon]   Service Name       →  │
│           Short description     │
└─────────────────────────────────┘
```

* **Compact**: Information-dense, no giant bloated margins.
* **Clickable**: The card itself is the interaction.
* **Clean**: Lightly bordered (`#e2e8f0`), subtly tinted where appropriate.
* **Icon/Logo Driven**: Distinct service theme marks.
* **No Unnecessary CTA Buttons**: Avoid repetitive `[ APPLY NOW ]`, `[ LEARN MORE ]` inside every card.

---

## 7. Brand Service Standard

External examination bodies and statutory institutions must display their actual official identity assets:
* **JAMB** → Official JAMB emblem (`/icons/jamb.svg`)
* **WAEC** → Official WAEC emblem (`/icons/waec.svg`)
* **NECO** → Official NECO emblem (`/icons/neco.svg`)
* **NELFUND** → Official NELFUND student loan emblem (`/icons/nelfund.svg`)
* **NABTEB** → Official NABTEB emblem
* **NYSC** → Official NYSC emblem

EduReach-native services use standard EduReach iconography:
* Consultation, Past Questions, Scholarships, CGPA Calculator, School Finder.
* **Never recreate a branded organization's logo using random mismatched icons.**

---

## 8. Data Standard (Single Source of Truth)

All service metadata, categories, routes, and identifiers are centralized in:
```text
src/data/services.ts
```
Pages, search, headers, and dashboards must consume this single source of truth rather than hard-coding conflicting titles, routes, or categories.

---

## 9. Route Standard

Every route must fulfill:
1. **Valid Canonical URL**: Defined centrally in `src/app/routes.tsx`.
2. **Unique Page Identity**: Browser `document.title` updates dynamically on navigation.
3. **Browser Navigation**: Popstate back and forward buttons work cleanly.
4. **Deep Linking**: Direct URL entry in a fresh tab loads the exact target page.
5. **No Broken Routes**: Unknown paths resolve to a clean `404 / Page Not Found` view.

---

## 10. Accessibility Quality Gate

* Semantic HTML (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`).
* Logical heading hierarchy (exactly one meaningful `<h1>`).
* Accessible buttons and links with descriptive text or `aria-label`.
* Form controls have explicit `<label>` tags.
* Keyboard navigation and visible focus rings.
* Adequate color contrast (WCAG AA compliance).
* Touch target sizes of at least 38px–44px on mobile devices.

---

## 11. Form Quality Standard

Every form-driven interaction must handle the full lifecycle:
```text
Label → Input → Validation → Error State → Loading State → Success State
```
* Clear error feedback when validation fails.
* Inputs disabled during submission with a visible loading indicator.
* Never collect passwords, card PINs, banking credentials, or unnecessary sensitive PII (NIN/BVN) in registration forms.

---

## 12. State Standard

Every interactive component and page must account for all lifecycle states:
1. **Default**: Initial ready state.
2. **Loading**: Smooth skeletons or indicator.
3. **Empty**: Helpful explanation and action when zero records match.
4. **Error**: User-friendly failure message with a retry button.
5. **Success**: Clear confirmation and next step.
6. **Disabled**: Visually distinct non-interactive state.
7. **Active / Focus**: Clear feedback when interacting.

---

## 13. Responsive Quality Gate

Every page must be verified across standard screen breakpoints:
* **Desktop (1440px & 1280px)**: 3–4 compact cards per row; two-column portal layouts.
* **Laptop / Small Desktop (1024px)**: 3 compact cards per row.
* **Tablet (768px)**: 2 compact cards per row; mobile-friendly navigation.
* **Mobile (480px, 390px, 360px)**: 1 card per row; sticky compact navigation; zero horizontal scrollbar overflow.

---

## 14. Performance Quality Gate

* Route-level code splitting and lean bundling.
* Lightweight SVG/optimized icons; no massive uncompressed images.
* No loading heavy CBT engines or unneeded features on unrelated pages.
* No duplicate bundle dependencies.
* Build warning checks (`npm run build`).

---

## 15. Code Quality Gate

* **TypeScript**: Strict typechecking (`tsc --noEmit` / `npm run lint`) passes with **0 errors**.
* **Zero Dead Code**: No unused imports, commented-out blocks, or orphaned functions.
* **Clean Console**: No unhandled promise rejections or runtime React warnings.
* **Centralized Logic**: Common helpers in `src/lib/`, data in `src/data/`.

---

## 16. Two-Layer Route QA Framework

Every route undergoes two evaluation layers:
* **Layer A (Global EduReach QA)**: Brand, layout, navigation, cards, typography, responsive behavior, accessibility, performance, and code quality.
* **Layer B (Route-Specific QA)**:
  * **CBT**: Question countdown timer, answer selection, flag for review, submission, score calculation, corrections review.
  * **CGPA Calculator**: Unit weights, letter grade mapping (5.0 scale), real-time GPA, honours classification, reset action.
  * **Student Dashboard**: Auth session persistence, profile summary, applications tracking, saved bookmarks, security modal, device management.
  * **Auth & Profile**: 8-field registration validation, password confirmation, post-registration onboarding at `/profile/complete`.

---

## 17. Route Quality Scorecard & Status

| Area | Requirement |
|---|---|
| **Architecture** | Uses approved `src/` modular structure |
| **Design System** | Follows EduReach compact tokens and layout |
| **Layout** | Structured header, container, main, and footer |
| **Data** | Consumes centralized `src/data/` |
| **Routing** | Canonical URL, title update, deep linking, 404 |
| **Accessibility** | Semantic landmarks, keyboard navigation, contrast |
| **Responsive** | Verified from 360px mobile to 1440px desktop |
| **States** | Handles default, loading, empty, and error |
| **Performance** | Fast render, zero unnecessary bundle bulk |
| **Code** | 0 TypeScript errors, 0 unused imports |

### Status Definitions:
* 🟢 **PASS**: Fully verified against all global and route-specific gates.
* 🟡 **REVISE**: Functional but requires quality or styling refinement.
* 🔴 **BLOCKED**: Failing tests, broken route, or missing dependency.

---

## 18. Active Route Register

| Route | Canonical Path | Primary Purpose | Status |
|---|---|---|---|
| **Home** | `/` | Portal gateway, noticeboard, featured services | 🟢 PASS |
| **Services Catalog** | `/services` | Filterable academic service catalog | 🟢 PASS |
| **Service Apply** | `/services/apply/:slug` | Submit service application request | 🟢 PASS |
| **Service Tracker** | `/services/track` | Track application processing status | 🟢 PASS |
| **CBT Hall** | `/cbt` | Exam selection and practice starter | 🟢 PASS |
| **CBT Practice** | `/cbt/practice` | Active timed practice exam simulator | 🟢 PASS |
| **CBT Results** | `/cbt/results` | Scorecard corrections and answer review | 🟢 PASS |
| **Screening Calculator**| `/screening-calculator` | Admission screening aggregate estimation | 🟢 PASS |
| **News & Noticeboard** | `/news` | Campus news, JAMB/WAEC announcements | 🟢 PASS |
| **News Article** | `/news/:slug` | Full announcement article details | 🟢 PASS |
| **Scholarships / Grants**| `/jobs` | Student funding and scholarship directory | 🟢 PASS |
| **Authentication** | `/login`, `/register` | 8-field privacy registration & login | 🟢 PASS |
| **Profile Onboarding** | `/profile/complete` | Post-registration academic profile setup | 🟢 PASS |
| **Student Dashboard** | `/dashboard` | Personal student workspace & tools | 🟢 PASS |

---

## 19. The Build-Order Rule

```text
DESIGN SYSTEM
      ↓
SHARED COMPONENTS
      ↓
DATA MODEL
      ↓
ROUTE TEMPLATE
      ↓
PAGE
      ↓
PAGE-SPECIFIC FUNCTIONALITY
      ↓
QUALITY GATE (Scorecard)
      ↓
🟢 PASS
      ↓
NEXT ROUTE
```

Build one route completely, verify it against this checklist, lock the pattern, and then proceed to the next route.
