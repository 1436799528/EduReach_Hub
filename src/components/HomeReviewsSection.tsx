import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Star, UserRound } from 'lucide-react';
import { userFacingError } from '../../lib/errors';
import { fetchReviews, type PublicReview, type ReviewSummary } from '../lib/api';
import OptimizedImage from './OptimizedImage';
import SectionHead from './SectionHead';
import '../home-engagement.css';
import { EmptyState, ErrorState } from './AsyncState';
import { SkeletonRows } from './Skeleton';

/** Seconds one card takes to travel across the marquee. */
const SECONDS_PER_CARD = 6;

function Stars({ rating }: { rating: number }) {
  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <span className="er-home-review-stars" role="img" aria-label={`${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={13} aria-hidden="true" className={value <= rounded ? 'is-filled' : ''} />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="er-news-card er-home-review-card">
      <div className="er-home-review-card-head">
        <span className="er-home-review-avatar" aria-hidden="true">
          {review.profileImage ? (
            <OptimizedImage src={review.profileImage} alt="" width={44} height={44} layout="card" className="er-home-review-avatar-image" />
          ) : (
            <UserRound size={20} />
          )}
        </span>
        <span className="er-home-review-identity">
          <strong>{review.displayName}</strong>
          {review.studentDescription && <small>{review.studentDescription}</small>}
        </span>
        {review.isPlaceholder && <span className="er-home-review-sample">Sample</span>}
      </div>
      <Stars rating={review.rating} />
      <blockquote className="er-home-review-quote">{review.reviewText}</blockquote>
      {review.createdAt && (
        <time className="er-home-review-date" dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}
        </time>
      )}
    </article>
  );
}

/**
 * Student reviews: a continuous, right-to-left marquee of the approved rows.
 *
 * Motion is decoration around content that is also available without it. The
 * track is duplicated once so the loop has no jump; hovering, focusing or
 * touching pauses it, and the explicit Pause/Play control is the keyboard path.
 * `prefers-reduced-motion` turns the animation off and the track becomes a
 * normal horizontal list.
 */
export default function HomeReviewsSection() {
  const [items, setItems] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [shift, setShift] = useState(0);
  const resumeTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchReviews(1)
      .then((payload) => {
        if (!active) return;
        setItems(payload.items || []);
        setSummary(payload.summary);
      })
      .catch((value) => {
        if (active) setError(userFacingError(value, 'Unable to load student reviews.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, [retry]);

  const paused = userPaused || interactionPaused;
  const duration = Math.max(items.length * SECONDS_PER_CARD, 18);

  const pauseForTouch = () => {
    setInteractionPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    // A tap or swipe pauses long enough to read; it never traps a vertical
    // page scroll because the track uses `touch-action: pan-y`.
    resumeTimer.current = window.setTimeout(() => setInteractionPaused(false), 12000);
  };

  const move = (direction: 1 | -1) => {
    if (!items.length) return;
    setUserPaused(true);
    setShift((value) => (value + direction + items.length) % items.length);
  };

  return (
    <section className="er-section er-home-reviews" id="student-reviews" aria-label="Student reviews">
      <SectionHead title="Student reviews" href="/reviews" linkLabel="All reviews" />
      <div className="er-home-section-heading">
        {summary && summary.reviewCount !== null && summary.reviewCount > 0 && summary.averageRating !== null && (
          <p className="er-review-summary">
            <strong>{summary.averageRating.toFixed(1)}</strong> / 5 · Based on {summary.reviewCount.toLocaleString()}{' '}
            approved review{summary.reviewCount === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <div className="er-late-region er-late-region--feed">
        {loading && <SkeletonRows rows={2} label="Loading student reviews" />}
        {!loading && error && <ErrorState error={error} onRetry={() => setRetry((value) => value + 1)} />}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="No reviews published yet"
            detail="Approved student reviews will appear here. You can share your own after completing a practice test."
            action={
              <a className="hub-outline-btn" href="/reviews">
                Write a review
              </a>
            }
          />
        )}
        {!loading && !error && items.length > 0 && (
          <div className="er-review-carousel">
            <div
              className="er-review-marquee"
              onMouseEnter={() => setInteractionPaused(true)}
              onMouseLeave={() => setInteractionPaused(false)}
              onFocus={() => setInteractionPaused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
              }}
              onTouchStart={pauseForTouch}
            >
              <div
                className={`er-review-track${paused ? ' is-paused' : ''}`}
                style={{ animationDuration: `${duration}s`, animationDelay: `${-shift * SECONDS_PER_CARD}s` }}
              >
                <div className="er-review-group">
                  {items.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
                {/* The second pass exists only so the loop has no seam. It is not
                    a second set of reviews, so assistive technology skips it. */}
                <div className="er-review-group" aria-hidden="true">
                  {items.map((review) => (
                    <ReviewCard key={`${review.id}-loop`} review={review} />
                  ))}
                </div>
              </div>
            </div>
            <div className="er-review-controls">
              <button
                type="button"
                className="er-review-control"
                aria-label="Previous reviews"
                onClick={() => move(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="er-review-control"
                aria-label={userPaused ? 'Play student reviews' : 'Pause student reviews'}
                aria-pressed={userPaused}
                onClick={() => {
                  if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
                  setInteractionPaused(false);
                  setUserPaused((value) => !value);
                }}
              >
                {userPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              </button>
              <button type="button" className="er-review-control" aria-label="Next reviews" onClick={() => move(1)}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
