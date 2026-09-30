# 04 — User Journeys

Every journey here is documented before its screens are touched. Each one lists
the real route, the real data, the five required states, the edge cases that must
behave predictably, and the security rule that must hold.

Shared state rules (apply to all journeys):

- **Loading** — a skeleton or labelled busy state; never a blank page.
- **Success** — real data only. No fabricated fallback content anywhere.
- **Empty** — an honest message explaining why there is nothing, and what the
  student can do next.
- **Error** — a plain-language message from `userFriendlyError`; internal
  details only ever go to the server log.
- **Offline** — the service worker serves the shell; actions that need the
  network say so instead of failing silently.

---

## A. First-time student

```
Open EduReach → session check → Welcome → Create account / Sign in
→ Email verification → Profile completion → Institution & academic details
→ Interests → Dashboard → first meaningful action
```

| Step | Route | Data | Notes |
|---|---|---|---|
| Session check | any | Supabase session | Valid session → continue; otherwise public experience |
| Sign up / sign in | `/register`, `/login` | email, password | Supabase Auth; no account-existence disclosure; rate-limited |
| Verification | `/verify-email` | token | Resend available; expired verification shows the reason and the way out |
| Profile completion | `/profile/complete` | `profiles` fields | Collects only what personalisation and services use: name, institution, faculty, department, level, matric number |
| Dashboard | `/dashboard` | `profiles`, `student_notifications`, saved items, requests, CBT | Sections with no data are omitted or show a real empty state |

Edge cases: existing account; unverified account; abandoned profile completion
(dashboard must still work with a partial profile and offer to finish it);
network failure mid-signup.

Security: `profiles.role` is not client-writable; onboarding never asks for
information the product does not use (no date of birth, no address, no documents
at sign-up). Analytics: `page_view`, and on completion the first
`service_view`/`cbt_start` when it happens.

---

## B. News

```
Open /news → browse → filter by category → open /news/:slug → read
→ follow source link → save/share → return
```

Required on every article: headline, category, publication date, source name,
source URL, editorial summary, independence statement, freshness signal.

States and rules:

- **Empty feed** — honest message ("no verified updates yet"), never a seeded
  story (`docs/DATA_SOURCES.md`).
- **Expired article** — hidden from `/news`, still reachable by direct link with
  an expired indicator, so a shared WhatsApp link never lies.
- **Unknown slug** — 404 page, not a partial page.
- **Missing image** — neutral placeholder; never a shared stock photo.
- **Duplicate arrival** — suppressed before publication by the pipeline
  (`news_ingest_candidates.status = 'duplicate'`).
- **Offline** — cached shell and last-viewed rendering; the source link needs
  connectivity and says so.

Security: public read is limited to `published = true` and non-expired; provenance
fields are read-only to anyone but the service role.

---

## C. Opportunity

```
Open /jobs → filter (category, location, deadline) → open detail
→ review eligibility/requirements → review deadline → open official source
→ save → (future) deadline reminder
```

Rules:

- An opportunity past its deadline is not listed; `close_expired_opportunities()`
  and the public filter enforce this independently.
- The detail surface must separate **EduReach's description** from the
  **provider's official page**, and must never imply EduReach runs the programme.
- Deadlines render as absolute dates plus relative time ("closes in 4 days"),
  never vague wording.
- A "no stated deadline" opportunity is labelled as such rather than given an
  invented one.

Edge cases: expired while the page is open; provider link dead (report path
required); save while signed out (prompt to sign in and preserve intent).
Analytics: `opportunity_viewed` (currently absent from the allowlist — tracked as
AN-1).

---

## D. Institution

```
Open /schools → search/filter by state and type → open /schools/:slug
→ read verified institution information → open official website
```

Rules: only fields that are actually sourced are shown (name, acronym, state,
type, official website). Programmes, cut-offs, fees and admission requirements
are **not** shown because EduReach has no verified dataset for them; the page
says so and points to the official source. No wording may suggest EduReach is an
authorised representative of the institution.

Edge cases: unknown slug (404), duplicate institution names (integrity report
counts them), missing website (page states it is unavailable rather than
inventing a URL).

---

## E. Student service

