import { useEffect, useMemo, useState } from 'react';
import { userFacingError } from '../lib/errors';
import {
  fetchInstitutionReviewQueue,
  reviewInstitutionEvidence,
  type InstitutionCompletenessRow,
  type InstitutionEvidenceRow,
  type InstitutionReviewQueue,
} from '../src/lib/api';
import { AdminEmptyState } from '../src/components/admin/AdminKit';

/**
 * Institution intelligence review queue (BASE-3).
 *
 * Every row here is a *claim* someone recorded with a source URL — never a fact.
 * The reviewer decides, per field, whether that source says what the claim says.
 * The four outcomes are deliberately blunt:
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

export default function AdminInstitutionIntelligencePage() {
  const [queue, setQueue] = useState<InstitutionReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, InstitutionEvidenceRow['verification_status']>>({});
  const [stateFilter, setStateFilter] = useState('');

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

  const completeness: InstitutionCompletenessRow[] = queue?.completeness ?? [];
  const states = useMemo(
    () => Array.from(new Set(completeness.map((row) => row.state).filter((value): value is string => Boolean(value)))).sort(),
    [completeness],
  );
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of completeness) map.set(row.institution_id, row.school_name);
    return map;
  }, [completeness]);

  const awaiting = queue?.awaitingReview ?? [];
  const rows = awaiting.filter((row) => {
    if (!stateFilter) return true;
    return completeness.find((item) => item.institution_id === row.institution_id)?.state === stateFilter;
  });
  const sorted = [...completeness].sort((a, b) => (b.facts_awaiting_review - a.facts_awaiting_review) || a.school_name.localeCompare(b.school_name));

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
    } catch (e) {
      setError(userFacingError(e, 'Unable to record that review.'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="admin-section-label">Institutions</span>
          <h1>Institution intelligence review</h1>
          <p className="muted">
            Each row is an unverified claim with a source. Verify the source, not the wording: a threshold without a session and a working link is not publishable.
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
      {message && <div className="admin-card" role="status" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

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
                  </div>
                </article>
              );
            })}
          </div>
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
      </section>
    </div>
  );
}
