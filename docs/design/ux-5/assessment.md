# Existing-product assessment

**Method.** Product discovery was done on the running application
(`npm run dev`, the same code as `main` at `fa51d7d`), not on a mood board:
route inventory, source reading, component and CSS inspection, real browser
screenshots at 1440, 1280, 1024, 768, 430, 390, 360 and 320 px, and the existing
unit/e2e/a11y/perf gates. No interviews or usability sessions were run, so the
statements below describe the interface and its task paths; the assumptions
that need people are listed in [`usability-plan.md`](./usability-plan.md) and
labelled as assumptions.

## What EduReach is

EduReach Hub is a Nigerian exam-preparation and student-services platform. A
student can:

- sit timed JAMB, WAEC, NECO and Post-UTME practice papers and review results;
- browse past questions and study tools (screening calculator, CGPA calculator,
  school finder);
- request student services (result checking, JAMB slip, admission support) and
  track their status;
- read news, scholarships, jobs and deadlines;
- keep an academic profile and notifications.

Staff use a separate management console to manage student accounts, question
banks, CBT exams, service requests, news/opportunities, events, site settings
and data imports.

## Who uses it, and what they are trying to finish

| User | Job to be done | What "done" looks like |
| :--- | :--- | :--- |
| First-time student | Decide whether this product is for my exam, then try one paper | Started a CBT paper without creating an account first, or understood why an account is needed |
| Practising student | Sit a paper under real time pressure and understand the score | Paper submitted, result readable, next practice decision obvious |
| Returning student | See what needs my attention, then continue | Dashboard states the next action before it shows statistics |
| Student needing help | Request a service and know where it is | Request submitted with a reference and a visible status |
| Administrator | Work the queue and keep content/banks healthy | Record found, action taken with a reason, audit trail present |

## Routes and movement

The public product moves between Home → CBT practice → Setup → Exam → Result,
with sibling areas for Past questions, Services, News, Scholarships/Jobs and
School finder. A signed-in student gets a dashboard with Overview, My Requests,
My CBT, Tools & Saved, Academic Profile and Security & Password. Staff enter a
separate console; all admin routes are capability-filtered.

The site is a single React app with route-level code splitting. The dashboard
and admin sheets load lazily, which matters for CSS ownership (see
`docs/architecture/STYLESHEET_LAYERS.md`).

## What felt unfinished, confusing, cluttered or inconsistent

These are observations from the before screenshots in
[`evidence/before/`](./evidence/before/), not opinions about taste.

### 1. The homepage did not say what the product was

At 1440 px the header carried six primary links, a search field and two auth
actions. The page then opened on a bare search field and an empty dashed
"Updates" box. There was no visible title, promise or next step; a first-time
visitor had to infer the product from card labels. On mobile the same page used
a hamburger plus a five-item bottom tab bar whose "CBT" target was visually
heavier than the others. The exam grid used four unrelated pastel backgrounds,
so four exams looked like four different products rather than one choice.

**Evidence:** `evidence/before/home-1440.png`, `home-390.png`,
`home-768.png`.

### 2. Identity was used where a task title belonged

The student dashboard's `<h1>` was the student's name ("Amaka Okonkwo"), and so
was the settings page's. The profile page led with "Complete your profile" and
an amber completeness block before it said what the page was for. The result
was a product that greeted people but did not tell them where they were.

**Evidence:** `evidence/before/dashboard-1440.png`, `dashboard-390.png`,
`settings-1440.png`, `profile-390.png`.

### 3. The dashboard shouted and then repeated itself

Card titles and KPI labels were uppercase with letter-spacing, so a screen of
seven labels read as a wall of capitals. Three large panels were empty at once,
each with a different empty-state treatment. KPI context was clipped with an
ellipsis, so "Across 3 scored papers" became a ticker. The "Needs attention"
action sat at the far right of a row and dropped below the copy on mobile with
no alignment.

**Evidence:** `evidence/before/dashboard-1440.png`,
`evidence/after/dashboard-1440.png`.

### 4. MyCBT was accurate but hard to scan

Seven metrics were forced into a fixed four-column grid, leaving the last row
short and the "Questions in completed tests" tile wrapped. The analysis area
below the charts was loose prose: "Subject progress" and "Practice suggestion"
had no surface or separation from the section around them. Empty states were
centre-aligned and smaller than the labels they replaced.

**Evidence:** `evidence/before/mycbt-1440.png`,
`evidence/after/mycbt-1440.png`.

### 5. The admin console was organised by table, not by job

The sidebar was a flat list of screens, all group labels uppercase. At 390 px,
the KPI value "Unavailable" broke mid-word ("Unavailabl e"). The overview was a
grid of metrics before it showed what needed action.

**Evidence:** `evidence/before/admin-1440.png`, `admin-390.png`;
`evidence/after/admin-1440.png`, `admin-390.png`.

### 6. Mobile layouts were shrunken desktop pages in several places

- The home exam cards duplicated the exam name in a badge and pushed meta
  content below the fold; a leftover feed minimum height
  (`--er-late-min: 734px`) created a large blank gap under the list.
- Profile's avatar was cropped under the fixed bottom navigation, and the page
  carried two "Cancel" controls: a full outline button under the title and
  another in the save bar.
- Filter pills on Past questions lived in a horizontal scroller, so the last
  filter was cut off at 320–360 px with no affordance.
- Admin KPIs were fixed at four columns until 1050 px and then two, regardless
  of the word inside them.

### 7. Semantic colour was used decoratively

Crimson `#B14933` appeared on the neutral "Practice session" label and on the
numbered setup guides. That is the same colour the product uses for attention
and destructive actions, so nothing stood out when something actually needed
attention. The home hero also used a green radial wash as decoration.

### 8. Setup and exam explain the rules, but not as a system

The setup page already had a good "How this CBT session works" panel; the
information was there. What was missing was a compact summary of what the
current selection will produce (subjects, questions, time) and a clear rule for
subject selection. The exam screen had a countdown but no persistent statement
of the paper being sat or what "flagged" means. The result screen showed a
score table before it told a student what the score meant.

These screens are specified in the wireframes/prototype in this bundle and are
listed as outstanding implementation work in the architecture document. They
were not silently declared "done" by changing copy.

## What was already good and had to survive

- CBT timing, autosave, submission and scoring logic, question banks and
  attempt persistence.
- Authentication and capability checks; admin routes are gated by capability,
  not by hiding links.
- Service request lifecycle, notification read state, profile persistence.
- The existing card language: white surfaces, 1 px neutral border, 10–16 px
  radius, restrained shadow. UX-5 does not introduce gradients, coloured cards
  or a second card style.

## Constraints that shaped the redesign

1. **One product, two audiences.** Student surfaces must stay calm and
   task-first; the admin console must stay dense and operational. They share
   tokens and type roles, not layouts.
2. **Time pressure.** CBT screens prioritise the question, the timer and
   submission safety over decoration.
3. **Low-end phones.** 320 px is a supported width, touch targets are at least
   44 px, and no table is allowed to create a document-level horizontal scroll.
4. **Existing data.** No new migrations were needed; all changes are
   presentational or markup-level and preserve the API contract.
