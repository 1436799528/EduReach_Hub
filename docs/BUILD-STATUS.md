# BUILD STATUS — EduReach Hub backend rebuild

| Field | Value |
| --- | --- |
| Milestone | **001 — Discovery and architecture** |
| Status | **Complete, with one blocked action** (backend repository creation) |
| Date | 2026-10-31 |
| Branch | `arena/e52320f9-edureach-hub` (documentation only; nothing staged, committed or pushed) |
| Frontend repository | **Unchanged** |
| Old backend | **Unchanged and still authoritative** |
| Production data / config | **Untouched** |
| Hosted database | **Not contacted for mutation. Not migrated.** |

---

## 1. What was produced

| Deliverable | File | State |
| --- | --- | --- |
| System architecture | `docs/architecture/SYSTEM-ARCHITECTURE.md` | Complete |
| Database design | `docs/architecture/DATABASE-DESIGN.md` | Complete |
| API contract | `docs/api/API-CONTRACT.md` | Complete |
| Frontend integration map | `docs/migration/FRONTEND-INTEGRATION-MAP.md` | Complete |
| Security requirements | `docs/architecture/SECURITY-REQUIREMENTS.md` | Complete |
| Build status | `docs/BUILD-STATUS.md` | This file |
| Phased implementation plan | `docs/migration/PHASED-PLAN.md` | Complete |

## 2. Discovery evidence (what the documents are based on)

Read directly from this repository — no assumptions:

- `package.json`: React 19, Vite 6, TypeScript 5.8, Express 4, Supabase JS,
  `serverless-http`, `pdf-parse`, `jszip`, `fast-xml-parser`, `tsx`, Playwright,
  PGlite. Node ≥ 22.12.
- `server.ts`: ~70 routes enumerated by method and path (public, student CBT,
  admin); auth via bearer token + `requireCapability`/`requireUser`; rate-limit
  rules; storage buckets; audit writes.
- `src/lib/api.ts`: 94 exported client functions; `src/lib/apiBase.ts` fixes the
  production base path to `/.netlify/functions/api`.
- `src/lib/auth.tsx`, `src/lib/capabilities.ts`: Supabase Auth session model,
  4 application roles + 2 legacy aliases, 30 capabilities, path→capability map.
- `src/lib/envContract.ts`: the environment contract (client vs server, secret vs
  public, aliases).
- `scripts/rls-posture.ts`: 52 classified tables; `netlify.toml`: function
  bundling and `/api/*` rewrite.
- 13 direct browser→Supabase table reads and 2 RPCs (the gap the new API must
  close).
- `supabase/migrations` (85 files) and the previously recorded hosted ledger
  (195 rows) — i.e. the lineages diverge, which is why the rebuild starts a fresh
  history instead of replaying.

## 3. Blocked: backend repository creation

The task's architecture decision #1 is to create `EduReach-Hub-Backend`. This
milestone forbids pushing, and the discovery brief says that when repository
creation is not authorised or available, the specification must be prepared and
what is needed reported **without** creating an alternative repository.

Current state, verified:

- `gh` is authenticated to github.com as **`1436799528`** (the owner of
  `EduReach_Hub`).
- `EduReach_Hub` is public, default branch `main`, at `ac66747`.
- **No repository creation was attempted and no repository was created.**

To unblock, the owner needs to authorise one of:

```bash
# Option 1 — owner runs it, or approves the agent to run it:
gh repo create 1436799528/EduReach-Hub-Backend --private \
  --description "EduReach Hub backend (Node/TS/Express/Postgres/Drizzle)"
```

and confirm: visibility (private recommended), GitHub account/organisation, and
whether branch protection + CI should be set up at creation time. The token in
this sandbox was not verified for `Administration: write` on the account; if the
call is refused, the owner must create the repository in the GitHub UI and add
the sandbox as a collaborator.

## 4. Decisions required before Phase 1

| # | Decision | Options | Recommended |
| --- | --- | --- | --- |
| D1 | Identity provider | keep Supabase Auth (verify JWT) vs backend-owned auth | **keep Supabase Auth in phase 1**, revisit later |
| D2 | Database host | Supabase Postgres / Neon / RDS / Vercel Postgres | whichever supports a pooled connection + separate migration credentials |
| D3 | Object storage | Supabase Storage / S3 / R2 | keep Supabase Storage for phase 1 (smallest delta) |
| D4 | SEO surfaces | backend-served `/sitemap.xml`, `/robots.txt` vs generated in the frontend build | generate in the frontend build (removes a backend dependency) |
| D5 | Newsroom ingestion | inside the backend vs separate worker | inside the backend initially |
| D6 | v2 CBT writing | enable after gateway vs leave disabled | leave disabled |
| D7 | Audit + import-source retention | owner-defined periods | not decided here (no invented default) |
| D8 | Old database data | no migration vs a later approved migration | **no migration** in this programme |

## 5. Verification performed for this milestone

- The repository was read only; `git status` shows documentation additions only.
- No `npm` script that mutates data or deploys was run.
- No Supabase connector call was made in this milestone (no reads, no writes, no
  migrations, no branching).
- No Vercel action was taken.

## 6. Risks and open questions

1. **Repository creation blocked** (§3) — the largest scheduling risk.
2. **Identity choice (D1)** determines the size of the frontend auth change; it
   must be settled before phase 2.
3. **Direct Supabase reads** (13 tables) are the biggest frontend-integration
   risk; endpoints for them do not exist today and must be specified in phase 3/5.
4. **Frozen v1 quirks** (position-keyed answers, `protocol: {version:1}`, guest
   404s, `score: null`) must be treated as contract, not as debt to clean up
   mid-migration.
5. **Data migration is out of scope** and must stay out of scope until the new
   backend passes staging; the old ledger cannot be replayed blindly.
6. **SEO routes** currently served by the API function; moving them is a small
   but real crawler risk.

## 7. Next action

Owner confirms §3 (repository) and D1–D2, then Phase 1 (foundation) can start.
No implementation work has begun.
