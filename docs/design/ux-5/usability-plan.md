# Usability testing: status, assumptions and plan

## Status (honest)

**No usability sessions were run with real people for this change.** No
interviews, quotes, recordings or participant counts appear anywhere in this
bundle. What was done instead:

- heuristic walkthroughs of every journey against the running app;
- real-browser layout and interaction checks at the required widths;
- source/DOM inspection for labels, focus order and accessible names;
- the existing automated a11y, unit, e2e, build and performance gates.

That is enough to find layout and interaction defects. It is **not** evidence
that students understand the product unassisted. The claims in the assessment
are therefore about the interface, and the items below are assumptions to test,
not findings.

## Assumptions that need validation

| # | Assumption | How it could be wrong |
| :--- | :--- | :--- |
| A1 | "Start CBT practice" is the first action a new student wants | A student looking for past questions may read the page as exam-only |
| A2 | Six header destinations are scannable at 1280 px | Users may hunt for Scholarships or Services in the drawer |
| A3 | "Overview" is a better title than the student's name | Students may not connect "Overview" with "my dashboard" |
| A4 | A quiet underlined "Cancel" in the profile head is discoverable | Users may miss the escape and use Back, losing edits |
| A5 | Grouping admin links by job (People/Learning/Requests/Content/System) matches staff vocabulary | Staff may think in exam bodies or queue names instead |
| A6 | 2-up KPIs at 360 px remain readable with long hints | Smaller text or a long subject name could still crowd |
| A7 | The three-step rail on the home hero explains the paper without adding noise | It may be skipped entirely on desktop |

## Plan: moderated task test

**Participants.** Two groups, recruited separately:

- 6 students: 3 who have taken JAMB/WAEC recently, 3 who have used a CBT
  practice app before. Mixed phone-first and laptop users.
- 4 staff: 2 who process service requests, 2 who manage CBT content/accounts.

Exclude anyone who worked on this change. Do not incentivise with product
access. Record only with explicit consent; store no unnecessary personal data.

**Session shape (45 min, remote or in person).** Think-aloud, moderator does not
teach the interface. Start with a neutral warm-up, then tasks in this order
(each task has a start state and a stop condition):

| # | Participant | Task | Success condition |
| :--- | :--- | :--- | :--- |
| T1 | Student | "You have a JAMB exam in three weeks. Use this site to sit one practice paper." | Reaches an exam session without moderator help; can state the time limit |
| T2 | Student | "You have finished. Find out how you did and what to practise next." | Opens the result, then can say which subject needs work |
| T3 | Student | "Add your institution and course, then save." | Saves; can confirm the change persisted after reload |
| T4 | Student | "Request a JAMB slip and tell me where it is now." | Submits/opens tracking and reads the current status |
| T5 | Student | "Find past questions for Mathematics." | Reaches a filtered paper list and opens one |
| T6 | Student | "Find a scholarship you could apply for." | Reaches an opportunity detail with deadline visible |
| T7 | Staff | "Find a request that needs action and move it forward." | Opens the record; change requires a reason; student notification offered |
| T8 | Staff | "Check whether the JAMB bank is healthy before publishing." | Finds bank health and can explain what blocks publishing |
| T9 | Staff | "Find the student account and suspend it safely." | Finds account, sees consequence, confirms with reason |
| T10 | Staff | "Find where the homepage text is edited." | Reaches Site & Policies without using search |

**Measures.** Task success (binary), time on task, wrong turns, moderator
interventions, and a single ease question (1–5) after each task. Capture where
the participant first looked and what word they used for each area. Do not
measure "satisfaction" from a single smiley.

**Pilot.** Run one student and one staff pilot; fix task wording, not the UI,
between pilot and real sessions.

**Analysis.** Two reviewers independently tag friction by screen and severity
(blocks task / slows task / cosmetic). Report counts, not adjectives. Any
design change after testing gets a before/after note in
[`before-after.md`](./before-after.md).

## Plan: unmoderated check (after the moderated round)

If a panel is available, run the same T1–T5 on a phone with 20 students and
collect: task completion, time to first paper, and one open question ("What did
you expect to see after signing in?"). Use the prototype or production,
whichever is current, and state which in the report.

## What is still a limitation after this plan

- Nigerian exam terminology and school contexts vary; a small sample cannot
  represent all states or device classes.
- Staff tasks depend on production data and permissions; a staging fixture must
  be prepared so a participant is not blocked by an empty queue.
- The CBT timer and submission cannot be safely tested with real data in a
  usability session; use a sandboxed attempt and say so.
- No claim of accessibility conformance from usability testing alone; the
  static a11y gate and a screen-reader pass are separate.

## Reporting template

For each participant: task, result, time, interventions, verbatim observation
(quoted only if consent allows), and the interface element involved. Aggregate
into a single table in this file; do not rewrite this plan after the fact to
match the outcome.
