import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { userFacingError } from '../../lib/errors';
import { fetchFaqs, type PublicFaqCategory } from '../lib/api';
import SectionHead from './SectionHead';
import '../home-engagement.css';
import { EmptyState, ErrorState } from './AsyncState';
import { SkeletonRows } from './Skeleton';

/**
 * Homepage FAQ: one category at a time in the help centre's own accordion
 * pattern. The questions come from the database, so an answered edit in the
 * console is the version a visitor reads.
 */
export default function HomeFaqSection() {
  const [categories, setCategories] = useState<PublicFaqCategory[]>([]);
  const [activeId, setActiveId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchFaqs()
      .then((rows) => {
        if (!active) return;
        const usable = rows.filter((category) => (category.questions?.length || 0) > 0);
        setCategories(usable);
        setActiveId((current) => (usable.some((row) => row.id === current) ? current : usable[0]?.id || ''));
      })
      .catch((value) => {
        if (active) setError(userFacingError(value, 'Unable to load the FAQs.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const active = useMemo(
    () => categories.find((category) => category.id === activeId) || categories[0],
    [categories, activeId],
  );

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="er-section er-home-faq" id="faqs" aria-label="Frequently asked questions">
      <SectionHead title="Frequently asked questions" href="/faq" linkLabel="Full help centre" />
      <div className="er-home-section-heading">
      </div>
      <div className="er-late-region er-late-region--feed">
        {loading && <SkeletonRows rows={2} label="Loading frequently asked questions" />}
        {!loading && error && <ErrorState error={error} onRetry={() => setRetry((value) => value + 1)} />}
        {!loading && !error && categories.length === 0 && (
          <EmptyState
            title="No FAQs published yet"
            detail="Published questions will appear here. Administrators can add them from FAQ Management."
            action={
              <a className="hub-outline-btn" href="/faq">
                Open the help centre
              </a>
            }
          />
        )}
        {!loading && !error && active && (
          <div className="er-faq-group er-home-faq-group">
            <div className="er-home-faq-tabs" role="group" aria-label="FAQ categories">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={category.id === active.id}
                  className={`er-home-faq-tab${category.id === active.id ? ' is-active' : ''}`}
                  onClick={() => setActiveId(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="er-faq-list" role="region" aria-label={`${active.label} questions`}>
              {(active.questions || []).map((question) => {
                const open = expanded.has(question.id);
                return (
                  <div className={`er-faq-item${open ? ' is-open' : ''}`} key={question.id}>
                    <h3 className="er-faq-question">
                      <button
                        type="button"
                        className="er-faq-trigger"
                        aria-expanded={open}
                        aria-controls={`er-home-faq-answer-${question.id}`}
                        id={`er-home-faq-trigger-${question.id}`}
                        onClick={() => toggle(question.id)}
                      >
                        <span>{question.question}</span>
                        <ChevronDown size={18} aria-hidden="true" className="er-faq-chevron" />
                      </button>
                    </h3>
                    <div
                      id={`er-home-faq-answer-${question.id}`}
                      role="region"
                      aria-labelledby={`er-home-faq-trigger-${question.id}`}
                      hidden={!open}
                      className="er-faq-answer"
                    >
                      <p>{question.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
