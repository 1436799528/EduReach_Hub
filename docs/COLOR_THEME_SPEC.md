# EduReach Hub — Color & Theme Design Specification

## 1. Brand Theme

EduReach Hub is a modern academic support and student-services platform designed to make educational information, tools, examinations, admission services, funding opportunities, and student resources easy to discover and use.

The visual theme communicates:
* **Academic**
* **Trustworthy**
* **Modern**
* **Accessible**
* **Energetic**
* **Practical**
* **Student-focused**
* **Reliable**
* **Clear**
* **Organized**

The overall visual identity feels like a **modern student academic portal**, not a corporate website, advertising platform, or promotional agency.

The interface maintains a balance between:
**Institutional trust + student-friendly energy + practical simplicity.**

---

## 2. Core Color Palette

### Primary action — Logo Navy
* **HEX:** `#0A3E83` (token `--er-primary`)
* The colour of an action the student takes. It carries the meaning that used to
  be split between blue and crimson, and it is the only fill for a primary
  button.
* **States:** hover `#083570` (`--er-primary-hover`), pressed `#062B5C`
  (`--er-primary-active`), border `#083570` (`--er-primary-border`) stepping to
  `#072F64` and `#05264F`, selected surface `#EDF4FB` (`--er-primary-soft`)
  with edge `#CCE0F3` (`--er-primary-soft-border`).
* **Contrast:** white text on the fill measures **10.35:1** at rest, 11.98:1 on
  hover and 13.93:1 pressed; as text on white it is 10.35:1 and 9.33:1 on the
  selected surface. Every state clears AA (4.5:1) with a wide margin.
* **Use for:**
  - Primary buttons: Start practising, Past questions, Continue, Submit, Save
  - Primary links and the action inside a block
  - Selected states: filters, tabs, steps, answer options, the current question
  - Active progress indicators (page progress, the resume bar)
  - Form focus tint and `accent-color`
* **Never** for card surfaces, banners, exam identity marks or decorative
  section backgrounds.

### Logo accents — Blue and Red
* **Navy:** `#0A3E83` (`--er-brand-navy`), the primary action colour.
* **Blue:** `#1D9BE0` (`--er-brand-blue`) for large fills, gradients and
  decorative marks. For a blue icon or small label on a pale surface use the
  accessible ink `#0F6BAA` (`--er-brand-blue-ink`): 5.67:1 on white and 5.11:1
  on `#EDF4FB`.
* **Red:** `#E3232D` (`--er-brand-logo-red`) is the wordmark's red. It is a
  brand mark, not the error colour and not a button fill; errors stay `#B91C1C`.
* The header search, mobile navigation, state, notification, profile and auth
  icons use the blue ink. Icons are not left at a neutral grey when colour
  carries the brand.

### Brand accent — Crimson
* **HEX:** `#B14933` (token `--er-crimson`); deep `#B3331A`
  (`--er-crimson-deep`)
* The Clickmor brand accent. It is **not** the default button colour.
* **States:** hover `#963D2C` (`--er-crimson-hover`), pressed `#803222`
  (`--er-crimson-pressed`). White stays above 5.4:1 on all three.
* **Use for:**
  - Brand marks: the wordmark suffix, the app badge, the admin brand mark, the
    logo fallback, the dashboard identity card
  - Explicitly designated Clickmor accents and eyebrow/kicker labels
  - Exam-specific identity colours where they carry meaning
* **Not** for the current navigation item, a selected filter or any state that
  means "this is where you are" - those are navy surfaces (section 2b).
* **Avoid** spreading it across unrelated cards, sections, headings and icons.

> Superseded in this document: the earlier `#C85841` "Academic Crimson" primary.
> It measures 4.26:1 on white, below the 4.5:1 AA floor for the 12–14px labels
> this product uses, so it could never have been the button fill. Crimson stays
> in the palette as the brand accent, at the accessible `#B14933`.

### 2b. Interaction states (one table per control family)

Every value below is a token in `src/styles/theme.css`; no component types its
own hex. The rules live in `src/styles/brand-actions.css` (buttons, links,
navigation) and in the form block of `theme.css`.

| Primary button | Background | Text | Border |
|---|---|---|---|
| Default | `#0A3E83` | `#FFFFFF` | `#083570` |
| Hover | `#083570` | `#FFFFFF` | `#072F64` |
| Pressed | `#062B5C` | `#FFFFFF` | `#05264F` |
| Focus | `#0A3E83` | `#FFFFFF` | `#083570` + the shared ring |
| Disabled | `#E2E8F0` | `#64748B` | `#CBD5E1` |
| Busy (`aria-busy`) | `#0A3E83` | `#FFFFFF` | `#083570` |

| Secondary button | Background | Text | Border |
|---|---|---|---|
| Default | `#FFFFFF` | `#0A3E83` | `#CCE0F3` |
| Hover | `#EDF4FB` | `#0A3E83` | `#A9C8E8` |
| Pressed | `#DCEAF8` | `#083570` | `#8FB7DE` |
| Disabled | `#F8FAFC` | `#64748B` | `#E2E8F0` |

| Other families | Default | Hover | Selected / focus | Disabled |
|---|---|---|---|---|
| Links | `#0A3E83` | `#083570` | `#062B5C` | - |
| Navigation item | existing text | `#F1F5F9` / `#0A3E83` | `#EDF4FB` / `#0A3E83` | `#F8FAFC` / `#64748B` |
| Field border | `#CBD5E1` | `#94A3B8` | `#0A3E83` (focus), `#B91C1C` (invalid) | `#E2E8F0` |

