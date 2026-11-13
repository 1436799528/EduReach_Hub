import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import { trackEvent } from '../src/lib/api';
import { filterSearchItems } from '../src/lib/searchMatch';
import { loadSiteSearchCatalog, type SiteSearchCatalog } from '../src/lib/siteSearch';
import SiteSearch from '../src/components/LazySiteSearch';

function readQuery() {
  return new URLSearchParams(window.location.search).get('q')?.trim() || '';
}

export default function SearchPage() {
  const lastSearchTrackedRef = useRef('');
  // What the debounced tracker reports as the outcome of the search. A ref, not
  // state, so the timeout effect does not re-run on every result update.
  const resultCountRef = useRef(0);
  const [query, setQuery] = useState(readQuery);
  const [catalog, setCatalog] = useState<SiteSearchCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term || term === lastSearchTrackedRef.current) return;
    const timer = window.setTimeout(() => {
      lastSearchTrackedRef.current = term;
      // AN-1: the term itself is never sent - a search box is where a student
      // writes their name and their problem. Shape and outcome only.
      trackEvent('search', { metadata: { query_length: term.length, result_count: resultCountRef.current } });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    void loadSiteSearchCatalog()
      .then((result) => { if (active) setCatalog(result); })
      .catch(() => { if (active) setCatalogError(true); });
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    return filterSearchItems(catalog?.items || [], query, query.trim() ? 40 : 12);
  }, [catalog, query]);

  useEffect(() => {
    resultCountRef.current = results.length;
  }, [results]);

  useEffect(() => {
    const syncFromUrl = () => setQuery(readQuery());
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '24px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '940px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#b14933' }}>EDUREACH SEARCH</span>
              <h1>{query ? `Search results for “${query}”` : 'Search EduReach'}</h1>
              <p>Find a direct destination across services, CBT, past questions, materials, news and opportunities.</p>
            </div>
          </div>

          <SiteSearch
            variant="page"
            initialQuery={query}
            items={catalog?.items || []}
            suggestionsLoading={!catalog && !catalogError}
            suggestionsError={catalogError || Boolean(catalog?.partialFailure)}
            onQueryChange={setQuery}
            autoFocus
          />

          {!query.trim() && <p className="er-search-help">Start typing to search the configured catalogue. Results are direct links; no extra intermediary page is inserted.</p>}
          {!results.length && catalog && (
            <div className="hub-panel hub-empty">
              <h2>Nothing on EduReach matches “{query.trim()}”</h2>
              <p>
                Nothing matched. Try JAMB, WAEC, NELFUND, a service name, a school name or
                “materials”, or ask us and we will point you at the right page.
              </p>
              <a
                className="hub-primary-btn"
                href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent(`Hello EduReach, I could not find anything for "${query.trim()}" on the site. Can you point me to it?`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ask EduReach <ArrowRight size={13} />
              </a>
            </div>
          )}
          {!catalog && query.trim() && !catalogError && !results.length && <div className="hub-panel hub-empty" role="status">Checking searchable content…</div>}
          {catalogError && (
            <div className="er-search-help er-search-partial" role="alert">
              Searchable content could not be loaded. Please try again or use the site navigation.
            </div>
          )}
          {catalog?.partialFailure && (
            <p className="er-search-help er-search-partial" role="status">
              Some live results could not be loaded (news, opportunities or CBT banks), so this list may be
              incomplete. The catalogue results below are current; reload to try the live sources again.
            </p>
          )}

          <div className="er-search-results" aria-live="polite">
            {results.map((result) => (
              <a className={`er-search-result ${identityClassFor(result.identity, 'content')}`} href={result.href} key={result.id}>
                <CardIdentityMark value={result.identity} type="content" size="sm" />
                <span className="er-search-result-copy">
                  <small>{result.category}</small>
                  <strong>{result.title}</strong>
                  <span>{result.description}</span>
                </span>
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
