# Documentation index

**Authoritative document for release decisions:**
[`PRODUCTION_AUDIT_2026-10-04.md`](PRODUCTION_AUDIT_2026-10-04.md) — every
finding it records has a remediation status section. Earlier audits are kept for
history only; where they disagree with it, they are wrong.

> P3-7: before this index existed, `docs/` held 32 markdown documents and 15
> date-stamped audit reports with no way to tell which one was current. This file
> is the answer to that question. When you add a report, add it here and mark
> what it supersedes.

## Current (rely on these)

| Document | What it is |
| :--- | :--- |
| [`PRODUCTION_AUDIT_2026-10-04.md`](PRODUCTION_AUDIT_2026-10-04.md) | **Authoritative audit.** Findings P0-1…P3-7, strengths, blind spots, release checklist, remediation status |
| [`ROUTES.md`](ROUTES.md) | Route inventory and quality status |
| [`DATABASE.md`](DATABASE.md) | Schema, migrations and RLS posture |
| [`SUPABASE_SECURITY_CHECKLIST.md`](SUPABASE_SECURITY_CHECKLIST.md) | Database-side security checklist for a release |
| [`PAGE_QUALITY_GATE.md`](PAGE_QUALITY_GATE.md) | Definition of done for a page |
| [`functional-qa-gate.md`](functional-qa-gate.md) | The functional QA gate |
| [`COMPONENT_RULES.md`](COMPONENT_RULES.md) · [`DESIGN_RULES.md`](DESIGN_RULES.md) · [`COLOR_THEME_SPEC.md`](COLOR_THEME_SPEC.md) | Design system contracts |
| [`DATA_SOURCES.md`](DATA_SOURCES.md) · [`SERVICE_MAP.md`](SERVICE_MAP.md) · [`ADMIN_CONTROL_CENTRE_MAP.md`](ADMIN_CONTROL_CENTRE_MAP.md) | Product maps |
| [`NEWSROOM_PIPELINE.md`](NEWSROOM_PIPELINE.md) · [`LOCAL_INTEGRATION.md`](LOCAL_INTEGRATION.md) · [`DEPLOYMENT_DECISION.md`](DEPLOYMENT_DECISION.md) · [`NETLIFY_PRODUCTION_SETUP.md`](NETLIFY_PRODUCTION_SETUP.md) | Operations |

## Feature and architecture references

| Path | What it is |
| :--- | :--- |
| [`architecture/`](architecture/) | Architecture decision records (business rules, data model, etc.) |
| [`features/`](features/) | Per-feature contracts (AN-1 analytics, D5 environment contract, …) |
| [`operations/`](operations/) | Runbook, backup/restore, dependency upgrade plan |

## History (do not use for decisions)

These were accurate when written. Each one's findings were re-checked by the
2026-10-04 audit, which records what was still true. Kept because the reasoning
and the recorded state at each date are evidence, not because they are current.

| Report | Superseded by |
| :--- | :--- |
| [`FULL_AUDIT_2026-09-21.md`](FULL_AUDIT_2026-09-21.md), [`PROD_AUDIT_2026-09-21.md`](PROD_AUDIT_2026-09-21.md), [`LINK_AUDIT_2026-09-21.md`](LINK_AUDIT_2026-09-21.md) | Every later report |
| [`FULL_AUDIT_2026-09-24.md`](FULL_AUDIT_2026-09-24.md) · [`FULL_AUDIT_2026-09-25.md`](FULL_AUDIT_2026-09-25.md) · [`FULL_AUDIT_2026-09-26.md`](FULL_AUDIT_2026-09-26.md) | 2026-09-27 onward |
| [`PROGRAMMING_AUDIT_2026-09-26.md`](PROGRAMMING_AUDIT_2026-09-26.md) | 2026-09-27 onward |
| [`PRODUCTION_AUDIT_2026-09-26.md`](PRODUCTION_AUDIT_2026-09-26.md) | 2026-10-04 |
| [`POSTMERGE_DATA_CONTROL_AUDIT_2026-09-27.md`](POSTMERGE_DATA_CONTROL_AUDIT_2026-09-27.md) | 2026-10-04 |
| [`EDUREACH_ROUTE_MATRIX_2026-09-29.md`](EDUREACH_ROUTE_MATRIX_2026-09-29.md), [`EDUREACH_USER_WORKFLOW_AUDIT_2026-09-29.md`](EDUREACH_USER_WORKFLOW_AUDIT_2026-09-29.md), [`FULL_SITE_AUDIT_2026-09-29.md`](FULL_SITE_AUDIT_2026-09-29.md), [`FRONTEND_COMPLETION_REPORT_2026-09-29.md`](FRONTEND_COMPLETION_REPORT_2026-09-29.md) | [`ROUTES.md`](ROUTES.md) / 2026-10-04 |
| [`PRODUCTION_READINESS_AUDIT_2026-10-01.md`](PRODUCTION_READINESS_AUDIT_2026-10-01.md) | 2026-10-04 |
| [`FINAL_COMPLETION_AUDIT_2026-10-02.md`](FINAL_COMPLETION_AUDIT_2026-10-02.md) | 2026-10-04 |
| [`UX_STUDENT_EXPERIENCE_REMEDIATION_2026-10-03.md`](UX_STUDENT_EXPERIENCE_REMEDIATION_2026-10-03.md) | 2026-10-04 |
| [`../EDUREACH_FULL_AUDIT.md`](../EDUREACH_FULL_AUDIT.md) (repository root) | 2026-10-04 — kept at the root only because moving it would break inbound links |
