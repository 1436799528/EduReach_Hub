import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { fetchCbtHistory, type CbtHistoryItem } from '../lib/api';
import { remainingLabel } from '../lib/dashboardPriority';
import { selectResumableAttempt } from '../lib/homeResume';
import { useAuth } from '../lib/auth';

/**
 * The one thing a returning student came back for.
 *
 * It renders nothing for guests and new students, so the home page keeps its
 * single call to action. Once an attempt exists, it sits between the headline
 * and the exam cards and carries the progress the student already made. The
 * same expiry rule as the dashboard decides whether the attempt is offered.
 */
export default function ContinuePracticeCard() {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const [attempt, setAttempt] = useState<CbtHistoryItem | null>(null);

  useEffect(() => {
    if (isLoading || !userId) {
      setAttempt(null);
      return;
    }
    let active = true;
    void fetchCbtHistory(10)
      .then((items) => {
        if (active) setAttempt(selectResumableAttempt(items));
      })
      .catch(() => {
        // A convenience card must never turn the home page into an error page.
        if (active) setAttempt(null);
      });
    return () => { active = false; };
  }, [isLoading, userId]);

  if (!attempt) return null;

  const total = Math.max(0, attempt.totalQuestions);
  const answered = Math.min(Math.max(0, attempt.answered), total);
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
  const timeLeft = remainingLabel(attempt.expiresAt);
  const mode = attempt.mode === 'mock' ? 'Mock paper' : 'Practice';

  return (
    <section className="home-resume" aria-labelledby="home-resume-title">
      <div className="home-resume-copy">
        <span className="home-resume-kicker">Continue practising</span>
        <h2 id="home-resume-title">{attempt.examTitle}</h2>
        <p>
          {mode} · {answered} of {total} answered
          {timeLeft ? ` · ${timeLeft}` : ''}
        </p>
        {total > 0 && (
          <div
            className="home-resume-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
            aria-label={`${answered} of ${total} questions answered`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <a className="hub-primary-btn" href={`/cbt/session/${encodeURIComponent(attempt.id)}`}>
        Resume paper <ArrowRight size={14} />
      </a>
    </section>
  );
}
