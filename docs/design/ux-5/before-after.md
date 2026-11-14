# Before / after evidence

All screenshots are real browser captures of the running application at commit
`fa51d7d` (before) and the UX-5 working tree (after), using the same mocked
signed-in state and the same viewport heights. The prototype shots are labelled
as prototype and are not offered as production screenshots.

## Student screens

| Screen | Before | After | What changed | Interaction check |
| :--- | :--- | :--- | :--- | :--- |
| Home, 1440 | [`before/home-1440.png`](./evidence/before/home-1440.png) | [`after/home-1440.png`](./evidence/after/home-1440.png) | Visible product statement + sub + two actions + proof line; 3-step rail replaces the empty right side; search moved below the hero; six-link header de-crowded (search hidden ≤1240) | Links route to `/cbt` and `/past-questions`; full e2e suite passes |
| Home, 768 | [`before/home-768.png`](./evidence/before/home-768.png) | [`after/home-768.png`](./evidence/after/home-768.png) | Hero stacks; rail hidden; `Menu` is labelled | No document overflow, 0 page errors |
| Home, 390 | [`before/home-390.png`](./evidence/before/home-390.png) | [`after/home-390.png`](./evidence/after/home-390.png) | Exam cards become 4 × 84 px rows (logo → title → arrow), duplicate badge hidden, feed minimum height no longer creates blank space | `after-home-exams-*` probe measured 358 × 84 at 390; capture set 0 overflow |
| Dashboard, 1440 | [`before/dashboard-1440.png`](./evidence/before/dashboard-1440.png) | [`after/dashboard-1440.png`](./evidence/after/dashboard-1440.png) | `<h1>` is "Overview"; student name is a greeting; sentence-case headings; KPIs 4-up with untruncated hints; attention row aligned | 42 authenticated captures: 0 overflow, 0 page errors |
| Dashboard, 1024 | [`before/dashboard-1024.png`](./evidence/before/dashboard-1024.png) | [`after/dashboard-1024.png`](./evidence/after/dashboard-1024.png) | Sidebar groups are sentence case; content hierarchy survives without the header link row | 0 overflow |
| Dashboard, 390 | [`before/dashboard-390.png`](./evidence/before/dashboard-390.png) | [`after/dashboard-390.png`](./evidence/after/dashboard-390.png) | 2-up KPIs with full hint sentences; "Needs attention" wraps the action under the copy | 0 overflow; e2e dashboard specs pass |
| My CBT, 1440 | [`before/mycbt-1440.png`](./evidence/before/mycbt-1440.png) | [`after/mycbt-1440.png`](./evidence/after/mycbt-1440.png) | Seven metrics finish flush instead of leaving a short row; labels sentence case; subject-progress/suggestion become cards; empty copy left-aligned at body size | 0 overflow; "Questions in completed tests" label preserved for tests/data |
| My CBT, 390 | [`before/mycbt-390.png`](./evidence/before/mycbt-390.png) | [`after/mycbt-390.png`](./evidence/after/mycbt-390.png) | Metrics wrap 2-up; hierarchy holds without horizontal scroll | 0 overflow |
| Profile, 390 | [`before/profile-390.png`](./evidence/before/profile-390.png) | [`after/profile-390.png`](./evidence/after/profile-390.png) | Duplicate full-size Cancel replaced by one quiet text action; save bar sticky above the bottom bar; completeness banner no longer crowds the title layout | Save/edit e2e specs pass; draft persistence untouched |
| Setup (JAMB, empty bank), 1440 | [`before/setup-jamb-1440.png`](./evidence/before/setup-jamb-1440.png) | [`after/setup-jamb-1440.png`](./evidence/after/setup-jamb-1440.png) | Neutral session/time label and primary step numbers instead of crimson decoration; empty-bank warning remains the only crimson element | `npm test` CBT setup assertions pass |
| Setup, 390 | [`before/setup-jamb-390.png`](./evidence/before/setup-jamb-390.png) | [`after/setup-jamb-390.png`](./evidence/after/setup-jamb-390.png) | Rules panel stacks; no horizontal scroll | 0 overflow |
| Settings, 1440 | [`before/settings-1440.png`](./evidence/before/settings-1440.png) | [`after/settings-1440.png`](./evidence/after/settings-1440.png) | The security dialog is the settings surface; the page behind it now has a task title instead of the student's name | Dialog opens via `/settings`; e2e auth specs pass |
| Result entry, 1440 | [`before/results-1440.png`](./evidence/before/results-1440.png) | [`after/results-1440.png`](./evidence/after/results-1440.png) | Shell and type only; the result-page redesign is specified in the prototype and not yet implemented | Existing result/unavailable state covered by e2e |
| Past questions, 360 | [`before/past-questions-360.png`](./evidence/before/past-questions-360.png) | [`after/past-questions-360.png`](./evidence/after/past-questions-360.png) | Filter pills wrap instead of clipping the last filter in a sideways scroller | 0 element overflow after the fix |
| Services, 1440 | [`before/services-1440.png`](./evidence/before/services-1440.png) | [`after/services-1440.png`](./evidence/after/services-1440.png) | Shared shell/header only; service request content and lifecycle unchanged | Request e2e specs pass |

