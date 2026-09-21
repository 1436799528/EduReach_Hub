# EduReach Hub — Full Code Audit & Link Test (21 Sep 2026)

Method: static crawl of every `href`, `pushState`, `window.location` and `onClick` in
`pages/` + `src/`, cross-checked against `src/app/routes.tsx`; `tsc --noEmit`;
`vite build`; live Express+Vite server smoke test (HTTP + content-type per path);
Myschool.ng reference structure analysis (fetched 21 Sep 2026).

## 1. Verdict

| Area | Result |
|---|---|
| TypeScript (`npm run lint`) | ✅ 0 errors (was 14) |
| Production build | ✅ passes (712 KB JS / 183 KB CSS — code-split later) |
| SPA deep-link serving (server) | ✅ all paths + Netlify fallback OK |
| Client router (`renderRoute`) | ⚠️ 16 advertised paths fall through to `NotFoundPage` |
| Every header/footer/nav link | ✅ resolves to a real page |
| Homepage tiles | ⚠️ 8 of 12 data-driven tiles → 404 (see §3) |
| Buttons / filters / forms | ✅ all wired (CBT, tracker, catalog, news, jobs, auth, dashboard, admin) |
| Images | ✅ fixed this turn (was: 9 broken `<img>` sources) |
| Design-system unity | ❌ crimson `#D9381E` vs emerald `#059669` split — must lock one |
| Docs vs code | ❌ `ROUTES.md`, `PAGE_QUALITY_GATE.md`, `EDUREACH_FULL_AUDIT.md` stale in places |

## 2. Route matrix (client router truth)

### Real pages (render a genuine page) ✅
`/`, `/jamb`, `/waec`, `/neco`, `/post-utme`, `/cbt`, `/past-questions`,
`/cbt/practice`, `/cbt/results`, `/screening-calculator` (+aliases `/calculator`,
`/admission`, `/tools`, `/schools`), `/services`, `/services/track`, `/track`,
`/services/apply/:slug`, `/services/:slug`, `/nelfund`, `/results`, `/news`,
`/events`, `/news/:slug`, `/jobs`, `/scholarships`, `/login`, `/signin`,
`/register`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`,
`/profile`, `/profile/complete`, `/settings`, `/dashboard` (+ 9 sub-tabs),
`/admin` (+ analytics/queue/cbt/vouchers/users). Unknown URLs → `NotFoundPage` ✅.

### Advertised in `src/data/services.ts` but render `NotFoundPage` ❌
`/nabteb`, `/admission/consultation`, `/admission/schools`, `/admission/courses`,
`/admission/requirements`, `/admission/post-utme` (note: canonical Post-UTME page
is `/post-utme` — key/route mismatch), `/tools/school-fees`, `/tools/cgpa`,
`/tools/gpa`, `/tools/course-registration`, `/tools/timetable`, `/tools/calendar`,
`/tools/exam-countdown`, `/support`.
Per `docs/SERVICE_MAP.md` rule 6 these must get real pages phase by phase —
**not** aliased to approximate pages. Homepage impact: all 4 “Admission & Schools”
tiles + 4 of 8 “Student Tools & Funding” tiles currently 404.

### Misleading-but-resolving links ⚠️
- Exam-module sub-links (e.g. “JAMB Result”, “CAPS & Admission”) all collapse to
  the parent exam page; `ExamHubPage` sub-links mostly collapse to `/services`.
- `/admission`, `/schools`, `/tools` all render the screening calculator, not an
  admission/school/tools hub. Dashboard “Admission” tab exits to `/admission`.
- Jobs “Apply” buttons all land on generic `/services`.
- `fetchService()` / `fetchNewsItem()` **synthesize content for any slug**, so
  `/services/apply/bogus` renders a fake form and `/news/bogus` renders a fake
  “verified” article. Must throw honest not-found instead (Services/News phases).

## 3. Page-by-page link test

| Page | Links/buttons/cards | Status |
|---|---|---|
| `/` HubHome | notice, search→`/services?q=`, banner, exam modules, test strip, news rows, deadlines, admission + tools tiles | ⚠️ 8 tiles 404; rest ✅ |
| `/jamb` `/waec` `/neco` `/post-utme` | 6 sub-links each | ⚠️ resolve but collapse to `/services` |
| `/cbt` | mode pills (?mode= sync ✅), exam cards→practice, calculator + results CTAs | ✅ |
| `/cbt/practice` | palette, flags, keyboard, timer, submit→results | ✅ |
| `/cbt/results` | scorecard, corrections, print, retry | ✅ |
| `/screening-calculator` | weights, clamp, reset | ✅ |
| `/services` | `?q=` search ✅, category filter ✅, cards→apply ✅, track CTA ✅ | ✅ |
| `/services/apply/:slug` | 3-step wizard, validation, receipt `ER-…`, WhatsApp handoff, `?next=` for guests | ✅ |
| `/services/track` + `/track?ref=` | `?ref=` prefill ✅, 4-stage timeline, WhatsApp (number fixed) | ✅ |
| `/news` | category filter ✅, cards→article ✅ | ✅ |
| `/news/:slug` | body, source link, copy-link | ✅ (+honest-404 fix queued) |
| `/jobs` + `/scholarships` | filters ✅, rows render, Apply→`/services` | ⚠️ CTA too generic |
| Auth `/login` `/register` … | signin/signup/forgot/reset/verify, `?next=` ✅, admin→`/admin` ✅ | ✅ |
| `/profile`, `/profile/complete` | onboarding saves → `/dashboard` ✅ | ✅ |
| `/dashboard*` | 10 tabs + deep URLs ✅, back/forward ✅, `?ref=` receipt strip (fixed), school finder fields (fixed), CGPA/course modals, wallet, notifications, security | ✅ |
| `/admin*` | session guard → `/login` ✅ (should preserve `?next=`, queued), queue/CBT/vouchers/users actions | ✅ |
| Header/footer/mobile nav/bottom nav | all targets real | ✅ (visual rebuild phased) |

## 4. Myschool.ng reference — structural analysis (not visual copy)

Fetched homepage 21 Sep 2026. Structure top→bottom:
1. Utility strip (Log in / Create account) — account always visible.
2. Promo carousel (house products/challenges) — one slot, rotates, no giant hero.
3. **Exam simulator cards**: JAMB / WAEC / NECO / custom CBT — icon + title + 1-line desc, whole card clickable.
4. School selector (“select school for latest info”) — directory entry point.
5. Featured news (2 large: image, category, date, comments, share) + latest-news rows
   (category · title · date · comments) + “See all”.
6. Numbered trending list (Top 10).
7. Scholarships rail (image, title, level, country, deadline).
8. Scholarship promo panel + Store rows (product, price, Buy Now) + agent/centre promo.
9. Footer link columns + app download.

Mapping to EduReach (keep crimson `#D9381E` branding, no generic look):
Myschool “exam simulator cards” → EduReach exam-module cards (JAMB/WAEC/NECO/
Post-UTME + NABTEB); “school selector” → School Finder; “news rows + trending” →
noticeboard rows + deadline radar; “scholarships rail” → funding rail; “store rows”
→ services/pins rows with price + Apply; “utility strip + footer columns” →
EduReach header/footer (already close, needs density pass).

