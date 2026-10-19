# Documentation

## Reference

| Document | Contents |
| --- | --- |
| [ROUTES.md](ROUTES.md) | Every route, who can open it and whether it is live |
| [DATABASE.md](DATABASE.md) | Tables, migrations and row-level security |
| [SUPABASE_SECURITY_CHECKLIST.md](SUPABASE_SECURITY_CHECKLIST.md) | Settings to verify on the database side before a release |
| [PAGE_QUALITY_GATE.md](PAGE_QUALITY_GATE.md) | Definition of done for a page |
| [functional-qa-gate.md](functional-qa-gate.md) | Manual pass before a deploy |
| [COMPONENT_RULES.md](COMPONENT_RULES.md) | Component conventions |
| [DESIGN_RULES.md](DESIGN_RULES.md) | Layout and interaction rules |
| [COLOR_THEME_SPEC.md](COLOR_THEME_SPEC.md) | Colour tokens |
| [DATA_SOURCES.md](DATA_SOURCES.md) | Where academic content comes from |
| [SERVICE_MAP.md](SERVICE_MAP.md) | Student services and the flows behind them |
| [ADMIN_CONTROL_CENTRE_MAP.md](ADMIN_CONTROL_CENTRE_MAP.md) | Admin screens and what each one controls |
| [NEWSROOM_PIPELINE.md](NEWSROOM_PIPELINE.md) | Ingestion, dedupe, quality gate and publishing |
| [LOCAL_INTEGRATION.md](LOCAL_INTEGRATION.md) | Running against a local Supabase and stub data |
| [DEPLOYMENT_DECISION.md](DEPLOYMENT_DECISION.md) | Why the app runs as an Express server on Netlify |
| [NETLIFY_PRODUCTION_SETUP.md](NETLIFY_PRODUCTION_SETUP.md) | One-time production setup |

## Directories

- [architecture/](architecture/) holds the product definition, data model, roles,
  journeys, business rules and design system that the implementation follows.
- [features/](features/) holds one contract per cross-cutting feature (analytics,
  accessibility, performance, notifications, search, SEO and so on).
- [operations/](operations/) holds the production runbook, backup and restore
  procedure, observability notes and the dependency upgrade plan.

If a document stops matching the code, update it or delete it in the same change.
