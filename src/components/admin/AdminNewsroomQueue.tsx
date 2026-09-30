import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import {
  approveNewsroomCandidate,
  fetchNewsroomCandidates,
  rejectNewsroomCandidate,
  runNewsroomIngest,
  type NewsroomCandidate,
} from '../../lib/api';
import { userFacingError } from '../../../lib/errors';
import { newsCategoryLabel } from '../../data/newsCategories';

/**
 * Ingestion review queue.
 *
 * The daily pipeline publishes Tier 1 official stories itself and queues
 * everything else here. An editor sees the source, the tier, the relevance and
 * quality scores, and why the item was flagged, then approves or rejects it.
 * Nothing from a secondary source can reach students without this step.
 */
export default function AdminNewsroomQueue({ onPublished }: { onPublished?: () => void }) {
  const [items, setItems] = useState<NewsroomCandidate[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchNewsroomCandidates('needs_review');
      setItems(result.items);
      setPending(result.pendingReview);
      setUnavailable(false);
    } catch (loadError) {
      // The newsroom migration may not be applied yet; say so instead of
      // showing a scary error for an optional console panel.
      setUnavailable(true);
      setError(userFacingError(loadError, 'The review queue is unavailable.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const approve = async (candidate: NewsroomCandidate) => {
    setBusyId(candidate.id);
    setError('');
    try {
      await approveNewsroomCandidate(candidate.id, { category: candidate.category });
      setMessage(`Published “${candidate.title.slice(0, 70)}”.`);
      setItems((current) => current.filter((item) => item.id !== candidate.id));
      setPending((current) => (current === null ? current : Math.max(0, current - 1)));
      onPublished?.();
    } catch (approveError) {
      setError(userFacingError(approveError, 'Unable to publish this story.'));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (candidate: NewsroomCandidate) => {
    setBusyId(candidate.id);
    setError('');
    try {
      await rejectNewsroomCandidate(candidate.id, 'Rejected from the newsroom review queue.');
      setItems((current) => current.filter((item) => item.id !== candidate.id));
      setPending((current) => (current === null ? current : Math.max(0, current - 1)));
    } catch (rejectError) {
      setError(userFacingError(rejectError, 'Unable to reject this story.'));
    } finally {
      setBusyId(null);
    }
  };

  const runNow = async () => {
    setLoading(true);
    setError('');
    try {
      const report = await runNewsroomIngest(false);
      setMessage(`Run complete — ${report.published} published, ${report.needsReview} queued, ${report.duplicates} duplicates skipped.`);
      await load();
    } catch (runError) {
      setError(userFacingError(runError, 'The ingestion run could not start.'));
      setLoading(false);
    }
  };

  return (
    <div className="admin-card" style={{ marginBottom: 18 }}>
      <div className="admin-card-header">
        <div>
          <h2>Ingestion review queue {pending ? <span className="status-badge">{pending}</span> : null}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Stories discovered by the daily pipeline from non-official sources wait here. Tier 1 official sources publish automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="admin-btn secondary-dark" onClick={() => void runNow()} disabled={loading}>
            <RefreshCw size={14} /> Run ingestion now
          </button>
          <button type="button" className="admin-text-btn" onClick={() => void load()} disabled={loading}>Refresh queue</button>
        </div>
      </div>

      {error && <div role="alert" style={{ padding: '10px 4px', color: 'var(--admin-red, #b42318)' }}>{error}</div>}
      {message && <div style={{ padding: '10px 4px', color: 'var(--admin-green)' }}>{message}</div>}

      {loading && <p className="muted">Loading the queue…</p>}

      {!loading && !items.length && (
        <p className="muted">
          {unavailable
            ? 'Apply supabase/migrations/20260930120000_newsroom_ingestion_pipeline.sql to enable the automated newsroom.'
            : 'Nothing waiting for review. The pipeline either found nothing new or published it directly.'}
        </p>
      )}

      {!loading && items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {items.map((candidate) => (
            <li key={candidate.id} style={{ border: '1px solid var(--admin-border, #e5e7eb)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>{candidate.title}</strong>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {newsCategoryLabel(candidate.category)} · Tier {candidate.source_tier ?? '?'} · {candidate.source_name || candidate.source_key}
                    {typeof candidate.relevance_score === 'number' ? ` · relevance ${candidate.relevance_score.toFixed(2)}` : ''}
                    {candidate.source_published_at ? ` · ${new Date(candidate.source_published_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                  </div>
                  {candidate.excerpt && <p style={{ margin: '8px 0 0' }}>{candidate.excerpt}</p>}
                  {candidate.review_notes && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Flagged: {candidate.review_notes}</p>}
                  <a className="admin-text-btn" href={candidate.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <ExternalLink size={12} /> Open source
                  </a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 110 }}>
                  <button type="button" className="admin-btn small" disabled={busyId === candidate.id} onClick={() => void approve(candidate)}>
                    <Check size={13} /> Publish
                  </button>
                  <button type="button" className="admin-btn small secondary-dark" disabled={busyId === candidate.id} onClick={() => void reject(candidate)}>
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