## 5. Component-by-component rebuild plan (one per chat)

0. **Design lock** (with Component 1): crimson primary, single card primitive,
   single section-head pattern, density tokens. Fixes emerald/crimson split and
   the `PAGE_QUALITY_GATE.md` (emerald) vs `COLOR_THEME_SPEC.md` (crimson)
   contradiction. No new CSS files; tame the 15 imported stylesheets.
1. Header + mobile drawer + bottom nav (Myschool utility-strip density).
2. Homepage exam-module cards (fix collapsed sub-links with real IA).
3. Homepage news rows + deadline radar (Myschool news-row pattern).
4. Services catalog + service cards (single card family; honest unknown-slug 404).
5. Service apply wizard + tracker + `?ref` flows.
6. CBT hall + practice + results (keep engine, unify chrome).
7. Exam hub pages (`/jamb`… + new `/nabteb`, fix `/admission/post-utme` mismatch).
8. Admission cluster: real `/admission` hub, `/admission/schools|courses|…`
   (reuses dashboard School/Course Finder logic, public chrome).
9. Tools cluster: real `/tools` hub + cgpa/gpa/timetable/calendar/countdown,
   `/support`, `/tools/school-fees`.
10. News + article + jobs/scholarships (kill pinimg hotlinks → local SVG set).
11. Dashboard + admin chrome unification (same tokens, keep all logic).
12. Cleanup: dead code (`uiPolish.ts`, `ServiceTrackOverride.tsx`,
    `navigation.ts`, 7 orphan CSS files), `?next=` on admin guard, bundle split,
    `package.json` rename `eduleb-site` → `edureach-hub`, refresh `ROUTES.md`.

## 6. Fixed this turn (no visual redesign, no component changes)
- `HubHomePage` / `ExamHubPage`: brand `<img>` now use existing local
  `/icons/*.svg` (were `/icons/brands/*.png` → served `index.html`, broken).
- `services.ts`: all 25 `icon` paths point at real local SVGs.
- `StudentDashboardV2` School Finder: field names match `institutions` table
  (`school_name`, `institution_type`, `state`, `website_url`) — `npm run lint`
  14 errors → 0; Portal link hidden honestly when no URL.
- WhatsApp: `ServiceTrackPage` + dashboard now use `2349130134969` (were fake
  `2348000000000`).
- Dashboard: `/dashboard/services?ref=…` now shows the matching receipt strip
  (or honest “not on this account” + public tracker link). Request cards and the
  apply-success link work as designed.
