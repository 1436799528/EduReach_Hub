import { userFacingError } from '../lib/errors';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, EyeOff, ImagePlus, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAdminReview,
  deleteAdminReview,
  fetchAdminReviews,
  moderateAdminReview,
  reorderAdminReviews,
  updateAdminReview,
  uploadAdminImage,
  type AdminReview,
  type AdminReviewInput,
  type ReviewSummary,
} from '../src/lib/api';
import { AdminEmptyState, AdminPageReport, StatusBadge, TableSkeleton } from '../src/components/admin/AdminKit';
import { Can } from '../src/components/admin/Can';
import FilterPills from '../src/components/FilterPills';

/**
 * Reviews Management.
 *
 * This is the editorial record behind the homepage carousel and the public
 * reviews page. An administrator can create, rewrite, order, feature, publish,
 * hide and permanently delete a review, and can replace its sample text with a
 * real student's words. Every write is capability-gated and audited server-side;
 * this page only decides what the console shows.
 *
 * A placeholder is never silently promoted. It carries the flag into the public
 * card (where it is labelled "Sample") and is excluded from the published
 * average, so seeding three samples cannot make the product look better rated
 * than it is.
 */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'approved', label: 'Published' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'pending', label: 'Pending' },
  { id: 'rejected', label: 'Rejected' },
];

type Filter = 'pending' | 'approved' | 'hidden' | 'rejected' | 'all';

const STATUS_OPTIONS: Array<{ value: AdminReview['status']; label: string }> = [
  { value: 'approved', label: 'Published (visible to students)' },
  { value: 'hidden', label: 'Hidden (not public)' },
  { value: 'pending', label: 'Pending moderation' },
  { value: 'rejected', label: 'Rejected' },
];

type EditorState = AdminReviewInput & { id: string | null };

function emptyEditor(nextOrder: number): EditorState {
  return {
    id: null,
    displayName: '',
    profileImage: null,
    studentDescription: '',
    reviewText: '',
    rating: 5,
    examType: null,
    status: 'approved',
    isFeatured: false,
    isPlaceholder: false,
    displayOrder: nextOrder,
  };
}

function editorFrom(review: AdminReview): EditorState {
  return {
    id: review.id,
    displayName: review.displayName,
    profileImage: review.profileImage,
    studentDescription: review.studentDescription || '',
    reviewText: review.reviewText,
    rating: review.rating,
    examType: review.examType,
    status: review.status,
    isFeatured: review.isFeatured,
    isPlaceholder: review.isPlaceholder,
    displayOrder: review.displayOrder,
  };
}

