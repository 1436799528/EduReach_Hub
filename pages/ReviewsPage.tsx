import { MessageSquarePlus, Star } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { SkeletonRows } from '../src/components/Skeleton';
import { useAuth } from '../src/lib/auth';
import { fetchReviews, submitReview, type PublicReview, type ReviewSummary } from '../src/lib/api';
import { userFacingError } from '../lib/errors';
import { freshnessDate } from '../src/lib/newsFreshness';
import '../src/reviews.css';

/**
 * Student reviews.
 *
 * Only approved reviews are shown, and the rating is computed by the server
 * from those rows. A brand-new review never appears instantly: it is queued
 * for moderation, which is what stops an abusive or spam submission from
 * becoming public copy.
 *
 * The star input is a real radio group with visible text labels ("1 star" …
 * "5 stars") so it is operable by keyboard and by a screen reader, and the
 * meaning never depends on the colour of a star.
 */

const EXAM_OPTIONS = ['', 'JAMB', 'WAEC', 'NECO', 'POST-UTME', 'Other'];
const MIN_TEXT = 20;

export function Stars({ rating, label }: { rating: number; label?: string }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="er-stars" role="img" aria-label={label || `${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <span key={value} className={value <= rounded ? 'er-star is-filled' : 'er-star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export function RatingSummary({ summary, className = '' }: { summary: ReviewSummary; className?: string }) {
  const count = summary.reviewCount;
  if (count === null) {
    return (
      <div className={`er-rating-summary ${className}`.trim()} role="status">
        <p className="er-rating-empty">The rating could not be loaded right now.</p>
      </div>
    );
  }
  if (count === 0 || summary.averageRating === null) {
    return (
      <div className={`er-rating-summary ${className}`.trim()}>
        <p className="er-rating-empty">Be one of the first students to review EduReach Hub.</p>
      </div>
    );
  }
  return (
    <div className={`er-rating-summary ${className}`.trim()}>
      <p className="er-rating-score">
        <strong>{summary.averageRating.toFixed(1)}</strong>
        <span aria-hidden="true"> / 5</span>
        <span className="er-visually-hidden"> out of 5</span>
      </p>
      <Stars rating={summary.averageRating} />
      <p className="er-rating-count">Based on {count.toLocaleString()} approved review{count === 1 ? '' : 's'}</p>
    </div>
  );
}

type FormState = { rating: number; reviewText: string; examType: string };

const EMPTY_FORM: FormState = { rating: 0, reviewText: '', examType: '' };

export default function ReviewsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ reviewCount: null, averageRating: null });
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReviews(1)
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items);
        setSummary(payload.summary);
        setHasMore(payload.hasMore);
      })
      .catch((value) => { if (!cancelled) setError(userFacingError(value, 'Reviews could not be loaded.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    const next = page + 1;
    try {
      const payload = await fetchReviews(next);
      setItems((current) => [...current, ...payload.items]);
      setSummary(payload.summary);
      setHasMore(payload.hasMore);
      setPage(next);
    } catch (value) {
      setError(userFacingError(value, 'More reviews could not be loaded.'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setNotice('');
    if (form.rating < 1 || form.rating > 5) {
      setFormError('Choose a rating from 1 to 5 stars.');
      return;
    }
    if (form.reviewText.trim().length < MIN_TEXT) {
      setFormError(`Write at least ${MIN_TEXT} characters so the review is useful to another student.`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReview({
        rating: form.rating,
        reviewText: form.reviewText.trim(),
        examType: form.examType || null,
      });
      setNotice(result.message || 'Your review is waiting for moderation.');
      setForm(EMPTY_FORM);
    } catch (value) {
      setFormError(userFacingError(value, 'Your review could not be submitted.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <HubLayout>
      <div className="hub-page er-comfort-page">
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow">STUDENT VOICES</span>
              <h1>Reviews from real students</h1>
              <p>
                Written by students who have practised or used a service here. Reviews are moderated before they
                appear, and the rating below is calculated from the approved reviews only.
              </p>
            </div>
          </div>

          <RatingSummary summary={summary} className="er-rating-summary-card" />

          <section className="er-review-form-card" aria-labelledby="write-review">
            <div className="er-review-form-head">
              <MessageSquarePlus size={18} aria-hidden="true" />
              <div>
                <h2 id="write-review">Write a review</h2>
                <p>One review per account. After you have used the platform, tell other students what helped.</p>
              </div>
            </div>

            {!user ? (
              <p className="er-review-signin">
                <a href="/login">Sign in</a> to write a review. Only students who have used EduReach are eligible.
              </p>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <fieldset className="er-rating-field">
                  <legend>Your rating</legend>
                  <div className="er-rating-options">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <label key={value} className={form.rating === value ? 'er-rating-option is-selected' : 'er-rating-option'}>
                        <input
                          type="radio"
                          name="rating"
                          value={value}
                          checked={form.rating === value}
                          onChange={() => setForm((current) => ({ ...current, rating: value }))}
                        />
                        <Star size={16} aria-hidden="true" />
                        <span>{value} star{value === 1 ? '' : 's'}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="er-review-field">
                  <span>Your review</span>
                  <textarea
                    rows={5}
                    maxLength={1200}
                    value={form.reviewText}
                    onChange={(event) => setForm((current) => ({ ...current, reviewText: event.target.value }))}
                    aria-describedby="review-text-help"
                    required
                  />
                  <small id="review-text-help">{form.reviewText.trim().length}/1200 characters · minimum {MIN_TEXT}</small>
                </label>

                <label className="er-review-field er-review-field--short">
                  <span>What were you preparing for? (optional)</span>
                  <select
                    value={form.examType}
                    onChange={(event) => setForm((current) => ({ ...current, examType: event.target.value }))}
                  >
                    {EXAM_OPTIONS.map((option) => (
                      <option key={option || 'none'} value={option}>{option || 'Prefer not to say'}</option>
                    ))}
                  </select>
                </label>

                {formError && <p className="hub-form-error" role="alert">{formError}</p>}
                {notice && <p className="er-review-notice" role="status">{notice}</p>}

                <button type="submit" className="hub-primary-btn" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Submit for moderation'}
                </button>
              </form>
            )}
          </section>

          <section className="er-reviews-list" aria-labelledby="published-reviews">
            <h2 id="published-reviews">Published reviews</h2>
            {loading && <SkeletonRows rows={3} label="Loading reviews" />}
            {error && <div className="hub-form-error" role="alert">{error}</div>}
            {!loading && !error && items.length === 0 && (
              <div className="hub-panel hub-empty">
                <h3>No approved reviews yet</h3>
                <p>Be one of the first students to review EduReach Hub.</p>
              </div>
            )}
            {items.map((review) => (
              <article className="er-review-card" key={review.id} aria-label={`Review by ${review.displayName}`}>
                <header>
                  <span className="er-review-person">
                    {review.profileImage ? (
                      <img src={review.profileImage} alt="" width={40} height={40} loading="lazy" />
                    ) : (
                      <span aria-hidden="true">{review.displayName.slice(0, 1).toUpperCase()}</span>
                    )}
                    <span>
                      <strong>{review.displayName}</strong>
                      {review.studentDescription && <small>{review.studentDescription}</small>}
                    </span>
                  </span>
                  <Stars rating={review.rating} />
                  <span className="er-review-meta">
                    {review.examType ? `${review.examType} · ` : ''}
                    {freshnessDate(review.createdAt)}
                    {review.isPlaceholder ? ' · Sample entry' : ''}
                  </span>
                </header>
                <p>{review.reviewText}</p>
              </article>
            ))}
            {hasMore && (
              <button type="button" className="hub-outline-btn" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more reviews'}
              </button>
            )}
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
