import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { userFacingError } from '../lib/errors';
import {
  fetchInstitutionCacheStats,
  fetchInstitutionReviewDetail,
  fetchInstitutionReviewList,
  fetchInstitutionReviewQueue,
  reviewInstitutionEvidence,
  type InstitutionAdminDetail,
  type InstitutionCacheStats,
  type InstitutionCompletenessRow,
  type InstitutionEvidenceRow,
  type InstitutionReviewFilters,
  type InstitutionReviewQueue,
  type InstitutionReviewCheck,
  type InstitutionReviewRow,
} from '../src/lib/api';
import { AdminEmptyState } from '../src/components/admin/AdminKit';
import AdminFilterSearch from '../src/components/admin/AdminFilterSearch';

// The editor is a form-heavy module. Opening the queue should not pay for it;
// it loads when an institution is actually opened to edit.
const InstitutionReviewEditor = lazy(() => import('../src/components/admin/InstitutionReviewEditor'));

function ChecklistLine({ check }: { check: InstitutionReviewCheck }) {
  const glyph = check.state === 'ok' ? '✓' : check.state === 'review' ? '⚠ Review' : '⚠ Missing';
  return (
    <li className={`admin-check admin-check-${check.state}`} data-state={check.state}>
      <span aria-hidden="true">{glyph}</span>{' '}
      <strong>{check.label}</strong> <span className="muted">{check.detail}</span>
    </li>
  );
}

/**
 * Institution intelligence review centre.
 *
 * One system, three reads: the public page (verified AND published only), this
 * queue (everything, including drafts), and the editor behind each institution.
 * Nothing recorded here is ever thrown away because it is unverified — an
 * unverified fact is exactly what a reviewer needs to see.
 *
 * Every row in the evidence panel is a *claim* someone recorded with a source
 * URL, never a fact. The reviewer decides, per field, whether that source says
 * what the claim says. The four outcomes are deliberately blunt:
 *
 *   verified                    the source states it for the session shown
 *   disputed                    the source contradicts it, or two sources disagree
 *   outdated                    it was true for an earlier session, not this one
 *   unpublished_by_institution  the institution has taken it down
 *
 * There is no "probably" state and no default, because a published threshold or
 * eligibility rule that nobody checked is worse than an empty section. The source
 * link comes first for that reason: a reviewer who cannot open the source cannot
 * verify the claim. A row without a source URL therefore cannot be verified at
 * all, and the page says so instead of offering the button as if it were fine.
 */

// The four outcomes are words, not icons: a glyph next to "Disputed" invites a
// glance-decision, and this queue is the one place where a wrong click publishes
// a wrong threshold. It also keeps the page's chunk small (PERF-1 total-JS budget).
const DECISIONS: Array<{
  status: InstitutionEvidenceRow['verification_status'];
  label: string;
  hint: string;
}> = [
  { status: 'verified', label: 'Verified', hint: 'The source states this for the session shown.' },
  { status: 'disputed', label: 'Disputed', hint: 'The source contradicts it, or sources disagree.' },
  { status: 'outdated', label: 'Outdated', hint: 'True for an earlier session, not this one.' },
  { status: 'unpublished_by_institution', label: 'Withdrawn', hint: 'The institution has taken it down.' },
];

const COVERAGE: Array<[string, (row: InstitutionCompletenessRow) => string | number]> = [
  ['Offices', (row) => row.current_offices],
  ['Campuses', (row) => row.verified_campuses],
  ['Units', (row) => row.verified_units],
  ['Offerings', (row) => row.published_offerings + (row.offerings_in_review > 0 ? ` (${row.offerings_in_review} in review)` : '')],
  ['Benchmarks', (row) => row.published_benchmarks],
  ['Guides', (row) => row.published_guides],
  ['Facts to review', (row) => row.facts_awaiting_review],
];