export default function AdminReviewsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<AdminReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ reviewCount: null, averageRating: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => {
    void load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filter]);

  async function decide(review: AdminReview, status: 'approved' | 'rejected' | 'hidden') {
    setBusyId(review.id);
    setMessage('');
    setError('');
    try {
      await moderateAdminReview(review.id, status);
      setMessage(
        status === 'approved'
          ? `“${review.displayName}” is now published.`
          : `“${review.displayName}” is no longer public.`,
      );
      await load(filter);
    } catch (value) {
      setError(userFacingError(value, 'Unable to update this review.'));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(review: AdminReview) {
    const note = review.isPlaceholder
      ? 'Delete this sample review permanently? The homepage will lose one placeholder card.'
      : `Permanently delete the review by “${review.displayName}”? This cannot be undone. Hide it instead if you only want it off the homepage.`;
    if (!window.confirm(note)) return;
    setBusyId(review.id);
    setError('');
    try {
      await deleteAdminReview(review.id);
      if (editor?.id === review.id) setEditor(null);
      setMessage('Review permanently deleted.');
      await load(filter);
    } catch (value) {
      setError(userFacingError(value, 'Unable to delete this review.'));
    } finally {
      setBusyId(null);
    }
  }

  async function move(review: AdminReview, direction: -1 | 1) {
    const index = items.findIndex((item) => item.id === review.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setBusyId(review.id);
    setError('');
    try {
      await reorderAdminReviews(next.map((item) => item.id));
      setItems(next.map((item, order) => ({ ...item, displayOrder: order })));
      setMessage('Display order saved.');
    } catch (value) {
      setError(userFacingError(value, 'Unable to reorder reviews.'));
    } finally {
      setBusyId(null);
    }
  }

  async function uploadPicture(file: File) {
    if (!editor) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Images must be 2 MB or smaller.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the image file.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadAdminImage(dataUrl);
      setEditor((state) => (state ? { ...state, profileImage: uploaded.url } : state));
      setMessage('Profile picture uploaded. Save the review to publish it.');
    } catch (value) {
      setError(userFacingError(value, 'Image upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!editor) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload: AdminReviewInput = {
        displayName: editor.displayName,
        profileImage: editor.profileImage,
        studentDescription: editor.studentDescription || null,
        reviewText: editor.reviewText,
        rating: editor.rating,
        examType: editor.examType,
        status: editor.status,
        isFeatured: editor.isFeatured,
        isPlaceholder: editor.isPlaceholder,
        displayOrder: editor.displayOrder,
      };
      if (editor.id) await updateAdminReview(editor.id, payload);
      else await createAdminReview(payload);
      setMessage(editor.id ? 'Review updated.' : 'Review created.');
      setEditor(null);
      await load(filter);
    } catch (value) {
      setError(userFacingError(value, 'Unable to save this review.'));
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(
    () => ({
      visible: items.length,
      average: summary.averageRating === null ? 'Unavailable' : `${summary.averageRating.toFixed(1)} / 5`,
      approved: summary.reviewCount === null ? 'Unavailable' : summary.reviewCount.toLocaleString(),
    }),
    [items.length, summary],
  );

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Reviews</h1>
          <p>
            Manage the reviews on the homepage and the public reviews page. The published rating is computed from
            published reviews only, and sample entries are never counted.
          </p>
        </div>
        <div className="admin-header-actions">
          <Can capability="review.moderate">
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setMessage('');
                setEditor(emptyEditor(Math.max(0, ...items.map((item) => item.displayOrder)) + 1));
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add review
            </button>
          </Can>
          <button
            type="button"
            className="admin-btn secondary-dark"
            onClick={() => void load(filter)}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="admin-card"
          role="alert"
          style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <span>{error}</span>
          <button type="button" className="admin-btn small" onClick={() => void load(filter)}>
            Try again
          </button>
        </div>
      )}
      {message && (
        <div
          className="admin-card"
          role="status"
          style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}
        >
          <span>{message}</span>
        </div>
      )}

      <AdminPageReport
        title="Review reporting"
        items={[
          { label: 'Reviews in this view', value: counts.visible.toLocaleString() },
          { label: 'Published rating', value: counts.average },
          { label: 'Published reviews', value: counts.approved },
        ]}
      />

      {editor && (
        <section className="admin-card" aria-labelledby="review-editor-title">
          <div className="admin-card-header">
            <h2 id="review-editor-title">{editor.id ? 'Edit review' : 'Add a review'}</h2>
            <span>{editor.isPlaceholder ? 'Marked as a sample' : 'Student review'}</span>
          </div>
          <div style={{ display: 'grid', gap: 14, padding: 16 }}>
            <div className="admin-field-row">
              <label className="admin-field">
                <span>Display name</span>
                <input
                  className="admin-input"
                  value={editor.displayName}
                  maxLength={60}
                  placeholder="e.g. Amina Bello"
                  onChange={(event) => setEditor({ ...editor, displayName: event.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Description (optional)</span>
                <input
                  className="admin-input"
                  value={editor.studentDescription || ''}
                  maxLength={120}
                  placeholder="e.g. UNICAL student"
                  onChange={(event) => setEditor({ ...editor, studentDescription: event.target.value })}
                />
              </label>
            </div>

            <div className="admin-field-row">
              <label className="admin-field">
                <span>Rating</span>
                <select
                  className="admin-select"
                  value={editor.rating}
                  onChange={(event) => setEditor({ ...editor, rating: Number(event.target.value) })}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} star{value === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Visibility</span>
                <select
                  className="admin-select"
                  value={editor.status}
                  onChange={(event) => setEditor({ ...editor, status: event.target.value as AdminReview['status'] })}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Display order</span>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  max={10000}
                  value={editor.displayOrder}
                  onChange={(event) => setEditor({ ...editor, displayOrder: Number(event.target.value) })}
                />
              </label>
              <label className="admin-field">
                <span>Exam type (optional)</span>
                <select
                  className="admin-select"
                  value={editor.examType || ''}
                  onChange={(event) => setEditor({ ...editor, examType: event.target.value || null })}
                >
                  <option value="">Not stated</option>
                  {['JAMB', 'WAEC', 'NECO', 'POST-UTME', 'Other'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-field">
              <span>Profile picture</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="er-review-avatar" aria-hidden="true">
                  {editor.profileImage ? (
                    <img src={editor.profileImage} alt="" width={44} height={44} loading="lazy" />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                </span>
                <label className="admin-btn secondary" style={{ width: 'auto', cursor: 'pointer' }}>
                  {uploading ? 'Uploading…' : editor.profileImage ? 'Change picture' : 'Upload picture'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void uploadPicture(file);
                    }}
                  />
                </label>
                {editor.profileImage && (
                  <button
                    type="button"
                    className="admin-btn secondary"
                    onClick={() => setEditor({ ...editor, profileImage: null })}
                  >
                    Remove picture
                  </button>
                )}
                <span className="muted" style={{ fontSize: 11 }}>
                  PNG, JPEG, WebP or GIF, up to 2 MB. A neutral avatar is shown when none is uploaded.
                </span>
              </div>
            </div>

            <label className="admin-field">
              <span>Review text</span>
              <textarea
                className="admin-textarea"
                rows={4}
                value={editor.reviewText}
                maxLength={1200}
                placeholder="What did the student actually say?"
                onChange={(event) => setEditor({ ...editor, reviewText: event.target.value })}
              />
              <small className="muted">{editor.reviewText.trim().length} / 1200 characters (minimum 20)</small>
            </label>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <label className="admin-check-row">
                <input
                  type="checkbox"
                  checked={editor.isFeatured}
                  onChange={(event) => setEditor({ ...editor, isFeatured: event.target.checked })}
                />
                Feature at the front of the carousel
              </label>
              <label className="admin-check-row">
                <input
                  type="checkbox"
                  checked={editor.isPlaceholder}
                  onChange={(event) => setEditor({ ...editor, isPlaceholder: event.target.checked })}
                />
                This is a sample entry
              </label>
            </div>
            {editor.isPlaceholder && (
              <p className="muted" style={{ margin: 0 }}>
                Sample entries are labelled “Sample” on the homepage and are excluded from the published rating.
                Replace the text with a real student&apos;s words before unchecking this box.
              </p>
            )}

            <div className="admin-action-row">
              <button type="button" className="admin-btn" onClick={() => void save()} disabled={saving || uploading}>
                <Check size={14} aria-hidden="true" /> {saving ? 'Saving…' : 'Save review'}
              </button>
              <button type="button" className="admin-btn secondary" onClick={() => setEditor(null)} disabled={saving}>
                Cancel
              </button>
              {editor.id && (
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={() => {
                    const item = items.find((entry) => entry.id === editor.id);
                    if (item) void remove(item);
                  }}
                  disabled={saving || busyId === editor.id}
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete permanently
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>All reviews</h2>
          <span>Featured first, then display order</span>
        </div>
        <FilterPills
          options={FILTERS}
          active={filter}
          onChange={(id) => setFilter(id as Filter)}
          ariaLabel="Filter reviews by publication state"
        />

        <div
          className="admin-table-wrap admin-table-wrap--stack"
          role="region"
          aria-label="Scrollable table"
          tabIndex={0}
          style={{ marginTop: 12 }}
        >
          <table className="admin-table admin-table--stack">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Rating</th>
                <th scope="col">Review</th>
                <th scope="col">Order</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton rows={4} columns={6} />}
              {!loading &&
                items.map((review, index) => (
                  <tr key={review.id}>
                    <td data-label="Student">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="er-review-avatar" aria-hidden="true">
                          {review.profileImage ? (
                            <img src={review.profileImage} alt="" width={44} height={44} loading="lazy" />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 680 }}>
                              {review.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span>
                          <b>{review.displayName}</b>
                          <div className="muted">{review.studentDescription || review.examType || 'No description'}</div>
                          {review.isPlaceholder && <span className="admin-pill is-warn">Sample</span>}
                          {review.isFeatured && <span className="admin-pill">Featured</span>}
                        </span>
                      </div>
                    </td>
                    <td data-label="Rating">
                      <span aria-label={`${review.rating} out of 5 stars`}>
                        {'★'.repeat(review.rating)}
                        {'☆'.repeat(5 - review.rating)}
                      </span>
                      <div className="muted">{review.rating} / 5</div>
                    </td>
                    <td data-label="Review" style={{ maxWidth: 420, whiteSpace: 'pre-line' }}>
                      {review.reviewText}
                    </td>
                    <td data-label="Order">
                      <div className="admin-action-row">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          aria-label={`Move ${review.displayName} earlier`}
                          disabled={index === 0 || busyId === review.id || filter !== 'all'}
                          onClick={() => void move(review, -1)}
                        >
                          <ArrowUp size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          aria-label={`Move ${review.displayName} later`}
                          disabled={index === items.length - 1 || busyId === review.id || filter !== 'all'}
                          onClick={() => void move(review, 1)}
                        >
                          <ArrowDown size={13} aria-hidden="true" />
                        </button>
                        <span className="muted">{review.displayOrder}</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={review.status} />
                    </td>
                    <td className="right" data-label="Actions">
                      <Can capability="review.moderate" fallback={<span className="muted">Read only</span>}>
                        <div className="admin-action-row" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="admin-btn small secondary"
                            onClick={() => {
                              setMessage('');
                              setEditor(editorFrom(review));
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <Pencil size={12} aria-hidden="true" /> Edit
                          </button>
                          {review.status === 'approved' ? (
                            <button
                              type="button"
                              className="admin-btn small secondary"
                              disabled={busyId === review.id}
                              onClick={() => void decide(review, 'hidden')}
                            >
                              <EyeOff size={12} aria-hidden="true" /> Hide
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn small"
                              disabled={busyId === review.id}
                              onClick={() => void decide(review, 'approved')}
                            >
                              <Check size={12} aria-hidden="true" /> Publish
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-btn small danger"
                            disabled={busyId === review.id}
                            onClick={() => void remove(review)}
                          >
                            <Trash2 size={12} aria-hidden="true" /> Delete
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
                      title={filter === 'pending' ? 'No reviews waiting' : 'No reviews in this view'}
                      hint="Add a review, or switch the filter to see hidden and sample entries."
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
