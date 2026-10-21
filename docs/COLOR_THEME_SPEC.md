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

### Primary action — Deep Green
* **HEX:** `#174A3A` (token `--er-primary`)
* The colour of an action the student takes. It carries the meaning that used to
  be split between blue and crimson, and it is the only fill for a primary
  button.
* **States:** hover `#123A2D` (`--er-primary-hover`), pressed `#0E3025`
  (`--er-primary-active`), border `#123A2D` (`--er-primary-border`) stepping to
  `#0F3025` and `#0B261E`, selected surface `#EDF5F0` (`--er-primary-soft`)
  with edge `#D4E4DA` (`--er-primary-soft-border`).
* **Contrast:** white text on the fill measures **10.11:1** at rest, 12.58:1 on
  hover and 14.30:1 pressed; as text on white it is 10.11:1 and 9.11:1 on the
  selected surface. Every state clears AA (4.5:1) with a wide margin.
* **Use for:**
  - Primary buttons: Start practising, Past questions, Continue, Submit, Save
  - Primary links and the action inside a block
  - Selected states: filters, tabs, steps, answer options, the current question
  - Active progress indicators (page progress, the resume bar)
  - Form focus tint and `accent-color`
* **Never** for card surfaces, banners, exam identity marks or decorative
  section backgrounds.

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
  means "this is where you are" - those are green surfaces (section 2b).
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
| Default | `#174A3A` | `#FFFFFF` | `#123A2D` |
| Hover | `#123A2D` | `#FFFFFF` | `#0F3025` |
| Pressed | `#0E3025` | `#FFFFFF` | `#0B261E` |
| Focus | `#174A3A` | `#FFFFFF` | `#123A2D` + the shared ring |
| Disabled | `#E2E8F0` | `#64748B` | `#CBD5E1` |
| Busy (`aria-busy`) | `#174A3A` | `#FFFFFF` | `#123A2D` |

| Secondary button | Background | Text | Border |
|---|---|---|---|
| Default | `#FFFFFF` | `#174A3A` | `#D4E4DA` |
| Hover | `#EDF5F0` | `#174A3A` | `#B5CBBF` |
| Pressed | `#DCE9E1` | `#123A2D` | `#A3BFAF` |
| Disabled | `#F8FAFC` | `#64748B` | `#E2E8F0` |

| Other families | Default | Hover | Selected / focus | Disabled |
|---|---|---|---|---|
| Links | `#174A3A` | `#123A2D` | `#0E3025` | - |
| Navigation item | existing text | `#F1F5F9` / `#174A3A` | `#EDF5F0` / `#174A3A` | `#F8FAFC` / `#64748B` |
| Field border | `#CBD5E1` | `#94A3B8` | `#174A3A` (focus), `#B91C1C` (invalid) | `#E2E8F0` |

Native checkboxes and radios use `accent-color: #174A3A`, so the platform paints
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
4. **DEEP GREEN (`#174A3A`)** → primary action and every interaction state
   (hover `#123A2D`, pressed `#0E3025`)
5. **CRIMSON (`#B14933`)** → Clickmor brand accent (marks, navigation, kickers)
6. **TANGERINE (`#D2732A`)** → energetic secondary accent
7. **SUCCESS GREEN (`#047857`)** → success and verification
8. **GOLD (`#CA8A04`)** → trust and recognition
9. **BURGUNDY (`#54080C`)** → special institutional emphasis

**Principle:**
> **Calm surfaces + strong navy foundation + a green signal for action.**
> Deep green marks what the student can do; crimson appears only where the brand
> speaks. Do not create pages where crimson, orange, or burgundy fills most of
> the screen, and do not paint a card with an action colour.