function claimedText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'No value recorded';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function indicatorSummary(row: InstitutionReviewRow): string {
  if (!row.checks || row.checks.length === 0) return '';
  const missing = row.checks.filter((check) => check.state === 'missing').length;
  const review = row.checks.filter((check) => check.state === 'review').length;
  const ok = row.checks.filter((check) => check.state === 'ok').length;
  const parts = [`✓ ${ok} recorded`];
  if (review) parts.push(`⚠ ${review} to review`);
  if (missing) parts.push(`⚠ ${missing} missing`);
  return parts.join(' · ');
}

const EMPTY_FILTERS: InstitutionReviewFilters = {};

export default function AdminInstitutionIntelligencePage() {
  const [queue, setQueue] = useState<InstitutionReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, InstitutionEvidenceRow['verification_status']>>({});
  const [stateFilter, setStateFilter] = useState('');

  const [filters, setFilters] = useState<InstitutionReviewFilters>(EMPTY_FILTERS);
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [filtered, setFiltered] = useState<InstitutionReviewRow[] | null>(null);
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterError, setFilterError] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<InstitutionAdminDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const [cache, setCache] = useState<InstitutionCacheStats | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setError('');
      setQueue(await fetchInstitutionReviewQueue());
    } catch (e) {
      setQueue(null);
      setError(userFacingError(e, 'Unable to load the institution review queue.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filters run on the server so the browser is not handed the whole catalogue
  // to sift through. The debounce keeps typing from firing a request per key.
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const active = Object.values(filters).some((value) => typeof value === 'string' && value.trim());
      if (!active) {
        setFiltered(null);
        setFilterError('');
        return;
      }
      setFilterBusy(true);
      try {
        setFilterError('');
        const result = await fetchInstitutionReviewList(filters);
        setFiltered(result.institutions);
      } catch (e) {
        setFiltered(null);
        setFilterError(userFacingError(e, 'Unable to apply those filters.'));
      } finally {
        setFilterBusy(false);
      }
    }, filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const completeness: InstitutionCompletenessRow[] = queue?.completeness ?? [];
  const states = useMemo(
    () => Array.from(new Set(completeness.map((row) => row.state).filter((value): value is string => Boolean(value)))).sort(),
    [completeness],
  );
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of completeness) map.set(row.institution_id, row.school_name);
    for (const row of queue?.institutions ?? []) map.set(row.institution_id, row.school_name);
    return map;
  }, [completeness, queue]);

  const awaiting = queue?.awaitingReview ?? [];
  const rows = awaiting.filter((row) => {
    if (!stateFilter) return true;
    return completeness.find((item) => item.institution_id === row.institution_id)?.state === stateFilter;
  });
  const sorted = [...completeness].sort((a, b) => (b.facts_awaiting_review - a.facts_awaiting_review) || a.school_name.localeCompare(b.school_name));

  const catalogue = queue?.institutions ?? [];
  const options = queue?.filterOptions ?? { states: [], institutionTypes: [], sessions: [] };
  const summary = queue?.summary ?? null;
  const programmeTotal = catalogue.reduce((total, row) => total + row.programme_offerings, 0);
  const unitTotal = catalogue.reduce((total, row) => total + row.academic_units, 0);

  const listed = (filtered ?? catalogue).filter((row) => !institutionFilter || row.institution_id === institutionFilter);
  const filteredActive = Boolean(filtered) || Object.values(filters).some((value) => typeof value === 'string' && value.trim());

  async function openInstitution(institutionId: string) {
    setSelectedId(institutionId);
    setDetail(null);
    setDetailBusy(true);
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      setDetail(await fetchInstitutionReviewDetail(institutionId));
    } catch (e) {
      setError(userFacingError(e, 'Unable to open that institution for review.'));
      setSelectedId('');
    } finally {
      setDetailBusy(false);
    }
  }

  async function refreshDetail(institutionId: string) {
    try {
      setDetail(await fetchInstitutionReviewDetail(institutionId));
      void load();
    } catch (e) {
      setError(userFacingError(e, 'Saved, but the refreshed view could not be loaded. Refresh the page.'));
    }
  }

  async function decide(row: InstitutionEvidenceRow, status: InstitutionEvidenceRow['verification_status']) {
    const note = (notes[row.id] ?? '').trim();
    if (status === 'verified' && !row.source_url) {
      setError('This row has no source URL, so there is nothing to check it against. Mark it disputed and say what is missing.');
      return;
    }
    if (status !== 'verified' && !note) {
      setError('Explain the decision in the note first: a disputed, outdated or withdrawn fact needs a reason on record.');
      return;
    }
    setBusyId(row.id);
    setError('');
    try {
      const updated = await reviewInstitutionEvidence(row.id, status, note || null);
      const label = DECISIONS.find((entry) => entry.status === updated.verification_status)?.label ?? updated.verification_status;
      setQueue((current) => current
        ? { ...current, awaitingReview: current.awaitingReview.filter((item) => item.id !== row.id) }
        : current);
      setNotes((current) => ({ ...current, [row.id]: '' }));
      setMessage(`${row.field_key} on ${nameById.get(row.institution_id) ?? 'this institution'} recorded as ${label.toLowerCase()}. A field is only published once every sibling fact for that session carries a verified decision.`);
      void load();
      if (selectedId) void refreshDetail(selectedId);
    } catch (e) {
      setError(userFacingError(e, 'Unable to record that review.'));
    } finally {
      setBusyId('');
    }
  }

  async function showCache() {
    setCacheBusy(true);
    try {
      setCache(await fetchInstitutionCacheStats());
    } catch (e) {
      setError(userFacingError(e, 'Unable to read the cache counters.'));
    } finally {
      setCacheBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="admin-section-label">Institutions</span>
          <h1>Institution intelligence review</h1>
          <p className="muted">
            {detail
              ? 'Structured editing: one section, one programme or one unit at a time. Nothing unverified is discarded, and nothing unverified is public.'
              : 'Each row is an unverified claim with a source. Verify the source, not the wording: a threshold without a session and a working link is not publishable.'}
          </p>
        </div>
        <div className="admin-header-actions">
          {detail && (
            <button type="button" className="admin-btn secondary" onClick={() => { setSelectedId(''); setDetail(null); }}>
              Back to the queue
            </button>
          )}
          <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
      {message && <div className="admin-card" role="status" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

      {!detail && (
        <>
          <section className="admin-card" style={{ padding: 18, marginBottom: 18 }} aria-labelledby="review-counts-heading">
            <div className="admin-card-header">
              <h2 id="review-counts-heading">The staging batch</h2>
              <span className="admin-filter-count">{loading ? 'Loading…' : `checked ${queue?.checkedAt ? queue.checkedAt.slice(0, 16).replace('T', ' ') : '—'}`}</span>
            </div>
            <div className="admin-field-row" style={{ flexWrap: 'wrap', gap: 12 }}>
              {[
                ['Institutions', summary ? summary.institutionsInCatalogue : catalogue.length, 'in the catalogue'],
                ['Programmes', programmeTotal, `${summary?.programmeRecordsAwaitingVerification ?? 0} awaiting verification`],
                ['Academic units', summary ? summary.academicUnits : unitTotal, 'recorded'],
                ['Source records', summary ? summary.sourceRecords : 0, 'in the source library'],
                ['Published', summary ? summary.publishedInstitutions : 0, 'visible to students'],
              ].map(([label, value, detailText]) => (
                <div key={String(label)} className="admin-field" style={{ minWidth: 160 }}>
                  <span>{label}</span>
                  <strong style={{ fontSize: 24 }}>{value}</strong>
                  <small className="muted">{detailText}</small>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              Zeros are honest zeros. A zero here is a count of what has been recorded and reviewed — never evidence that an institution lacks something.
            </p>
          </section>

          <section className="admin-card" style={{ padding: 18, marginBottom: 18 }} aria-labelledby="institution-list-heading">
            <div className="admin-card-header">
              <h2 id="institution-list-heading">Institutions</h2>
              <span className="admin-filter-count">{filterBusy ? 'Filtering…' : `${listed.length} shown${filteredActive ? ` of ${catalogue.length}` : ` of ${catalogue.length}`}`}</span>
            </div>

            <div className="admin-filter-card" style={{ flexWrap: 'wrap', gap: 8 }}>
              <AdminFilterSearch
                value={filters.search ?? ''}
                onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
                label="Search institutions by name, acronym or state"
                placeholder="Search name, acronym or state"
                suggestionLabel="Institution intelligence suggestions"
                items={catalogue.map((row) => ({
                  id: row.institution_id,
                  title: row.school_name,
                  description: [row.acronym, row.state, row.institution_type, row.official_name].filter(Boolean).join(' · '),
                  category: row.institution_type || 'Institution',
                  keywords: [row.overview, row.official_website_url, row.verification_status, row.publication_status],
                }))}
              />
              <select
                className="admin-select"
                aria-label="Filter by institution"
                value={institutionFilter}
                onChange={(event) => setInstitutionFilter(event.target.value)}
              >
                <option value="">All institutions</option>
                {catalogue.map((row) => <option key={row.institution_id} value={row.institution_id}>{row.school_name}</option>)}
              </select>
              <select className="admin-select" aria-label="Filter by state" value={filters.state ?? ''} onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value }))}>
                <option value="">All states</option>
                {options.states.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              <select className="admin-select" aria-label="Filter by institution type" value={filters.type ?? ''} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                <option value="">All types</option>
                {options.institutionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="admin-select" aria-label="Filter by verification status" value={filters.verification ?? ''} onChange={(event) => setFilters((current) => ({ ...current, verification: event.target.value }))}>
                <option value="">Any verification</option>
                {['unresearched', 'discovered', 'in_review', 'verified', 'disputed', 'outdated', 'unpublished_by_institution'].map((status) => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select className="admin-select" aria-label="Filter by publication status" value={filters.publication ?? ''} onChange={(event) => setFilters((current) => ({ ...current, publication: event.target.value }))}>
                <option value="">Any publication</option>
                {['draft', 'in_review', 'published', 'archived'].map((status) => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select className="admin-select" aria-label="Filter by admission session" value={filters.session ?? ''} onChange={(event) => setFilters((current) => ({ ...current, session: event.target.value }))}>
                <option value="">Any session</option>
                {options.sessions.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
              <select className="admin-select" aria-label="Filter by missing information" value={filters.missing ?? ''} onChange={(event) => setFilters((current) => ({ ...current, missing: event.target.value }))}>
                <option value="">Any completeness</option>
                <option value="any">Has something missing or to review</option>
                <option value="programmes">Programmes missing or to review</option>
                <option value="units">Academic units missing or to review</option>
                <option value="admissionDates">Admission dates missing or to review</option>
                <option value="utmeRequirements">UTME requirements missing or to review</option>
                <option value="logo">Logo missing</option>
                <option value="campusImage">Campus image missing</option>
              </select>
              <select className="admin-select" aria-label="Filter by source availability" value={filters.source ?? ''} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}>
                <option value="">Any source state</option>
                <option value="verified">Evidence recorded</option>
                <option value="missing">Facts still awaiting review</option>
              </select>
              {filteredActive && (
                <button type="button" className="admin-btn secondary" onClick={() => { setFilters(EMPTY_FILTERS); setInstitutionFilter(''); }}>
                  Clear filters
                </button>
              )}
            </div>

            {filterError && <div role="alert" className="danger-text" style={{ marginTop: 8 }}>{filterError}</div>}

            {loading ? (
              <p className="muted">Loading the catalogue…</p>
            ) : listed.length === 0 ? (
              <AdminEmptyState
                title={filteredActive ? 'No institution matches those filters' : 'No institutions returned'}
                hint={filteredActive
                  ? 'A filter that matches nothing is a real answer: nothing in this batch has that state. Clear a filter to widen the view.'
                  : 'An empty result means the query failed, not that the catalogue is empty.'}
              />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="admin-section-label">Every institution, verified or not. Opening one shows every field recorded for it.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Institution</th>
                      <th scope="col">State</th>
                      <th scope="col">Verification</th>
                      <th scope="col">Publication</th>
                      <th scope="col">Programmes</th>
                      <th scope="col">Units</th>
                      <th scope="col">Sources</th>
                      <th scope="col">Indicators</th>
                      <th scope="col"><span className="muted">Review</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listed.map((row) => (
                      <tr key={row.institution_id}>
                        <th scope="row">
                          <span>{row.school_name}</span>
                          {row.acronym && <span className="muted"> · {row.acronym}</span>}
                        </th>
                        <td>{row.state ?? '—'}</td>
                        <td>{row.verification_status.replace(/_/g, ' ')}</td>
                        <td>{row.publication_status ?? 'not started'}</td>
                        <td>{row.published_offerings} / {row.programme_offerings}</td>
                        <td>{row.academic_units - row.academic_units_unverified} / {row.academic_units}</td>
                        <td>{row.source_records}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 180 }}>{indicatorSummary(row) || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn secondary"
                            onClick={() => void openInstitution(row.institution_id)}
                            disabled={detailBusy}
                            aria-busy={detailBusy && selectedId === row.institution_id}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {detailBusy && !detail && <div className="admin-card" style={{ padding: 18 }}><p className="muted" role="status">Loading the institution record…</p></div>}

      {detail && (
        <Suspense fallback={<div className="admin-card" style={{ padding: 18 }}><p className="muted" role="status">Loading the editor…</p></div>}>
          <InstitutionReviewEditor
            detail={detail}
            onChanged={(saved) => {
              if (saved) setMessage(saved);
              else { setSelectedId(''); setDetail(null); }
              if (saved) void refreshDetail(detail.institution.id);
            }}
          />
        </Suspense>
      )}

      {!detail && (
        <>
          <section className="admin-card" style={{ padding: 18, marginBottom: 18 }}>
            <div className="admin-card-header">
              <h2 id="awaiting-review-heading">Awaiting review</h2>
              <span className="admin-filter-count">
                {loading ? 'Loading…' : `${rows.length} fact${rows.length === 1 ? '' : 's'}${stateFilter ? ` in ${stateFilter}` : ''}`}
              </span>
            </div>

            <div className="admin-filter-card">
              <select className="admin-select" aria-label="Filter facts by institution state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="">All states</option>
                {states.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              <span className="admin-filter-count">
                {queue ? `${queue.completeness.length} institution${queue.completeness.length === 1 ? '' : 's'} in the catalogue` : ''}
              </span>
            </div>

            {!loading && rows.length === 0 && (
              <AdminEmptyState
                title="Nothing awaiting review"
                hint="Import a research batch, then come back. An empty queue means every recorded fact has a decision — not that the institution is complete."
              />
            )}

            {rows.length > 0 && (
              <div className="admin-stack">
                {rows.map((row) => {
                  const choice = DECISIONS.find((entry) => entry.status === (choices[row.id] ?? 'verified'))!;
                  const cannotVerify = choice.status === 'verified' && !row.source_url;
                  return (
                    <article key={row.id} className="admin-card" style={{ padding: 16 }}>
                      <div className="admin-card-header">
                        <div>
                          <h2 style={{ margin: 0 }}>{nameById.get(row.institution_id) ?? row.institution_id}</h2>
                          <p className="muted" style={{ margin: '4px 0' }}>
                            {row.entity_type} · {row.field_key}
                            {row.applicable_session ? ` · ${row.applicable_session}` : ' · no session recorded'}
                          </p>
                        </div>
                        <span className="admin-pill">{row.verification_status.replace(/_/g, ' ')}</span>
                      </div>

                      <div className="admin-field-row">
                        <div className="admin-field">
                          <span>Claimed value</span>
                          <strong>{claimedText(row.claimed_value)}</strong>
                        </div>
                        <div className="admin-field">
                          <span>Source</span>
                          {row.source_url
                            ? <a href={row.source_url} target="_blank" rel="noreferrer noopener">{row.source_url}</a>
                            : <span className="danger-text">No source URL recorded — this cannot be verified.</span>}
                        </div>
                      </div>

                      <div className="admin-field-row">
                        <label className="admin-field">
                          <span>Decision</span>
                          <select
                            className="admin-select"
                            value={choice.status}
                            onChange={(event) => {
                              const status = event.target.value as InstitutionEvidenceRow['verification_status'];
                              setChoices((current) => ({ ...current, [row.id]: status }));
                            }}
                          >
                            {DECISIONS.map((decision) => (
                              <option key={decision.status} value={decision.status}>{decision.label} — {decision.hint}</option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-field" style={{ flex: 2 }}>
                          <span>Review note (required unless verified)</span>
                          <input
                            className="admin-input"
                            type="text"
                            value={notes[row.id] ?? ''}
                            onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                            placeholder="What did the source actually say?"
                            maxLength={400}
                          />
                        </label>
                      </div>

                      <div className="admin-news-editor-actions">
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => void decide(row, choice.status)}
                          disabled={busyId === row.id || cannotVerify}
                          aria-busy={busyId === row.id}
                          title={cannotVerify ? 'Add a source URL before verifying.' : choice.hint}
                        >
                          Record {choice.label.toLowerCase()}
                        </button>
                        <button
                          type="button"
                          className="admin-btn secondary"
                          onClick={() => void openInstitution(row.institution_id)}
                          disabled={detailBusy}
                        >
                          Open institution
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {queue && queue.institutions.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="admin-section-label">Section completeness for the open institution</summary>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 4 }}>
                  {queue.institutions
                    .filter((row) => row.checks && row.checks.some((check) => check.state !== 'ok'))
                    .slice(0, 3)
                    .flatMap((row) => (row.checks ?? []).filter((check) => check.state !== 'ok').map((check) => (
                      <ChecklistLine key={`${row.institution_id}-${check.key}`} check={{ ...check, label: `${row.school_name} · ${check.label}` }} />
                    )))}
                </ul>
              </details>
            )}
          </section>

          <section className="admin-card" style={{ padding: 18 }}>
            <div className="admin-card-header">
              <h2 id="completeness-heading">Coverage per institution</h2>
              <span className="admin-filter-count">{completeness.length} institutions</span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Zeros are honest zeros: no published profile, office, campus, unit, offering, benchmark or guide. This is the gap list, not a score, and it never fills a gap with a guess.
            </p>

            {loading ? (
              <p className="muted">Loading coverage…</p>
            ) : completeness.length === 0 ? (
              <AdminEmptyState title="No institutions returned" hint="The completeness view reads every institution row. An empty result means the query failed, not that the catalogue is empty." />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="admin-section-label">Published institution intelligence per institution</caption>
                  <thead>
                    <tr>
                      <th scope="col">Institution</th>
                      <th scope="col">State</th>
                      <th scope="col">Profile</th>
                      {COVERAGE.map(([label]) => <th key={label} scope="col">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.institution_id}>
                        <th scope="row">{row.school_name}</th>
                        <td>{row.state ?? '—'}</td>
                        <td>{row.profile_status ?? 'not researched'}</td>
                        {COVERAGE.map(([label, value]) => <td key={label}>{value(row)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button type="button" className="admin-btn secondary" onClick={() => void showCache()} disabled={cacheBusy} aria-busy={cacheBusy}>
                {cacheBusy ? 'Reading…' : 'Show cache counters'}
              </button>
              {cache && (
                <p className="muted" role="status" style={{ marginTop: 8 }}>
                  {cache.cache.hits} hits, {cache.cache.staleHits} stale hits, {cache.cache.misses} misses, {cache.cache.coalesced} requests coalesced into {cache.cache.loads} loads, {cache.cache.invalidations} invalidations, {cache.cache.size} entries. Policy: <code>{cache.policy}</code>. {cache.note}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