Native checkboxes and radios use `accent-color: #0A3E83`, so the platform paints
the white tick and keeps its own geometry and keyboard behaviour. Status colours
(success `#166534`, warning `#92400E`, error `#B91C1C`, information `#1D4ED8`,
each on its pale surface) are tokens too and never double as an action colour.

### Secondary — Academic Tangerine
* **HEX:** `#D2732A`
* The secondary accent represents energy, activity, speed, and student engagement.
* **Use for:**
  - Small highlights
  - Service indicators
  - Secondary emphasis
  - Academic activity markers

### Secondary Soft
* **HEX:** `#FFF0E6`
* A very light orange surface used for subtle highlights and secondary academic states.

---

## 3. Institutional Navy

### Deep Academic Navy
* **HEX:** `#0F172A`
* Navy is the primary institutional anchor of EduReach.
* Represents: Trust, Stability, Academic authority, Reliability, Professionalism.
* Use extensively for the site's major visual foundation, footers, headers, and primary headings.

### Navy Soft
* **HEX:** `#283044`
* A softer navy variation for secondary dark surfaces and supporting elements.

---

## 4. Academic Surface Colors

EduReach uses soft, calm surfaces rather than relying entirely on plain white:

* **Main Background:** `#FAF8FF` (Subtle academic/lavender tone)
* **Pure Surface:** `#FFFFFF` (Clean content surfaces, maximum readability)
* **Soft Academic Surface:** `#F2F3FF` (Service areas, secondary sections, information groups)
* **Academic Surface:** `#EAEDFF` (Visual grouping and highlighted content)
* **Elevated Academic Surface:** `#E2E7FF` (Stronger visual emphasis)
* **Deep Academic Surface:** `#DAE2FD` (Layered surfaces)

---

## 5. Supporting Colors

### Deep Burgundy
* **HEX:** `#54080C`
* Represents institutional authority and seriousness.
* Use sparingly for special institutional sections, footer accents, and verified authority contexts.

### Success Green
* **HEX:** `#16A34A`
* Represents successful actions, completed processes, verified info, positive status.
* **Soft Success:** `#EAF8EE`

### Trust Gold
* **HEX:** `#CA8A04`
* Represents verification, trust, recognition, accreditation, achievement indicators.
* **Soft Gold:** `#FFF8DF`

---

## 6. Text Colors

* **Primary Text:** `#131B2E`
* **Secondary Text:** `#5B403B`
* **Muted Text:** `#64748B`
* **Inverse Text:** `#FFFFFF`

---

## 7. Border & Divider Colors

* **Standard Border:** `#E2E8F0`
* **Strong Border:** `#CBD5E1`

---

## 8. Functional Colors

* **Error:** `#BA1A1A`
* **Error Surface:** `#FFDAD6`

---

## 9. Color Personality & Usage Principle

Hierarchy:
1. **NAVY (`#0F172A`)** → institutional foundation and trust
2. **SOFT ACADEMIC BLUE (`#FAF8FF`, `#F2F3FF`, `#EAEDFF`)** → primary interface environment
3. **WHITE (`#FFFFFF`)** → clean content surfaces
4. **LOGO NAVY (`#0A3E83`)** → primary action and every interaction state
   (hover `#083570`, pressed `#062B5C`)
5. **LOGO BLUE (`#1D9BE0`, ink `#0F6BAA`)** → icon and highlight accent
6. **CRIMSON (`#B14933`)** → Clickmor brand accent (marks, navigation, kickers)
7. **TANGERINE (`#D2732A`)** → energetic secondary accent
8. **SUCCESS GREEN (`#047857`)** → success and verification
9. **GOLD (`#CA8A04`)** → trust and recognition
10. **BURGUNDY (`#54080C`)** → special institutional emphasis

**Principle:**
> **Calm surfaces + strong navy foundation + the logo palette for action.**
> Logo navy marks what the student can do; logo blue colours icons and small
> highlights; crimson appears only where the brand speaks. Do not create pages where crimson, orange, or burgundy fills most of
> the screen, and do not paint a card with an action colour.

## 10. Semantic token API

`src/styles/theme.css` exposes semantic `--color-*` tokens for shared UI:

| Purpose | Token |
|---|---|
| Page, surface and raised surface | `--color-bg-primary`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-muted`, `--color-bg-disabled` |
| Borders | `--color-border-default`, `--color-border-subtle`, `--color-border-strong` |
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`, `--color-text-disabled` |
| Brand and interaction | `--color-brand-primary`, `--color-brand-primary-hover`, `--color-brand-accent`, `--color-focus` |
| Status | `--color-success`, `--color-warning`, `--color-error`, `--color-info` and their `*-bg` surfaces |

These are aliases over the established EduReach palette; they do not introduce a
new theme or replace the legacy `--er-*` variables used by existing pages.
New shared styles should prefer semantic tokens, while existing page-specific
values should only be migrated when that improves consistency without changing
the established layout.

The shared spacing scale is `--er-space-1` through `--er-space-8` (4, 8, 12,
16, 24, 32, 48 and 64px). Type-size tokens describe a modular hierarchy; the
`.er-type-*` utility roles retain compact EduReach sizing where needed.