## Administrator screens

| Screen | Before | After | What changed | Interaction check |
| :--- | :--- | :--- | :--- | :--- |
| Admin overview, 1440 | [`before/admin-1440.png`](./evidence/before/admin-1440.png) | [`after/admin-1440.png`](./evidence/after/admin-1440.png) | Flat link list becomes five job groups; group labels sentence case; overview states platform health before detail | Capability-filtered nav renders for a `super_admin` session; 0 errors |
| Admin overview, 390 | [`before/admin-390.png`](./evidence/before/admin-390.png) | [`after/admin-390.png`](./evidence/after/admin-390.png) | "Unavailable" no longer breaks mid-word; summary is 2-up with readable labels | 0 overflow at 390 |
| Admin users, 1440 | [`before/admin-users-1440.png`](./evidence/before/admin-users-1440.png) | [`after/admin-users-1440.png`](./evidence/after/admin-users-1440.png) | Grouped navigation, same records/table behaviour | Stacked-record/table-sort unit tests pass |
| Admin CBT, 1440 | [`before/admin-cbt-1440.png`](./evidence/before/admin-cbt-1440.png) | [`after/admin-cbt-1440.png`](./evidence/after/admin-cbt-1440.png) | Shared console shell and group context | `npm test` admin capability tests pass |
| Admin queue, 1440 | [`before/admin-queue-1440.png`](./evidence/before/admin-queue-1440.png) | [`after/admin-queue-1440.png`](./evidence/after/admin-queue-1440.png) | Shared shell; queue itself unchanged | Capability denial state still renders safely |

## Prototype screens (not production)

| Screen | 1440 | 390 |
| :--- | :--- | :--- |
| Dashboard | [`prototype/dashboard-1440.png`](./evidence/prototype/dashboard-1440.png) | [`prototype/dashboard-390.png`](./evidence/prototype/dashboard-390.png) |
| CBT setup | [`prototype/setup-1440.png`](./evidence/prototype/setup-1440.png) | [`prototype/setup-390.png`](./evidence/prototype/setup-390.png) |
| Exam | [`prototype/exam-1440.png`](./evidence/prototype/exam-1440.png) | [`prototype/exam-390.png`](./evidence/prototype/exam-390.png) |
| Result | [`prototype/result-1440.png`](./evidence/prototype/result-1440.png) | — |
| My CBT | [`prototype/mycbt-1440.png`](./evidence/prototype/mycbt-1440.png) | — |
| Profile | [`prototype/profile-1440.png`](./evidence/prototype/profile-1440.png) | [`prototype/profile-390.png`](./evidence/prototype/profile-390.png) |
| Notifications | [`prototype/notifications-1440.png`](./evidence/prototype/notifications-1440.png) | — |
| Admin overview / records | [`prototype/admin-1440.png`](./evidence/prototype/admin-1440.png) | [`prototype/admin-users-390.png`](./evidence/prototype/admin-users-390.png) |

## Interaction verification

| Check | Result |
| :--- | :--- |
| Prototype routes render | 11/11 (`#/dashboard`, setup, exam, result, My CBT, profile, notifications, admin, users, requests, questions) |
| Exam option selection | 1 option with `aria-pressed="true"` after click; next moves to question 2 |
| Profile save | State becomes "Saved just now"; toast says the write is simulated |
| Admin record | Drawer opens from a record action; save offers "Simulated: record updated" |
| Prototype JS errors | 0 |
| Production e2e | 291 passed / 29 skipped (see the architecture document) |
| Production responsive capture | 72 + 42 + 8 shots, 0 document overflow, 0 page errors |

## What these images do **not** prove

They do not prove that a student understands the page, that the copy is right
for every exam body, or that a real service request was processed. Those are
task-level questions for the plan in [`usability-plan.md`](./usability-plan.md).
