import { ChevronDown, LifeBuoy, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import FilterPills from '../src/components/FilterPills';
import { FAQ_CATEGORIES, faqSearchText } from '../src/data/faq';
import { matchesSearch } from '../src/lib/searchMatch';
import '../src/faq.css';

/**
 * Help centre.
 *
 * Grouped accordions rather than one long document: a student arrives with one
 * question, and scanning eight screens of prose to find it is a second problem.
 * The control is a real button inside a real heading, so a screen reader
 * announces "How do I reset my password?, button, collapsed", and the answer
 * region is labelled by that button. The search narrows both the questions and
 * the visible categories.
 */

const CATEGORY_PILLS = [
  { id: 'all', label: 'All topics' },
  ...FAQ_CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
];

export default function FaqPage() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    document.title = 'Help & FAQ | EduReach Hub';
  }, []);

  const visibleCategories = useMemo(() => {
    return FAQ_CATEGORIES
      .filter((entry) => category === 'all' || entry.id === category)
      .map((entry) => ({
        ...entry,
        questions: entry.questions.filter((question) => matchesSearch([faqSearchText(entry, question)], query)),
      }))
      .filter((entry) => entry.questions.length > 0);
  }, [category, query]);

  const total = visibleCategories.reduce((sum, entry) => sum + entry.questions.length, 0);

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
        <div className="hub-container hub-narrow">
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

          <div className="er-faq-toolbar">
            <label className="er-faq-search">
              <span>Search help</span>
              <span className="er-faq-search-field">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a question or a word"
                  aria-describedby="faq-result-count"
                />
              </span>
            </label>
            <FilterPills
              options={CATEGORY_PILLS}
              active={category}
              onChange={setCategory}
              ariaLabel="Filter help by topic"
            />
          </div>

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
                <p>{entry.description}</p>
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
    </HubLayout>
  );
}