```
Discover service (/services) → /services/:slug → understand what EduReach does
→ review requirements → start request → authenticate → complete form
→ validate → upload documents if required → review → submit
→ reference number → track (/dashboard/services) → status updates → completed
```

Non-negotiable requirement: **the service page must state exactly what EduReach
does** — information only, assisted process, document collection, submission on
the student's behalf, or redirect to the official portal. Ambiguity here is a
product defect, not a copy issue.

Lifecycle and statuses (database-enforced):
`submitted → reviewing → processing → awaiting_information → completed`, with
`closed`, `rejected`, `cancelled` as terminal states. Transitions happen through
the admin queue and are audit-logged.

States and rules:

- **Service with no live workflow** — honest coming-soon panel, never a fake form
  (`routes.tsx` `liveServiceSlugs`).
- **Double submission** — the button disables while submitting *and* the server
  rejects duplicates; the reference code is unique.
- **Upload failure** — the request is not submitted; the student can retry
  without re-entering data.
- **Tracking privacy** — tracking is authenticated and owner-scoped. The legacy
  public reference-code lookup was revoked during public-release hardening
  (`docs/DATABASE.md`), which is the safe default: a reference code alone must
  never reveal personal data.
- **WhatsApp** — the operational channel is a notification layer, never the
  system of record; `service_requests` + audit log is the record.

Edge cases: session expiry mid-wizard (preserve entered data where possible);
service deactivated while in progress; request rejected/closed with a reason.

---

## F. CBT

```
Open /cbt → select exam → /cbt/setup/:exam → instructions → select subjects
→ start attempt → question → select answer → save → navigate → review
→ submit → server validates → server scores → attempt stored → result shown
```

Rules:

- Scoring is **never** client-side. Guests are scored by `POST /api/cbt/guest-submit`
  (rate-limited); signed-in students by the subject-aware RPCs.
- Answer keys are not browser-readable (`exam_questions` is revoked from
  clients).
- One in-progress attempt per student per exam; the attempt records the selected
  subjects and the resume position so a refresh does not lose work.
- An exam with no usable question bank must not start: the student gets the
  honest message already mapped in `lib/errors.ts` ("This CBT is not ready yet…").
- Paper composition (English 60, other subjects 40; subject alias normalisation)
  is decided by the server RPC, not the UI.

### F2. CBT failure recovery

| Failure | Required behaviour |
|---|---|
| Browser refresh mid-attempt | Attempt state reloads from the server; answers already saved are intact; the timer is authoritative server-side |
| Network interruption | Answers queue locally and re-sync; the UI shows a connection warning, not a lost attempt |
| Duplicate submission | Second submit is refused; the existing result is returned instead of creating a second attempt |
| Expired attempt | Clear expiry message with the option to start a new attempt (no score invented) |
| Session expiry | Sign-in prompt that returns to the same attempt |
| Server error on submit | Attempt preserved; a safe retry is offered; never a silent failure |
| Invalid/missing question | Submission validation fails with a message the student can act on |
| Time expiry | Auto-submit with the answers held at expiry; result still produced |
| Guest cleared storage | Scorecard route explains the result is no longer available locally and offers practice again |

Analytics: `cbt_start` and `cbt_submit` exist today; `cbt_result_viewed` is
tracked as AN-1.

---

## G. Dashboard (what matters now)

Sections, each driven by real data, each with an honest empty state:

| Section | Source | Empty state |
|---|---|---|
| Continue where you left off | In-progress CBT attempt, unfinished profile | "Nothing in progress" |
| Updates that affect you | Published, unexpired news matched to institution/exam interest | "No updates for your profile yet" |
| Deadlines | `edureach_deadlines` + active opportunity deadlines | "No deadlines recorded" |
| My requests | `service_requests` (owner) | "You have not applied for a service yet" + link to catalogue |
| CBT progress | `cbt_attempts` | "No practice attempts yet" + link to `/cbt` |
| Saved items | `student_saved_items` | "Nothing saved yet" |
| Notifications | `student_notifications` unread | Hidden when empty |

The dashboard must not become a wall of decorative cards: a section with no data
either states why or is omitted, and every number shown must be traceable to a
row the student can open.
