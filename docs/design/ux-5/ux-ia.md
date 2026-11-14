# UX and information architecture

## 1. The one-sentence structure

A student does one of five things — **practise, look something up, ask for help,
read an update, or fix their account** — and the navigation should say which.
An administrator does one of four things — **see what needs action, work a
queue, manage learning content, or manage the platform** — and the console
should be grouped the same way.

## 2. Navigation model

### Student

- **Header (≥900 px):** Home · CBT practice · Past questions · Services · News ·
  Scholarships · quiet "Talk to us", then search (≥1241 px), notifications and
  account. Six destinations is the maximum; each maps to one job.
- **Header (<900 px):** logo, notifications, account, labelled "Menu". The menu
  opens a drawer with the same destinations plus dashboard-only shortcuts
  (Dashboard, My requests, Academic profile) when signed in.
- **Signed-in dashboard:** a task sidebar (Overview, My Requests, My CBT,
  Tools & Saved) and a secondary "Study" group (Past questions, Results,
  Services, Calculators), then account links. Group labels are sentence case.
- **Bottom bar on phones:** Home, News, CBT, Services, Account. It is a shortcut
  bar, not the only navigation; the drawer remains the complete map.

### Administrator

`ADMIN_CONSOLE_NAV` groups every destination by the job, not by the database
table:

| Group | Screens |
| :--- | :--- |
| (top) | Overview |
| People | Student Accounts |
| Learning | CBT Manager · Bank Security · Import Past Questions · Schools & Institutions |
| Requests | Service Queue |
| Content | Newsroom CMS · Events & Key Dates · Scholarships & Opportunities |
| System | Analytics & Reports · Data Control Center · Site & Policies · PDF Bank |

Links are still filtered by capability; grouping does not grant access. The
console header shows the current section, a page finder, "Student site" and
session state.

## 3. Journeys

### A. CBT journey (the core task)

```
Home
 └─ "Start CBT practice" ─────────────► /cbt  (choose exam)
                                          └─ /cbt/setup/:exam
                                               ├─ session type (practice | mock)
                                               ├─ subjects (rules shown up front)
                                               ├─ questions per subject
                                               └─ summary: subjects · questions · time
                                                    └─ start ─► /cbt/session/:id
                                                                 ├─ answer (A–D keys)
                                                                 ├─ flag for review
                                                                 ├─ palette: answered / flagged / current
                                                                 └─ submit → confirm → result
                                                                      └─ score · subject breakdown · what it means
                                                                           └─ My CBT (average, trend, practice suggestion)
```

What UX-5 changed:

- The home page's primary action now goes straight to the CBT chooser; the
  secondary action goes to past questions. Search no longer occupies the first
  screen.
- Setup rules are stated before the controls they constrain ("choose four
  subjects, including Use of English", time follows exam pace). The prototype
  and wireframe add a sticky summary and a "Required" chip on Use of English.
- No extra confirmation was added to normal answering. Submission still
  confirms because it is irreversible; the confirm states unanswered and
  flagged counts.
- Timing, autosave and refresh-resume behaviour are untouched.

**Implemented today:** home → CBT entry, setup shell and empty-bank state,
dashboard/MyCBT hierarchy, result entry states. **Specified but not yet
implemented in production:** the setup rule cards/sticky summary, the exam
timer bar redesign, and the result score ring. See the outstanding list in the
architecture document; the prototype is the accepted design for those screens.

### B. Profile edit and persistence

```
Dashboard / avatar menu ─► Profile summary ─► Edit ─► grouped form
                                                     ├─ Personal information
                                                     ├─ Contact
                                                     ├─ Academic details
                                                     └─ Exam & preferences
                                                          └─ save bar: state · Skip / Cancel / Save
                                                               └─ "Saved" status, values persist
```

- The page title names the task ("Complete your profile" / "Edit your
  profile"); completeness is evidence, not the title.
- Before: two equally weighted "Cancel" buttons (one under the title, one in
  the save bar). After: one quiet text action under the title plus the save bar;
  the bar is sticky above the bottom navigation on phones.
- Unsaved-changes confirmation and the `aria-live` save state are preserved.
- Save remains explicit; the product does not autosave academic details.

### C. Service request and tracking

```
Services catalogue ─► service detail ─► request form ─► reference code
                                                           └─ My requests (status, updates)
                                                                └─ notification when status changes
```

UX-5 keeps the safety steps (identity fields, required documents, reference)
and does not collapse the confirmation into a toast. The dashboard surfaces
"Open requests" and a request notification with a per-item action.

### D. Resource discovery

Past questions → filter (exam/year/subject) → paper; News/Scholarships → list →
detail; School finder and calculators are tools, not content. Filters wrap on
phones instead of scrolling sideways. Empty results state what to change rather
than showing a blank grid.

### E. Admin: from queue to safe action

```
Console ─► Overview (what needs action)
          ├─ Service Queue ─► record drawer ─► status + required reason ─► notify student
          ├─ Student Accounts ─► find ─► inspect ─► smallest safe action
          ├─ CBT Manager / Bank Security ─► bank health before publishing
          ├─ Newsroom / Events / Scholarships ─► draft · review · publish
          └─ System ─► analytics, data control, policies, PDF bank
```

The prototype makes the consequence explicit: a status change requires a
reason and offers "Notify student"; a record opens in a drawer rather than
navigating away from the queue.

## 4. Steps removed, safeguards kept

| Change | Why |
| :--- | :--- |
| Home no longer opens on a search field; the exam chooser is one action away | A first-time visitor's first decision is which exam, not which keyword |
| Header search moved into the page ≤1240 px | Six links + search + auth did not fit without shrinking targets |
| Profile's second full-size "Cancel" became a quiet link | Two equivalent escapes made the save decision ambiguous |
| Admin links grouped into five job groups | A flat 15-link list made the console feel like a database browser |
| Dashboard page title changed from the student's name to "Overview" | Identity greeting is not a task title; the name stays in the welcome line |
| Uppercase removed from labels, group names and table headers | Shouting every label flattened hierarchy and slowed scanning |

Safeguards that were deliberately **not** removed: CBT submit confirmation,
exam timer/resume, profile unsaved-changes prompt, destructive admin
confirmations with reasons, capability checks, auth redirects, service request
reference/status history.

## 5. Interaction and state rules

- Active navigation uses green text + underline + `aria-current="page"`; it is
  never colour alone.
- The current route is the only green item in the header; quiet links stay
  neutral until hover.
- Empty states say what will appear and what to do next; they are left-aligned
  and use body size, not centred microcopy.
- Errors sit next to the field or above the action, with a recovery sentence;
  success is announced via `role="status"`.
- No hover-only actions on touch; every row action is a visible control or a
  full-row link with an accessible name.
