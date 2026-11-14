import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, ShieldCheck, UserPlus, UserMinus, Clock, Search, History, RefreshCw } from 'lucide-react';
import { userFacingError } from '../lib/errors';
import {
  assignAdminBankCandidate,
  classifyAdminBank,
  fetchAdminBankCandidates,
  fetchAdminBankHistory,
  fetchAdminBanks,
  revokeAdminBankCandidate,
  searchAdminBankCandidates,
  setAdminBankRelease,
  type AdminBank,
  type AdminBankCandidate,
  type AdminBankCandidateLookup,
  type AdminBankHistoryEntry,
  type AdminBankSummary,
} from '../src/lib/api';
import { AdminEmptyState, RowSkeleton, TimeAgo } from '../src/components/admin/AdminKit';
import '../src/bank-security.css';

/**
 * Bank security console.
 *
 * Classification, assignment and release are decided by the server and enforced
 * by the database; this page only presents the state and sends the request. An
 * unclassified bank is not public: it is unavailable to students and to guests
 * until an administrator classifies it here.
 */

const emptySummary: AdminBankSummary = { total: 0, unclassified: 0, public: 0, restricted: 0, embargoed: 0 };

function visibilityLabel(bank: AdminBank): string {
  if (bank.visibility === 'public') return 'Public';
  if (bank.visibility === 'restricted') return 'Restricted';
  return 'Unclassified';
}

function visibilityClass(bank: AdminBank): string {
  if (bank.visibility === 'public') return 'bs-pill bs-pill-public';
  if (bank.visibility === 'restricted') return 'bs-pill bs-pill-restricted';
  return 'bs-pill bs-pill-unclassified';
}

function releaseState(bank: AdminBank): string {
  if (!bank.visibility) return 'Not applicable';
  if (bank.visibility === 'public') return 'Always available';
  if (!bank.correction_release_at) return 'No release time set';
  return bank.released ? 'Released' : 'Embargoed';
}

function localInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AdminBankSecurityPage() {
  const [banks, setBanks] = useState<AdminBank[]>([]);
  const [summary, setSummary] = useState<AdminBankSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<'all' | 'unclassified' | 'restricted' | 'public'>('all');

  const [classification, setClassification] = useState<'public' | 'restricted'>('restricted');
  const [releaseAt, setReleaseAt] = useState('');
  const [releaseDraft, setReleaseDraft] = useState('');

  const [candidates, setCandidates] = useState<AdminBankCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [history, setHistory] = useState<AdminBankHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AdminBankCandidateLookup[]>([]);
  const [searching, setSearching] = useState(false);

  const selected = useMemo(() => banks.find((bank) => bank.exam_id === selectedId) || null, [banks, selectedId]);

  const loadBanks = useCallback(async () => {
    setError('');
    try {
      const body = await fetchAdminBanks();
      setBanks(body.items || []);
      setSummary(body.summary || emptySummary);
      setSelectedId((current) => current || body.items?.[0]?.exam_id || '');
    } catch (e) {
      setBanks([]);
      setSummary(emptySummary);
      setError(userFacingError(e, 'Unable to load question banks.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBanks(); }, [loadBanks]);

  const loadCandidates = useCallback(async (examId: string) => {
    if (!examId) { setCandidates([]); return; }
    setCandidatesLoading(true);
    try {
      setCandidates(await fetchAdminBankCandidates(examId));
    } catch (e) {
      setCandidates([]);
      setError(userFacingError(e, 'Unable to load candidates for this bank.'));
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (examId: string) => {
    if (!examId) { setHistory([]); return; }
    setHistoryLoading(true);
    try {
      setHistory(await fetchAdminBankHistory(examId));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) { setCandidates([]); setHistory([]); return; }
    setClassification(selected.visibility === 'public' ? 'public' : 'restricted');
    setReleaseDraft(localInputValue(selected.correction_release_at));
    void loadCandidates(selected.exam_id);
    void loadHistory(selected.exam_id);
  }, [selected?.exam_id, selected, loadCandidates, loadHistory]);

  const visibleBanks = useMemo(() => {
    if (filter === 'all') return banks;
    if (filter === 'unclassified') return banks.filter((bank) => !bank.visibility);
    return banks.filter((bank) => bank.visibility === filter);
  }, [banks, filter]);

  async function run(label: string, action: () => Promise<void>, success: string) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await loadBanks();
      if (selected) {
        await Promise.all([loadCandidates(selected.exam_id), loadHistory(selected.exam_id)]);
      }
    } catch (e) {
      setError(userFacingError(e, 'That change was refused.'));
    } finally {
      setBusy('');
    }
  }

  async function submitClassification(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (classification === 'restricted' && !releaseAt) {
      setError('A restricted bank needs a future correction release time.');
      return;
    }
    const payload = classification === 'public' ? null : new Date(releaseAt).toISOString();
    await run('classify', () => classifyAdminBank(selected.exam_id, classification, payload),
      `“${selected.title}” is now ${classification === 'public' ? 'a public practice bank' : 'a restricted bank'}.`);
  }

  async function submitRelease(event: FormEvent) {
    event.preventDefault();
    if (!selected || !releaseDraft) return;
    await run('release', () => setAdminBankRelease(selected.exam_id, new Date(releaseDraft).toISOString()),
      'Correction release time updated.');
  }

  async function doAssign(candidateId: string, name: string) {
    if (!selected) return;
    await run('assign', () => assignAdminBankCandidate(selected.exam_id, candidateId), `${name || 'Candidate'} can now access this examination.`);
    setSearch('');
    setSearchResults([]);
  }

  async function doRevoke(candidateId: string, name: string) {
    if (!selected) return;
    await run('revoke', () => revokeAdminBankCandidate(selected.exam_id, candidateId), `${name || 'Candidate'} no longer has access.`);
  }

  async function doSearch(event: FormEvent) {
    event.preventDefault();
    if (search.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      setSearchResults(await searchAdminBankCandidates(search));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const isRestricted = selected?.visibility === 'restricted';

  return (
    <div className="admin-page bs-page">
      <header className="admin-page-header">
        <div>
          <h1>Bank security</h1>
          <p>Classify question banks, assign candidates to confidential examinations and control when corrections are released. Unclassified banks stay unavailable to everyone.</p>
        </div>
        <button type="button" className="bs-btn bs-btn-ghost" onClick={() => { setLoading(true); void loadBanks(); }} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" /> Reload
        </button>
      </header>

      {error && <div className="bs-banner bs-banner-error" role="alert">{error}</div>}
      {message && <div className="bs-banner bs-banner-ok" role="status">{message}</div>}

      <section className="bs-stats" aria-label="Bank summary">
        {[
          { label: 'Question banks', value: summary.total, tone: 'neutral' },
          { label: 'Unclassified', value: summary.unclassified, tone: 'warn' },
          { label: 'Public', value: summary.public, tone: 'ok' },
          { label: 'Restricted', value: summary.restricted, tone: 'danger' },
          { label: 'Still embargoed', value: summary.embargoed, tone: 'danger' },
        ].map((stat) => (
          <div key={stat.label} className={`bs-stat bs-stat-${stat.tone}`}>
            <span>{stat.label}</span>
            <strong>{loading ? '—' : stat.value}</strong>
          </div>
        ))}
      </section>

      <div className="bs-layout">
        <section className="admin-card bs-card" aria-labelledby="bs-banks-heading">
          <div className="admin-card-header">
            <h2 id="bs-banks-heading">Question banks</h2>
            <span>{visibleBanks.length} shown</span>
          </div>
          <div className="bs-filters" role="group" aria-label="Filter banks">
            {(['all', 'unclassified', 'restricted', 'public'] as const).map((value) => (
              <button key={value} type="button" className={`bs-chip ${filter === value ? 'is-active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {value === 'all' ? 'All banks' : value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          {loading ? (
            <RowSkeleton rows={6} />
          ) : visibleBanks.length === 0 ? (
            <AdminEmptyState title="No banks match this filter" hint="Banks appear here as soon as they are created in the CBT manager. Creating a bank does not classify it." />
          ) : (
            <ul className="bs-bank-list">
              {visibleBanks.map((bank) => (
                <li key={bank.exam_id}>
                  <button
                    type="button"
                    className={`bs-bank ${selectedId === bank.exam_id ? 'is-selected' : ''}`}
                    aria-current={selectedId === bank.exam_id ? 'true' : undefined}
                    onClick={() => setSelectedId(bank.exam_id)}
                  >
                    <span className="bs-bank-title">{bank.title}</span>
                    <span className="bs-bank-meta">{bank.exam_body} · {bank.subject} · {bank.question_count} question{bank.question_count === 1 ? '' : 's'}</span>
                    <span className="bs-bank-tags">
                      <span className={visibilityClass(bank)}>{visibilityLabel(bank)}</span>
                      {!bank.is_active && <span className="bs-pill bs-pill-neutral">Inactive</span>}
                      {bank.visibility === 'restricted' && (
                        <span className={`bs-pill ${bank.released ? 'bs-pill-public' : 'bs-pill-warn'}`}>{bank.released ? 'Corrections released' : 'Embargoed'}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="bs-detail">
          {!selected ? (
            <section className="admin-card bs-card">
              <AdminEmptyState title="Select a bank" hint="Choose a bank on the left to review its classification, candidates and audit history." />
            </section>
          ) : (
            <>
              <section className="admin-card bs-card" aria-labelledby="bs-review-heading">
                <div className="admin-card-header">
                  <h2 id="bs-review-heading">Review before classifying</h2>
                  <span className={visibilityClass(selected)}>{visibilityLabel(selected)}</span>
                </div>
                <dl className="bs-detail-grid">
                  <div><dt>Bank</dt><dd>{selected.title}</dd></div>
                  <div><dt>Examination</dt><dd>{selected.exam_body} · {selected.subject}</dd></div>
                  <div><dt>Status</dt><dd>{selected.is_active ? 'Active' : 'Inactive'}</dd></div>
                  <div><dt>Questions</dt><dd>{selected.question_count} total · {selected.approved_question_count} approved</dd></div>
                  <div><dt>Attempts</dt><dd>{selected.attempt_count}</dd></div>
                  <div><dt>Classified</dt><dd>{selected.classified_at ? <TimeAgo value={selected.classified_at} /> : 'Never'}</dd></div>
                </dl>
                {!selected.visibility && (
                  <p className="bs-callout">
                    <Lock size={15} aria-hidden="true" /> This bank is unclassified. Students and guests cannot open it, and questions cannot be published into it until you classify it.
                  </p>
                )}
                {selected.visibility ? (
                  <p className="bs-note">Classification is permanent in this policy. Corrections and questions cannot be made secret again after a bank is public, so create a new bank instead of reclassifying an existing one.</p>
                ) : (
                  <form className="bs-form" onSubmit={submitClassification}>
                    <fieldset className="bs-fieldset">
                      <legend>Decision</legend>
                      <label className="bs-radio">
                        <input type="radio" name="visibility" value="restricted" checked={classification === 'restricted'} onChange={() => setClassification('restricted')} />
                        <span><b>Restricted</b> — confidential examination. Only individually assigned candidates can open it, and corrections stay embargoed.</span>
                      </label>
                      <label className="bs-radio">
                        <input type="radio" name="visibility" value="public" checked={classification === 'public'} onChange={() => setClassification('public')} />
                        <span><b>Public</b> — open practice. Guests and students can practise and see corrections as they do today.</span>
                      </label>
                    </fieldset>
                    {classification === 'restricted' && (
                      <label className="bs-field">
                        <span>Correction release time (server time)</span>
                        <input type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} required />
                        <small>Scores, correctness and answer keys stay hidden until this moment. You can extend it later, but not undo a release.</small>
                      </label>
                    )}
                    <button type="submit" className="bs-btn" disabled={busy === 'classify'}>
                      <ShieldCheck size={15} aria-hidden="true" /> {busy === 'classify' ? 'Recording…' : 'Record classification'}
                    </button>
                  </form>
                )}
              </section>

              {isRestricted && (
                <section className="admin-card bs-card" aria-labelledby="bs-release-heading">
                  <div className="admin-card-header">
                    <h2 id="bs-release-heading"><Clock size={16} aria-hidden="true" /> Correction release</h2>
                    <span>{releaseState(selected)}</span>
                  </div>
                  <dl className="bs-detail-grid">
                    <div><dt>Configured release</dt><dd>{selected.correction_release_at ? new Date(selected.correction_release_at).toLocaleString() : 'Not set'}</dd></div>
                    <div><dt>Current status</dt><dd>{selected.released ? 'Released — assigned candidates can see corrections' : 'Embargoed — no score, correctness or answer key is returned'}</dd></div>
                    <div><dt>Assigned candidates</dt><dd>{selected.assigned_count}</dd></div>
                    <div><dt>Revoked candidates</dt><dd>{selected.revoked_count}</dd></div>
                  </dl>
                  {selected.released ? (
                    <p className="bs-note">Corrections are released. The release time cannot be moved earlier or undone.</p>
                  ) : (
                    <form className="bs-form bs-form-inline" onSubmit={submitRelease}>
                      <label className="bs-field">
                        <span>New release time (server time)</span>
                        <input type="datetime-local" value={releaseDraft} onChange={(event) => setReleaseDraft(event.target.value)} required />
                        <small>Only later times are accepted. The change is serialized against in-flight submissions.</small>
                      </label>
                      <button type="submit" className="bs-btn bs-btn-ghost" disabled={busy === 'release' || !releaseDraft}>
                        {busy === 'release' ? 'Saving…' : 'Update release time'}
                      </button>
                    </form>
                  )}
                </section>
              )}

              {isRestricted && (
                <section className="admin-card bs-card" aria-labelledby="bs-candidates-heading">
                  <div className="admin-card-header">
                    <h2 id="bs-candidates-heading"><UserPlus size={16} aria-hidden="true" /> Candidate access</h2>
                    <span>{selected.assigned_count} active · {selected.revoked_count} revoked</span>
                  </div>
                  <form className="bs-form bs-form-inline" onSubmit={doSearch}>
                    <label className="bs-field bs-grow">
                      <span>Find a student account</span>
                      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, matric number or school" minLength={2} />
                    </label>
                    <button type="submit" className="bs-btn bs-btn-ghost" disabled={searching || search.trim().length < 2}>
                      <Search size={15} aria-hidden="true" /> {searching ? 'Searching…' : 'Search'}
                    </button>
                  </form>
                  {searchResults.length > 0 && (
                    <ul className="bs-search-results">
                      {searchResults.map((candidate) => (
                        <li key={candidate.id}>
                          <span><b>{candidate.full_name || 'Unnamed account'}</b><small>{[candidate.matric_number, candidate.school].filter(Boolean).join(' · ') || 'No matric number or school'}</small></span>
                          <button type="button" className="bs-btn bs-btn-small" disabled={busy === 'assign'} onClick={() => void doAssign(candidate.id, candidate.full_name)}>Assign</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className="bs-subheading">Assigned and previously assigned</h3>
                  {candidatesLoading ? (
                    <RowSkeleton rows={3} />
                  ) : candidates.length === 0 ? (
                    <AdminEmptyState title="No candidate has been assigned" hint="Nobody can open this bank until at least one candidate is assigned here." />
                  ) : (
                    <div className="admin-table-wrap admin-table-wrap--stack">
                      <table className="admin-table bs-table admin-table--stack">
                        <caption className="bs-visually-hidden">Candidate access for this restricted bank</caption>
                        <thead>
                          <tr><th scope="col">Candidate</th><th scope="col">Status</th><th scope="col">Assigned</th><th scope="col">Revoked</th><th scope="col" className="right">Action</th></tr>
                        </thead>
                        <tbody>
                          {candidates.map((candidate) => (
                            <tr key={candidate.user_id}>
                              <td data-label="Candidate">{candidate.full_name || 'Unnamed account'}</td>
                              <td data-label="Status"><span className={`bs-pill ${candidate.status === 'active' ? 'bs-pill-public' : 'bs-pill-neutral'}`}>{candidate.status === 'active' ? 'Active' : 'Revoked'}</span></td>
                              <td data-label="Assigned"><TimeAgo value={candidate.assigned_at} /></td>
                              <td data-label="Revoked">{candidate.revoked_at ? <TimeAgo value={candidate.revoked_at} /> : '—'}</td>
                              <td className="right" data-label="Action">
                                {candidate.status === 'active' ? (
                                  <button type="button" className="bs-btn bs-btn-small bs-btn-danger" disabled={busy === 'revoke'} onClick={() => void doRevoke(candidate.user_id, candidate.full_name || '')}>
                                    <UserMinus size={13} aria-hidden="true" /> Revoke
                                  </button>
                                ) : (
                                  <button type="button" className="bs-btn bs-btn-small" disabled={busy === 'assign'} onClick={() => void doAssign(candidate.user_id, candidate.full_name || '')}>
                                    <UserPlus size={13} aria-hidden="true" /> Reassign
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              <section className="admin-card bs-card" aria-labelledby="bs-history-heading">
                <div className="admin-card-header">
                  <h2 id="bs-history-heading"><History size={16} aria-hidden="true" /> Audit history</h2>
                  <span>Policy changes only</span>
                </div>
                {historyLoading ? (
                  <RowSkeleton rows={3} />
                ) : history.length === 0 ? (
                  <AdminEmptyState title="No policy changes recorded" hint="Classification, assignment and release changes appear here with the administrator and timestamp." />
                ) : (
                  <ol className="bs-timeline">
                    {history.map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.action.replace(/^bank_/, '').replace(/_/g, ' ')}</strong>
                        <span><TimeAgo value={entry.created_at} />{entry.metadata && typeof entry.metadata === 'object' && 'visibility' in entry.metadata ? ` · ${String(entry.metadata.visibility)}` : ''}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="bs-note">Audit entries record policy changes only — never question text, answer keys or student answers.</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
