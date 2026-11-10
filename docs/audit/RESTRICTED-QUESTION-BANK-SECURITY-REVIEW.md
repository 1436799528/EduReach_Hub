# Restricted question-bank security: local review and release blocker

**Status: NOT IMPLEMENTED. Do not use the current application for confidential examinations.** This document records a local code review and synthetic tests, not a hosted assessment. The existing database, server routes, and guest-practice behavior have not been changed by this review. No candidate migration is provided; adding a classification alone would falsely suggest the existing answer-bearing paths are secure.

## Owner decisions

- Existing banks require an explicit administrator-approved inventory; do not infer public or restricted status. Unclassified banks must fail closed in the eventual cutover, so practice can be interrupted until approved banks are classified.
- Authorized administrators assign individual students to restricted banks.
- Restricted corrections are released at an administrator-set time. No key secrecy can be restored for material already disclosed.

These decisions do not, by themselves, establish a secure implementation. In particular, immediate aggregate scoring is a potential key oracle (below). A score embargo through release, or a separately reviewed attempt-limiting policy robust to multiple authorized accounts, is needed; the former changes pre-release result behavior for restricted banks.

## Confirmed attack surfaces

1. `GET /api/cbt/exams/:examId/guest-questions` and `POST /api/cbt/guest-submit` query the same active `exam_questions` bank through a service-role client; the latter returns correct options and explanations for every attempted position. A full response can disclose the full guest paper's key. `is_active` and `review_status` are not confidentiality classifications. See `CBT-SHARED-BANK-RELEASE-SAFETY-2026-11-07.md` and `tests/guest-cbt-disclosure.test.ts`.
2. Even where direct `exam_questions` table access is revoked, authenticated `SECURITY DEFINER` RPCs `get_cbt_questions` and `get_cbt_questions_for_subjects` return question text and options for an active bank without candidate assignment. Start functions likewise have no assignment checks. The owner-filtered frozen-paper reader is not sufficient if an unassigned user can create an attempt or call another reader directly.
3. The configured submit RPC returns key-bearing breakdowns, including on retries. Legacy submit variants and `get_cbt_result` are additional answer-bearing RPCs. A permitted candidate could share immediate corrections with other candidates before the examination window closes. Correctness feedback must be embargoed consistently, not just `correct_option` and `explanation`.
4. `tests/restricted-bank-existing-exposure.test.ts` demonstrates in disposable PGlite PostgreSQL that a user can submit two attempts differing at one position and compare scores to infer that position's correctness. Scores are also readable directly in the owner's `cbt_attempts` row. Hiding corrections in a server response while leaving aggregate scores or per-answer `is_correct` available does not establish key secrecy.
5. The server also reads some papers and metadata with service-role privileges, so RLS alone cannot protect all paths. Direct table grants, all callable definer functions, server-side service-role queries, and any v2 rehearsal paths must be independently fenced. V2 creation must stay disabled.
6. CBT administration uses `cbt.read`/`cbt.manage`, while the generic content manager includes `cbt_exams` and `exam_questions` under `data.read`/`data.write`/`data.import`. Authorization must be resource-specific across both paths. `requireCapability` means **any** listed capability, so the question-import guard `requireCapability('cbt.manage', 'data.import')` is an OR, not an AND. The eventual policy must explicitly decide whether those existing roles are authorized for restricted content and prevent alternative CMS/import paths from bypassing that policy.
7. `plan_cbt_paper`, `cbt_plan_summary`, subject availability, legacy readers, configured and older start/submit functions, result RPCs, attempt history, direct owner-scoped `cbt_attempts` access, and privileged HTTP paths need an exhaustive grant and information-flow review. A simple table RLS policy cannot constrain security-definer owners or service-role queries. Existing v2 executor policies and function grants also require review without enabling v2.

## Required boundary and migration considerations

This is a design checklist, not an implemented or deployable specification:

- Add an authoritative fail-closed bank classification and per-bank candidate assignments only after checking actual migration state and role grants. Establish whether bank-level homogeneity is enforced, or a more granular question-level rule is required; mixed or reassigned records must not cause a restricted question to enter a public paper. Newly created/imported banks or questions must never become public merely from activity or editorial status.
- Inventory existing banks and previously disclosed content. An authorized administrator should explicitly classify each bank, set release rules, and assign candidates; no blanket backfill. Preserve records and attempt/answer identifiers. Past public disclosure disqualifies material from true secrecy even if it is subsequently marked restricted.
- Enforce eligibility in every start, resume, paper, discovery, direct RPC and server service-role path. Decide and test revocation and existing in-progress attempts explicitly. Make administration, assignment, review, publication and archive authorization explicit on both server and database boundaries. Keep service keys server-only. Do not rely on browser visibility.
- Enforce correction-release semantics in every submit/retry/result path and all direct reads, including `cbt_attempts` scores and per-answer correctness. Either embargo scores and correctness until release, or establish and test a genuinely sufficient alternative against score-differential and collusion oracles. Preserve public-practice corrections. Changing legacy result shapes and dashboard ownership queries can affect existing clients.
- Cut over server and database atomically or with a fail-closed version/readiness gate. A mixed deployment, old backend, stale RPC, older client, incomplete classification inventory, or unreviewed hosted drift can leak restricted data or interrupt public practice. Rollout requires backup, hosted catalogue/grant/policy reconciliation, owner-approved inventory, and staging tests; do not blindly apply a migration.
- Exercise synthetic anonymous/public/restricted access, assigned and unassigned students, assignment revocation, admin capability boundaries, direct table/RPC/API attacks, post-submit/retry/results before and after release, score oracles, legacy attempts, imports/review/publication/archive, and v2 isolation. Test locally using disposable roles and independently verify actual hosted Auth/PostgREST/JWT and role configuration in an approved staging environment before any release.

## Local evidence

- `tests/guest-cbt-disclosure.test.ts` exercises the real Express guest handlers against a synthetic PostgREST stub and shows full-paper correction disclosure.
- `tests/restricted-bank-existing-exposure.test.ts` replays repository migrations into local PGlite with synthetic users/questions, sets the `authenticated` role and synthetic subject claim, and demonstrates denied direct table access alongside unrestricted legacy readers, key-bearing submit/results, repeated attempts, and direct owner-visible aggregate scores. The assertions characterize the **existing vulnerability**, not protection.
- The local RLS posture audit reporting zero findings only says its classified table checks passed; it does not prove service-role, definer-RPC, score-oracle or hosted security.

No hosted Supabase service, hosted data or policy was contacted or changed. This review is not a release approval.
