# 00 — Product Definition

## The problem

A Nigerian student navigating tertiary education has to hold together
information and processes that live in a dozen unconnected places: an
examination body's portal, a loan fund's application window, an institution's
admission list, a scholarship deadline, a result-checking flow, and word of
mouth on WhatsApp. The information is time-sensitive, sometimes conflicting, and
usually unverified. The student's real question is never "where do I read news?"
— it is:

> **What do I need to do next, by when, and where do I do it officially?**

## What EduReach is

An independent student-support platform that (a) keeps a verified, freshness-managed
record of the updates that affect Nigerian students, (b) provides academic
practice and planning tools, and (c) helps students complete specific
student-service processes — while always pointing at the official body that owns
the underlying decision.

## Who it is for

| Audience | Primary need | Where they spend time |
|---|---|---|
| Prospective undergraduate (UTME/Post-UTME candidate) | Admission requirements, exam practice, screening scores, admission lists | `/jamb`, `/post-utme`, `/cbt`, `/screening-calculator`, `/schools` |
| Current undergraduate | Institution updates, results, CGPA tracking, opportunities, service support | `/dashboard`, `/cgpa-calculator`, `/news`, `/jobs`, `/services` |
| Post-secondary/polytechnic/college student | Same as above, filtered to their institution type | `/schools`, `/news`, `/jobs` |
| Graduate awaiting service | NYSC mobilisation, jobs, internships | `/news`, `/jobs` |
| EduReach operations staff | Publishing, processing, moderation, data quality | `/admin/*` |

## Product pillars

The five pillars from the September audit are adopted as the product identity.
Every feature must belong to exactly one:

| Pillar | Promise to the student | Surfaces |
|---|---|---|
| **Prepare** | Practise and calculate what determines your admission | `/cbt`, `/past-questions`, `/screening-calculator`, `/tools/cgpa-calculator` |
| **Stay updated** | Know what changed, when it changed, and whether it still applies | `/news`, `/events`, dashboard updates |
| **Find opportunities** | See funding, jobs and programmes you can still apply for | `/jobs`, `/scholarships`, dashboard deadlines |
| **Find your school** | Look up an institution and reach its official source | `/schools`, `/schools/:slug` |
| **Get student support** | Get help completing a specific student process, with tracking | `/services`, `/services/:slug`, `/services/apply/:slug`, dashboard requests |

## What EduReach is not

These are decisions, not omissions. They protect trust, which is the platform's
core asset.

1. **Not a general news site.** Ingestion is filtered to education relevance; a
   football or entertainment story is rejected even from a Tier 1 source.
2. **Not an official body.** EduReach is not JAMB, WAEC, NECO, NABTEB, NELFUND,
   NYSC, NUC, NBTE, TETFund, a ministry, or any institution. Every ingested
   article carries an independence statement, and official actions link out to
   the official portal.
3. **Not an admission-guarantee service.** No wording anywhere promises
   admission, a loan, a scholarship or a result.
4. **Not a document mill.** Services perform defined, described work — not
   "we'll sort it for you".
5. **Not a data hoarder.** Personal data is collected only where a journey needs
   it (see `02-DATA-MODEL.md` and `05-BUSINESS-RULES.md`).
6. **Not a payment platform *yet*.** Wallet/payment tables exist but no product
   surface or fee model is live. Any monetisation must first define terms,
   refunds and a disclaimer (open decision D2), because monetisation must not
   compromise trust.
7. **Not an instructor-led learning product.** There is no instructor role, no
   cohorts, no assignments. CBT is self-service practice.

## Trust rules (non-negotiable)

| Rule | Enforcement |
|---|---|
| Students must always be able to tell EduReach's words from the source's | Provenance fields on every ingested article (`source_name`, `source_url`, `source_published_at`, `source_tier`) and a standing independence sentence in the body |
| Unverified or unactionable content must not be presented as current | `verification_status` + `expires_at` + the daily expiry sweep; expired articles leave the feed and show an expired banner on their page |
| A closed opportunity must never appear open | `close_expired_opportunities()` sweeps past deadlines; the public list filters `is_active` and `closed_at is null` |
| A CBT must never open without usable questions | `content_integrity_report()` counts active exams with no or too few questions; a product failure is treated as one |
| No fabricated content, ever | No static news dataset, no invented institution programmes, no seeded demo bank presented as real, no placeholder questions |
| The student's own data is theirs | Owner-scoped RLS on student tables; public surfaces expose no personal data |

## How EduReach knows it is working

Product metrics answer decisions, not vanity questions.

| Question | Signal | Source |
|---|---|---|
| Do students find what they need? | Search → result → action rate | `site_analytics_events` (`search`) |
| Where do they abandon? | CBT start → submit → result funnel; service view → submit funnel | `cbt_start`, `cbt_submit`, `service_view`, `service_submit` |
| Is the newsroom alive? | Sources healthy, published/reviewed per day, review-queue age | `news_ingest_runs`, `news_ingest_candidates` |
| Is the content trustworthy? | Integrity counters: missing sources, expired-but-published, duplicate keys | `content_integrity_report()` |
| Are services actually delivering? | Request age by status, completion rate, requests awaiting information | `service_requests` |
| Is the platform healthy? | Readiness probe, DB latency, source failures | `/api/health/ready`, run reports |

## Success definition (next two phases)

A student can, without help: create an account, land on a dashboard that shows
their real information, find a verified update, tell whether it is still current,
practise an exam whose question bank is real, apply for one service, track it to
completion, and never once believe EduReach is the government body behind it.
