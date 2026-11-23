import { ChevronDown, LifeBuoy, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { FAQ_CATEGORIES, faqSearchText, type FaqCategory } from '../src/data/faq';
import { fetchFaqs } from '../src/lib/api';
import { matchesSearch } from '../src/lib/searchMatch';
import '../src/faq.css';

/**
 * Help centre, laid out the way most help centres are: topics down the left,
 * questions on the right.
 *
 * The topic list is a real navigation landmark and each entry is a real button
 * with `aria-current`, so a screen reader announces the selected topic rather
 * than a decorative pill. Picking a topic replaces the right column instead of
 * scrolling the reader past seven other topics; "All questions" keeps every
 * topic browsable, with compact headings and no descriptions repeated.
 *
 * The search narrows the questions and the per-topic counts at the same time,
 * so a student can see where the answer they typed actually lives.
 */

export default function FaqPage() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  // The shipped help content is the fallback while the API answers (and in a
  // preview with no database). Once it does, the administrator's categories and
  // questions replace it.
  const [categories, setCategories] = useState<FaqCategory[]>(FAQ_CATEGORIES);

  useEffect(() => {
    document.title = 'Help & FAQ | EduReach Hub';
  }, []);

  useEffect(() => {
    let active = true;
    void fetchFaqs()
      .then((rows) => {
        if (!active) return;
        const mapped: FaqCategory[] = rows
          .filter((row) => (row.questions?.length || 0) > 0)
          .map((row) => ({
            id: row.id,
            label: row.label,
            description: row.description,
            questions: (row.questions || []).map((question) => ({
              id: question.id,
              question: question.question,
              answer: question.answer,
            })),
          }));
        if (mapped.length) {
          setCategories(mapped);
          setCategory((current) => (current === 'all' || mapped.some((entry) => entry.id === current) ? current : 'all'));
        }
      })
      .catch(() => {
        // The static copy is already on screen; a failed refresh must not empty it.
      });
    return () => {
      active = false;
    };
  }, []);

  /** Matches per topic for the current search, used for the counts in the rail. */
  const matchesByTopic = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of categories) {
      counts.set(
        entry.id,
        entry.questions.filter((question) => matchesSearch([faqSearchText(entry, question)], query)).length,
      );
    }
    return counts;
  }, [categories, query]);

  const totalMatching = useMemo(
    () => [...matchesByTopic.values()].reduce((sum, count) => sum + count, 0),
    [matchesByTopic],
  );

  const visibleCategories = useMemo(() => {
    return categories
      .filter((entry) => category === 'all' || entry.id === category)
      .map((entry) => ({
        ...entry,
        questions: entry.questions.filter((question) => matchesSearch([faqSearchText(entry, question)], query)),
      }))
      .filter((entry) => entry.questions.length > 0);
  }, [category, query, categories]);

  const total = visibleCategories.reduce((sum, entry) => sum + entry.questions.length, 0);
  const showedDetailedIntro = category !== 'all';

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <HubLayout>
      <div className="hub-page er-comfort-page">
        <div className="hub-container">
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow">HELP CENTRE</span>
              <h1>Questions students ask most</h1>
              <p>
                Answers about your account, the CBT simulator, past questions, scholarships and payments. If the
                answer you need is not here, the contact page reaches a person.
              </p>
            </div>
            <a className="hub-outline-btn" href="/contact" style={{ textDecoration: 'none' }}>
              <LifeBuoy size={14} aria-hidden="true" /> Contact support
            </a>
          </div>

          <div className="er-faq-layout">
            <aside className="er-faq-aside">
              <label className="er-faq-search">
                <span>Search help</span>
                <span className="er-faq-search-field">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a question or a word"
                  />
                </span>
              </label>

              <nav className="er-faq-topics" aria-label="FAQ topics">
                <button
                  type="button"
                  className={`er-faq-topic${category === 'all' ? ' is-active' : ''}`}
                  aria-current={category === 'all' ? 'true' : undefined}
                  onClick={() => setCategory('all')}
                >
                  <span>All questions</span>
                  <span className="er-faq-topic-count">{totalMatching}</span>
                </button>
                {categories.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`er-faq-topic${category === entry.id ? ' is-active' : ''}`}
                    aria-current={category === entry.id ? 'true' : undefined}
                    onClick={() => setCategory(entry.id)}
                  >
                    <span>{entry.label}</span>
                    <span className="er-faq-topic-count">{matchesByTopic.get(entry.id) ?? 0}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <div className="er-faq-main">
              <p id="faq-result-count" className="er-faq-count" role="status" aria-live="polite">
                {total === 0
                  ? 'No questions match this search.'
                  : `${total} question${total === 1 ? '' : 's'} shown${query.trim() ? ` for “${query.trim()}”` : ''}.`}
              </p>

              {visibleCategories.length === 0 && (
                <div className="hub-panel hub-empty">
                  <h2>Nothing matches that search</h2>
                  <p>Try a shorter phrase, or clear the search to see every topic.</p>
                  <button type="button" className="hub-outline-btn" onClick={() => { setQuery(''); setCategory('all'); }}>
                    Clear search
                  </button>
                </div>
              )}

              {visibleCategories.map((entry) => (
                <section className="er-faq-group" key={entry.id} aria-labelledby={`faq-${entry.id}`}>
                  <header className="er-faq-group-head">
                    <h2 id={`faq-${entry.id}`}>{entry.label}</h2>
                    {showedDetailedIntro && entry.description && <p>{entry.description}</p>}
                  </header>
                  <div className="er-faq-list">
                    {entry.questions.map((question) => {
                      const expanded = open.has(question.id);
                      return (
                        <div className={`er-faq-item${expanded ? ' is-open' : ''}`} key={question.id}>
                          <h3 className="er-faq-question">
                            <button
                              type="button"
                              className="er-faq-trigger"
                              aria-expanded={expanded}
                              aria-controls={`faq-answer-${question.id}`}
                              id={`faq-trigger-${question.id}`}
                              onClick={() => toggle(question.id)}
                            >
                              <span>{question.question}</span>
                              <ChevronDown size={18} aria-hidden="true" className="er-faq-chevron" />
                            </button>
                          </h3>
                          <div
                            id={`faq-answer-${question.id}`}
                            role="region"
                            aria-labelledby={`faq-trigger-${question.id}`}
                            hidden={!expanded}
                            className="er-faq-answer"
                          >
                            <p>{question.answer}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              <aside className="er-faq-footer-card" aria-label="Still need help">
                <div>
                  <h2>Still stuck?</h2>
                  <p>
                    Send us the page you were on and what happened. Never send your password, a one-time code or a
                    full payment card number.
                  </p>
                </div>
                <a className="hub-primary-btn" href="/contact" style={{ textDecoration: 'none' }}>
                  Contact EduReach
                </a>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
