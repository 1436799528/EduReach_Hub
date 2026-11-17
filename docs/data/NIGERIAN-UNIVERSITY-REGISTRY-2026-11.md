# Nigerian university registry — retrieved 2026-11-17

Every university the National Universities Commission lists, transcribed from the
Commission's own tables, cross-checked against our inventory, and turned into an
importable batch. **Nothing here is published**: the batch lands in review, and
the publication gate keeps it there until somebody confirms each fact against the
institution's own page.

## 1. What was retrieved

| list | universities | source |
| --- | --- | --- |
| Federal | **77** | `nuc.edu.ng/nigerian-univerisities/federal-univeristies/` |
| State | **69** | `nuc.edu.ng/nigerian-univerisities/state-univerity/` |
| Private | **182** | `nuc.edu.ng/nigerian-univerisities/private-univeristies/` |
| **Total** | **328** | matches the Commission's own registry total |

Each row carries the name as published, the vice chancellor as listed, the
website address the Commission gives, and the year established.

**How the tables were read.** The public pages paginate in the browser at 20 rows
and the pagination is client-side, so only the first 20 rows of each list are
reachable by scrolling or printing. The same site serves each page's full content
through its WordPress REST endpoint —
`https://www.nuc.edu.ng/wp-json/wp/v2/pages?slug=federal-univeristies&_fields=id,slug,content`
(and `state-univerisity`, `private-univeristies`) — which returns the complete
table as HTML. That is what was transcribed, in full, into three tab-separated
files under `data/institutions/raw/`. The transcription is committed so the
snapshot can be audited line by line against the source, and
`tests/institution-registry.test.ts` fails if the snapshot and the raw tables
disagree.

## 2. What the Commission publishes, and what it does not

| field | published for | notes |
| --- | --- | --- |
| Name | 328 of 328 | spelling as published, including the Commission's own typos (`Fountain Unveristy`, `Gombe State Univeristy`, `Medine`) |
| Year established | 328 of 328 | 1948 (Ibadan) to 2026 |
| Official website | **190 of 328** | 138 rows leave the cell empty |
| Vice chancellor | **263 of 328** | 65 rows leave the cell empty, mostly the newest institutions |
| Admissions portal | **0 of 328** | not a Commission field — it has to come from each institution |
| Student portal | **0 of 328** | same |
| Address, logo, campus, programmes, cut-offs | **0 of 328** | not in this registry |

That is the honest boundary of this source. It answers "who is recognised, who
owns them, since when, and which site is theirs". It does not answer "what do
they require", and no attempt was made to derive one from the other.

## 3. Findings worth acting on

1. **The inventory holds the institution twice.** `University of Calabar`
   (`1e7e9cdd…`, with website and admission portal) and `University of Calabar,
   Calabar` (`255e4ba4…`, empty) are the same university. This is the entire
   329-vs-328 discrepancy the inventory file already flagged
   (`reconciliation.discrepancy: 1`). It needs a reviewed merge — one of the two
   rows carries real portal research, so neither can simply be deleted.
2. **One inventory row is not on the Commission's list.** `African School of
   Economics, Abuja` (`e3054006…`) is in our directory with a website and a
   student portal, but no federal, state or private list carries it. Either it is
   recognised under another name or it is not a university; either way the row
   needs research before it is shown as one.
3. **One registry row is missing from our inventory.** `African University of
   Economics, FCT, Abuja` — private, established 2024, no website published by
   the Commission. The importer cannot place it, so it is reported and skipped
   rather than guessed at.
4. **Twelve published domains do not spell the current name.** Most are
   former-name domains, which is normal and legal: `North Eastern University,
   Gombe` → `pru.edu.ng` (Pen Resource University), `Glorious Vision University`
   → `sau.edu.ng` (Samuel Adegboyega University), `Ojaja University` →
   `crownhilluniversity.edu.ng`, `David Nweze Umahi Federal University of
   Medical Sciences` → `kdums.edu.ng` (King David University). They are recorded
   as published and **flagged**, because a domain is evidence of a website, not
   of which institution owns it. Each needs one click of confirmation before it
   is used for admissions traffic.
5. **One address is not https.** `African University of Science and Technology,
   Abuja` publishes `http://aust.edu.ng/`. It is stored exactly as published and
   flagged; the public pages will not link a mixed-content address, so this row
   stays without a working website until an https address is confirmed.
6. **The Commission's spelling is not our spelling.** 58 institutions appear
   under a different name in our directory — `Umar Musa Yar' Adua University
   Katsina` vs `Umaru Musa Yar'Adua University, Katsina`, `Ekiti State
   University` vs `Ekiti State University, Ado-Ekiti`, `Bauchi State University,
   Gadau` vs `Sa'adu Zungur University, Gadau` (a rename). All 58 are in an
   explicit, reviewable table (`NAME_ALIASES`) rather than being resolved by a
   fuzzy matcher; anything not in that table is *reported*, never matched.

## 4. Results

```
registry:      328 (77 federal, 69 state, 182 private)
matched:       327 of 329 inventory rows   (58 through the reviewed alias table)
unmatched:     2 inventory rows, 1 registry row   (all named in §3)
websites:      190 published (189 https, 12 flagged as former-name domains)
leadership:    263 vice chancellors as listed by the Commission
```

Artifacts, all in `data/institutions/`:

| file | what it is |
| --- | --- |
| `raw/nuc-federal.tsv`, `raw/nuc-state.tsv`, `raw/nuc-private.tsv` | the transcription, one row per university, five tab-separated cells |
| `nuc-registry-2026-11-17.json` | the snapshot: every row with its flags, the authorities and the retrieval date |
| `registry-coverage.json` | the match report: matched (with how), registry-only, inventory-only, ambiguous |
| `research-batch-002-registry.json` | the import batch, in the format `npm run institutions:import` already reads |
| `research-batch-002-registry.plan.json` | the importer's own transform applied offline: 327 institutions, 190 profile rows, 262 leadership rows, **0 validation issues** |

Regenerate:

```bash
npm run institutions:registry        # raw TSVs -> snapshot + coverage
npm run institutions:registry:batch  # snapshot -> batch + import plan
```

## 5. Why this is still not published

Every row is written with `verificationStatus: discovered_from_registry`, and the
importer lands it in review. The publication gate runs before the write: a
profile whose verification status is `discovered` cannot be published, so the
public pages cannot show a fact that has only been read off a regulator's table.

That is the right default. The Commission's table is a *registry*, not a
verification: it lags renames, it publishes domains it has not checked, and its
vice-chancellor column is a snapshot rather than a tenure. What it does give us
is a complete, citable starting point — for all 328 universities, in one place,
with the source for every cell.

## 6. What is still missing, per institution

1. **Admissions and student portals** for all 328 — the Commission does not
   publish them. This is the highest-value gap for a student: it is the link they
   actually need.
2. **Confirmation of the 190 published websites** against the institution's own
   page (one request each).
3. **Programmes, entry requirements, subject combinations and cut-offs** — none
   of it registry data. JAMB IBASS is the only source for combinations and it is
   form-driven, so it stays a per-institution research job.
4. **Fees, hostel, accreditation dates, academic calendar.**
5. **The three reconciliation decisions in §3** (merge the Calabar duplicate,
   resolve the African School of Economics row, add the 2024 FCT university).
