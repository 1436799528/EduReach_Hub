# UX-5 design bundle

This folder contains the design materials for UX-5. The implementation summary,
test results and outstanding issues live in
[`docs/architecture/UX-5-PRODUCT-DESIGN-AND-RESPONSIVE-SYSTEM.md`](../../architecture/UX-5-PRODUCT-DESIGN-AND-RESPONSIVE-SYSTEM.md).

| File | What it answers |
| :--- | :--- |
| [`assessment.md`](./assessment.md) | What EduReach is, who uses it, and what was wrong with the product's design before this work. Based on the running app, not on invented research. |
| [`design-system.md`](./design-system.md) | Colour, typography, spacing, controls, icons and card rules, with the code that owns each rule. |
| [`ux-ia.md`](./ux-ia.md) | Information architecture, the five journeys, where steps were removed and where safeguards were kept. |
| [`responsive.md`](./responsive.md) | Deliberate layout decisions at 320–1440 px, safe areas and touch targets. |
| [`usability-plan.md`](./usability-plan.md) | What was and was not tested with people, the assumptions that need validation, and a runnable test plan. |
| [`before-after.md`](./before-after.md) | Screen-by-screen evidence: before, after, what changed and how it was checked. |
| [`wireframes/`](./wireframes/index.html) | 16 structural wireframes (8 student, 8 admin), each with a desktop and a mobile frame. Open `index.html`. |
| [`prototype/index.html`](./prototype/index.html) | Clickable student and admin prototype. Everything is local and simulated; no production write is made. |
| [`evidence/`](./evidence/) | Real browser screenshots of the running application (before/after) and of the prototype. |

## How to open the interactive prototype

Open `prototype/index.html` in a browser (it also works from the file system).
Use the student/admin switch in its header, or jump directly to a route:

- `#/dashboard`, `#/setup`, `#/exam`, `#/result`, `#/mycbt`, `#/profile`,
  `#/notifications`
- `#/admin`, `#/admin-users`, `#/admin-requests`, `#/admin-questions`

Actions that would touch a backend end with a toast that starts with
`Simulated:` or `Prototype:`; nothing is written to Supabase or the API.

## How to regenerate the wireframes

```bash
node scripts/ux5-wireframes.mjs
```

The script writes the SVGs and `wireframes/index.html`. The wireframes are
drawn shapes, not screenshots of the current implementation.
