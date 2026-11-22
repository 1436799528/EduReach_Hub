import { userFacingError } from '../lib/errors';
import { useEffect, useMemo, useState } from 'react';
import { Check, EyeOff, RefreshCw, X } from 'lucide-react';
import { fetchAdminReviews, moderateAdminReview, type AdminReview, type ReviewSummary } from '../src/lib/api';
import { AdminEmptyState, AdminPageReport, StatusBadge, TableSkeleton } from '../src/components/admin/AdminKit';
import { Can } from '../src/components/admin/Can';
import FilterPills from '../src/components/FilterPills';

/**
 * Review moderation.
 *
 * Approving here is what puts a review on the public page, and the public
 * rating is recomputed from approved rows on every read. The moderation note is
 * kept for staff; it is never part of the public payload.
 */

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

type Filter = 'pending' | 'approved' | 'hidden' | 'rejected' | 'all';

export default function AdminReviewsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<AdminReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ reviewCount: null, averageRating: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load(next: Filter = filter) {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchAdminReviews(next);
      setItems(payload.items);
      setSummary(payload.summary);
    } catch (value) {
      setItems([]);
      setError(userFacingError(value, 'Unable to load reviews.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function decide(review: AdminReview, status: 'approved' | 'rejected' | 'hidden') {
    setBusyId(review.id);
    setMessage('');
    setError('');
    try {
      await moderateAdminReview(review.id, status, notes[review.id] || '');
      setMessage(`Review ${status}.${status === 'approved' ? ' It is now visible to students.' : ' It is no longer public.'}`);
      setNotes((current) => ({ ...current, [review.id]: '' }));
      await load(filter);
    } catch (value) {
      setError(userFacingError(value, 'Unable to update this review.'));
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => ({
    visible: items.length,
    average: summary.averageRating === null ? 'Unavailable' : `${summary.averageRating.toFixed(1)} / 5`,
    approved: summary.reviewCount === null ? 'Unavailable' : summary.reviewCount.toLocaleString(),
  }), [items.length, summary]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Reviews</h1>
          <p>Approve, hide or reject student reviews. The public rating is computed from approved reviews only.</p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-btn secondary-dark" onClick={() => void load(filter)} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-card" role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="admin-btn small" onClick={() => void load(filter)}>Try again</button>
        </div>
      )}
      {message && (
        <div className="admin-card" role="status" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}>
          <span>{message}</span>
        </div>
      )}

      <AdminPageReport
        title="Review reporting"
        items={[
          { label: 'Reviews in this view', value: counts.visible.toLocaleString() },
          { label: 'Published rating', value: counts.average },
          { label: 'Approved reviews', value: counts.approved },
        ]}
      />

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Moderation queue</h2>
          <span>Approved reviews are public</span>
        </div>
        <FilterPills
          options={FILTERS}
          active={filter}
          onChange={(id) => setFilter(id as Filter)}
          ariaLabel="Filter reviews by moderation status"
        />

        <div className="admin-table-wrap admin-table-wrap--stack" role="region" aria-label="Scrollable table" tabIndex={0} style={{ marginTop: 12 }}>
          <table className="admin-table admin-table--stack">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Rating</th>
                <th scope="col">Review</th>
                <th scope="col">Submitted</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">Moderate</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton rows={4} columns={6} />}
              {!loading && items.map((review) => (
                <tr key={review.id}>
                  <td data-label="Student">
                    <b>{review.displayName}</b>
                    <div className="muted">{review.examType || 'No exam type'}</div>
                  </td>
                  <td data-label="Rating">
                    <span aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                    <div className="muted">{review.rating} / 5</div>
                  </td>
                  <td data-label="Review" style={{ maxWidth: 420, whiteSpace: 'pre-line' }}>{review.reviewText}</td>
                  <td data-label="Submitted">{new Date(review.createdAt).toLocaleDateString()}</td>
                  <td data-label="Status"><StatusBadge status={review.status} /></td>
                  <td className="right" data-label="Moderate">
                    <Can capability="review.moderate" fallback={<span className="muted">Read only</span>}>
                      <label className="muted" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                        Note (optional)
                        <input
                          className="admin-input"
                          value={notes[review.id] || ''}
                          maxLength={300}
                          onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))}
                          aria-label={`Moderation note for the review by ${review.displayName}`}
                        />
                      </label>
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" disabled={busyId === review.id || review.status === 'approved'} onClick={() => void decide(review, 'approved')}>
                          <Check size={12} aria-hidden="true" /> Approve
                        </button>
                        <button type="button" className="admin-btn small secondary" disabled={busyId === review.id || review.status === 'hidden'} onClick={() => void decide(review, 'hidden')}>
                          <EyeOff size={12} aria-hidden="true" /> Hide
                        </button>
                        <button type="button" className="admin-btn small danger" disabled={busyId === review.id || review.status === 'rejected'} onClick={() => void decide(review, 'rejected')}>
                          <X size={12} aria-hidden="true" /> Reject
                        </button>
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    <AdminEmptyState
                      title={filter === 'pending' ? 'No reviews waiting' : 'No reviews in this state'}
                      hint="A submitted review appears here before it can appear on the public page."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
