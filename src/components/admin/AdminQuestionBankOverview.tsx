import { userFacingError } from '../../../lib/errors';
import { useEffect, useState } from 'react';
import { BookOpenCheck, RefreshCw } from 'lucide-react';
import { fetchAdminQuestionBanks, type AdminQuestionBankSummary } from '../../lib/api';
import { TimeAgo } from './AdminKit';

/**
 * Question-bank totals, from the database.
 *
 * Every number here is an aggregate of `cbt_exams` / `exam_questions` computed
 * by `admin_question_bank_summary()`. There is no fallback count: if the query
 * fails the panel says so, because a plausible-looking zero would be a lie
 * about a bank that may hold thousands of questions.
 *
 * JAMB, WAEC, NECO and Post-UTME are returned even when their bank is empty, so
 * "no questions yet" is visible rather than silently missing.
 */
export default function AdminQuestionBankOverview({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<AdminQuestionBankSummary[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchAdminQuestionBanks());
    } catch (value) {
      setItems(null);
      setError(userFacingError(value, 'Question-bank totals could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className={`admin-card admin-bank-overview${compact ? ' is-compact' : ''}`} aria-labelledby="question-bank-heading">
      <div className="admin-card-header">
        <h2 id="question-bank-heading">
          <BookOpenCheck size={15} aria-hidden="true" /> Question banks
        </h2>
        <div className="admin-header-actions">
          <span className="admin-footnote">Live counts from the question table</span>
          <button type="button" className="admin-btn small secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spin' : undefined} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {loading && !items && (
        <p className="admin-footnote" role="status">Counting questions…</p>
      )}

      {error && (
        <div className="admin-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-btn small" onClick={() => void load()}>Try again</button>
        </div>
      )}

      {items && (
        <div className="admin-bank-grid">
          {items.map((bank) => {
            const subjects = bank.subjects.slice(0, 6);
            const extraSubjects = bank.subjects.length - subjects.length;
            const years = bank.firstYear && bank.lastYear
              ? bank.firstYear === bank.lastYear ? String(bank.firstYear) : `${bank.firstYear}–${bank.lastYear}`
              : null;
            const state = bank.questionCount === 0
              ? 'Empty'
              : bank.approvedCount === 0
                ? 'Needs review'
                : bank.needsReviewCount > 0
                  ? 'Active · review pending'
                  : 'Active';
            return (
              <article className="admin-bank-tile" key={bank.examBody} aria-label={`${bank.examBody} question bank`}>
                <header>
                  <h3>{bank.examBody}</h3>
                  <span className={`admin-bank-state${bank.questionCount === 0 ? ' is-empty' : bank.approvedCount === 0 ? ' is-review' : ' is-active'}`}>
                    {state}
                  </span>
                </header>
                <p className="admin-bank-count">
                  <strong>{bank.questionCount.toLocaleString()}</strong> question{bank.questionCount === 1 ? '' : 's'}
                </p>
                <dl className="admin-bank-facts">
                  <div><dt>Approved</dt><dd>{bank.approvedCount.toLocaleString()}</dd></div>
                  <div><dt>Awaiting review</dt><dd>{bank.needsReviewCount.toLocaleString()}</dd></div>
                  <div><dt>Subjects</dt><dd>{bank.subjectCount.toLocaleString()}</dd></div>
                  <div><dt>Years</dt><dd>{years || 'Not recorded'}</dd></div>
                  <div><dt>Last updated</dt><dd>{bank.lastUpdated ? <TimeAgo value={bank.lastUpdated} /> : 'No questions yet'}</dd></div>
                </dl>
                {subjects.length > 0 && (
                  <p className="admin-bank-subjects">
                    {subjects.join(' · ')}
                    {extraSubjects > 0 ? ` · +${extraSubjects} more` : ''}
                  </p>
                )}
                {bank.questionCount > 0 && bank.approvedCount === 0 && (
                  <p className="admin-footnote">None of these questions is approved, so the simulator will not use this bank.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
