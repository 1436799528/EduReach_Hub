import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, Play, RotateCcw, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState } from './AsyncState';
import { deleteCbtAttempt, fetchCbtHistory, type CbtHistoryItem } from '../lib/api';
import { userFacingError } from '../../lib/errors';
import { useAuth } from '../lib/auth';

/**
 * CBT-5 — the student's own practice record.
 *
 * Practice and mock are kept visibly distinct here: a practice session can be
 * resumed, restarted or deleted by the student, while a mock is an examination
 * record and offers review only. Deletion is confirmed, and the confirmation
 * says what will actually be removed — the server enforces the same rule.
 */

const STATUS_LABEL: Record<CbtHistoryItem['status'], string> = {
  in_progress: 'In progress',
  submitted: 'Submitted',
  expired: 'Time ran out',
  cancelled: 'Ended',
};

function formatWhen(value: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

export default function CbtHistoryPanel() {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CbtHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<CbtHistoryItem | null>(null);
  const [busyId, setBusyId] = useState('');
  const dialog = useRef<HTMLDialogElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchCbtHistory(25));
    } catch (value) {
      setError(value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }
    void load();
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authLoading, load, user]);

  useEffect(() => {
    if (confirming && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [confirming]);

  async function remove(item: CbtHistoryItem) {
    setBusyId(item.id);
    try {
      await deleteCbtAttempt(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice('Practice session deleted.');
    } catch (value) {
      setNotice(userFacingError(value, 'That practice session could not be deleted.'));
    } finally {
      setBusyId('');
      setConfirming(null);
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <EmptyState
        title="Your practice history lives here"
        detail="Sign in to see previous practice and mock sessions, resume one you left open, or clear practice you no longer need."
        action={<a className="hub-outline-btn" href={`/login?next=${encodeURIComponent('/cbt')}`}>Sign in</a>}
      />
    );
  }

  return (
    <div className="er-history">
      <div className="er-history-head">
        <div>
          <span className="hub-eyebrow">Your sessions</span>
          <h2 style={{ margin: '3px 0 0', fontSize: '18px' }}>Practice history</h2>
        </div>
        <a className="hub-outline-btn" href="/dashboard/cbt">All results</a>
      </div>

      {notice && <div className="er-inline-notice is-success" role="status"><div><p>{notice}</p></div></div>}
      {loading && <div className="er-state" role="status"><span className="er-state-icon" aria-hidden="true"><Clock3 size={20} /></span><div><strong>Loading your sessions…</strong></div></div>}
      {!loading && error && <ErrorState error={error} onRetry={() => void load()} compact />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No sessions yet"
          detail="Start a practice session and it will appear here — with your answers, time and result."
          action={<a className="hub-primary-btn" href="/cbt">Choose a question bank</a>}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="er-history-list">
          {items.map((item) => (
            <div className="er-history-item" key={item.id}>
              <div className="er-history-head">
                <div>
                  <strong>{item.examTitle}</strong>
                  <span>{formatWhen(item.startedAt)}{item.examBody ? ` · ${item.examBody}` : ''}</span>
                </div>
                <span className={`er-history-badge is-${item.status}`}>{STATUS_LABEL[item.status]}</span>
              </div>
              <div className="er-history-meta">
                <span>{item.mode === 'mock' ? 'Mock examination' : 'Practice'}</span>
                {item.programme && <span>{item.programme}</span>}
                <span>{item.totalQuestions} questions</span>
                {item.durationMinutes && <span>{item.durationMinutes} minutes</span>}
                {item.subjects.length > 0 && <span>{item.subjects.slice(0, 4).join(' · ')}{item.subjects.length > 4 ? ` +${item.subjects.length - 4}` : ''}</span>}
                {item.status === 'submitted' && item.score !== null && <span><strong>{Math.round(item.score)}%</strong> · {item.correctAnswers}/{item.totalQuestions}</span>}
                {item.status === 'in_progress' && <span>{item.answered} answered</span>}
              </div>
              <div className="er-history-actions">
                {item.resumable && (
                  <a className="hub-primary-btn" href={`/cbt/session/${encodeURIComponent(item.id)}`}><Play size={14} /> Resume</a>
                )}
                {item.status === 'submitted' && (
                  <a className="hub-outline-btn" href={`/cbt/results/${encodeURIComponent(item.id)}`}>View result</a>
                )}
                {item.status !== 'in_progress' && (
                  <a className="hub-outline-btn" href={`/cbt/setup/jamb?mode=${item.mode}`}><RotateCcw size={14} /> Start a new session</a>
                )}
                {item.mode === 'practice' && (
                  <button type="button" className="er-danger-btn" onClick={() => setConfirming(item)} disabled={busyId === item.id}>
                    <Trash2 size={14} /> {busyId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
                {item.mode === 'mock' && <span className="er-type-meta">Mock records are kept as examination history.</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <dialog ref={dialog} className="er-confirm" onClose={() => setConfirming(null)} aria-labelledby="er-delete-title">
        <div className="er-confirm-body">
          <h2 id="er-delete-title">Delete this practice session?</h2>
          <p>
            <strong>{confirming?.examTitle}</strong> from {formatWhen(confirming?.startedAt ?? null)} and every answer in it
            will be removed from your account. This cannot be undone. Mock examination records cannot be deleted, and are not affected.
          </p>
          <div className="er-confirm-actions">
            <button type="button" className="hub-outline-btn" onClick={() => { setConfirming(null); dialog.current?.close(); }}>Keep it</button>
            <button type="button" className="er-danger-btn" onClick={() => confirming && void remove(confirming)}>
              <Trash2 size={14} /> Delete session
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
