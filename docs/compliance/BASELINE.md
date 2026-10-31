# EduReach Hub — privacy, legal and accessibility work

Status: **in progress**. This is an engineering workstream, not a statement of legal certification.

## Confirmed product model

The owner confirmed that EduReach Hub is free today and may introduce paid services or subscriptions later. The current public refund page therefore states that paid services are not currently offered and leaves future eligibility, time limits, and billing terms unpublished until the actual offer is defined.

## Baseline findings from repository inspection

- Public legal pages already use `pages/LegalPage.tsx` and administrator-managed `site_pages` content. The current policy slug allowlist is `privacy`, `terms`, `cookies`, `accessibility`, `disclaimer`, and `contact`.
- A refund-policy route and public footer link have been added as a separate draft framework. It deliberately does not invent refund windows or payment arrangements.
- The registration UI currently requires first name, last name, email, phone, password, and terms/privacy agreement. Phone is also copied into auth metadata and the profile. Its necessity and downstream dependencies must be mapped before removing the requirement.
- First-party product analytics are sent to the site's own API. The analytics taxonomy limits event metadata and defines 90-day raw-event retention. The new consent gate blocks these events unless optional analytics is explicitly enabled.
- The repository already has `npm run a11y:audit`, Playwright/axe tests, and documented keyboard/contrast remediation. These are existing controls; they still need a fresh CI run and review.
- The current `package.json` dependency inventory includes React, Supabase JS, Express, Vite, TypeScript, Playwright/axe, PDF parsing, XML parsing, and JSZip. A package inventory is not a complete SDK or licence audit. Transitive dependencies, deployed scripts, remote assets, and each asset's licence still need verification.
- The app's authentication and service workflows use Supabase. Account deletion must be designed around actual foreign keys, storage buckets, retention duties, and server-side authorization before implementation.

## Changes in this branch

1. Added versioned privacy-preference storage with a fail-closed default.
2. Added a cookie/privacy banner with equally visible reject, customize, and accept choices, plus a persistent settings control.
3. Gated first-party analytics events on explicit analytics preference.
4. Added a refund-policy route and footer link that accurately describes the current free-only state and marks future billing terms as pending.

## Remaining implementation and verification

- Run typecheck, unit tests, build, existing analytics audit, full CI, and browser axe checks.
- Inventory actual browser storage, cookies, network destinations, Google Fonts usage, image sources, and third-party scripts in the deployed app. Do not label a technology as a cookie if it is not one.
- Map the purpose and necessity of every registration and service-form field. In particular, trace phone-number usage before deciding whether it can be optional.
- Complete and legally review the privacy notice, terms, cookie policy, and accessibility statement against actual processing, operator identity, contact details, retention, vendors, cross-border transfers, and age eligibility.
- Confirm the real operator/business identity and a monitored privacy/support contact. Do not publish invented company registration details or contact addresses.
- Determine the site's age eligibility and the applicable child-data safeguards before implementing parental-consent collection.
- Design a secure authenticated data-access and account-deletion workflow. Identify all user-linked database rows, storage objects, analytics records, audit records, and lawful retention exceptions. Never expose a Supabase service-role/secret key in browser code.
- Review SMTP and email templates before claiming that privacy-request notifications, marketing unsubscribe, or verification emails work. Implement unsubscribe only for promotional mail streams that exist.
- Review fonts, logos, illustrations, and all other image assets for provenance and licence evidence.
- Review pricing, renewal, cancellation, and checkout disclosure before enabling any paid feature.
- Re-run contrast and keyboard tests on real routes and modal/banner interactions. Automated checks do not replace manual review.

## Release controls

This branch is not deployed. Do not merge or deploy until CI is green, the data-deletion and consent flows are verified, the owner supplies the outstanding operator/contact/age details, and policy content receives appropriate legal review. No production database or Supabase settings were changed by this workstream.
