# EduReach Hub — Architecture Package

This directory is the authoritative product and system architecture for EduReach
Hub. It exists because the platform is no longer small enough for implicit
decisions: every screen, endpoint, table and automation needs a documented
reason to exist, and the audit of 30 September 2026 showed the operational layer
was lagging the application layer.

**Rule for this directory:** nothing gets implemented before it is described
here, and nothing described here is implemented without the acceptance checks it
lists. When code and document disagree, the code is wrong until proven
otherwise — or the document is updated in the same change.

## Documents

| # | Document | Answers |
|---|---|---|
| 00 | [Product definition](00-PRODUCT-DEFINITION.md) | What EduReach is, for whom, and what it deliberately is not |
| 01 | [Information architecture](01-INFORMATION-ARCHITECTURE.md) | Every route, its audience, and the canonical/alias policy |
| 02 | [Data model](02-DATA-MODEL.md) | Every entity, who owns it, how correctness is known |
| 03 | [Roles and permissions](03-ROLES-AND-PERMISSIONS.md) | Who may do what, and where that is enforced |
| 04 | [User journeys](04-USER-JOURNEYS.md) | The flows, their states and their failure behaviour |
| 05 | [Business rules](05-BUSINESS-RULES.md) | The rules the system must never break |
| 06 | [Design system](06-DESIGN-SYSTEM.md) | Tokens, components, state completeness, responsive and a11y rules |
| 07 | [Feature catalogue](07-FEATURE-CATALOGUE.md) | Every feature, its status, dependencies and build order |
| 08 | [Feature template](08-FEATURE-TEMPLATE.md) | The required structure for any new feature, with a worked example |

Existing documents these extend rather than replace:
`docs/DESIGN_RULES.md`, `docs/COMPONENT_RULES.md`, `docs/COLOR_THEME_SPEC.md`,
`docs/PAGE_QUALITY_GATE.md`, `docs/ROUTES.md`,
`docs/EDUREACH_ROUTE_MATRIX_2026-09-29.md`, `docs/DATABASE.md`,
`docs/DATA_SOURCES.md`, `docs/NEWSROOM_PIPELINE.md`,
`docs/SUPABASE_SECURITY_CHECKLIST.md`, `docs/DEPLOYMENT_DECISION.md`.

## Status legend

| Mark | Meaning |
|---|---|
| ✅ | Implemented and verified in the repository |
| 🟡 | Partially implemented — stated scope is wider than the code |
| 🔴 | Specified, not implemented |
| ⚪ | Out of scope by decision (documented, deliberately not built) |

Status describes **repository state**. Production state must be confirmed against
the live Supabase project (audit P0-1) using `npm run newsroom:integrity` and
`GET /api/health/ready`; the repository cannot certify a database it does not
create.

## Decisions currently open

These change architecture and are not yet settled. Each has a documented interim
assumption so work can continue safely.

| # | Decision | Status | Where it lands |
|---|---|---|---|
| D1 | Role granularity: one staff role, or split content editor / service admin / super admin | **Decided (2026-09-30): capability layer implemented (ROLE-1); the role split is now an assignment, not a rewrite.** Four roles exist end to end, legacy staff map to `super_admin`, and `senate_admin`/`campus_agent` are retired. Remaining: assign the narrower roles to real accounts | `03-ROLES-AND-PERMISSIONS.md`, `../features/ROLE-1.md` |
| D2 | Payment/wallet: schema exists (`student_wallet_transactions`, `payment_events`), no product surface | **Locked: out of scope** until a fee model with terms, refunds and a disclaimer is agreed. The tables stay unused rather than half-used | `07-FEATURE-CATALOGUE.md` |
| D3 | Public reference-code tracking by an unauthenticated student | **Locked: tracking stays authenticated-only.** The legacy public lookup RPC was already revoked; a reference code alone must never reveal student data | `05-BUSINESS-RULES.md` |
| D4 | Search backend: client-side datasets vs Supabase full-text | Open — keep current behaviour; revisit when row counts make it slow | `07-FEATURE-CATALOGUE.md` |
| D5 | Deployment platform (Netlify vs Vercel) | Open — Netlify recommended, documented in `docs/DEPLOYMENT_DECISION.md` | `docs/DEPLOYMENT_DECISION.md` |

## How work proceeds

1. Pick the next feature from `07-FEATURE-CATALOGUE.md`, in dependency order.
2. Write or update its entry using `08-FEATURE-TEMPLATE.md`.
3. Implement that one feature — frontend, server, database and tests together.
4. Validate its complete logic (states, edge cases, security, failure paths) and
   record the evidence.
5. Only then start the next feature.

Work that spans several features at once is split, not merged.
