import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { navigateInApp } from '../lib/navigation';
import { filterSearchItems } from '../lib/searchMatch';
import type { SiteSearchItem } from '../lib/siteSearch';

export type SiteSearchProps = {
  variant?: 'header' | 'drawer' | 'home' | 'dashboard' | 'page';
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  initialQuery?: string;
  items?: SiteSearchItem[];
  suggestionsLoading?: boolean;
  suggestionsError?: boolean;
  onQueryChange?: (query: string) => void;
  onNavigate?: () => void;
  autoFocus?: boolean;
};

export default function SiteSearch({
  variant = 'header',
  label = 'Search EduReach',
  placeholder = 'Search EduReach',
  submitLabel = 'Search',
  initialQuery = '',
  items: providedItems,
  suggestionsLoading = false,
  suggestionsError = false,
  onQueryChange,
  onNavigate,
  autoFocus = false,
}: SiteSearchProps) {
  const generatedId = useId();
  const listId = `site-search-options-${generatedId}`;
  const rootRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [catalog, setCatalog] = useState<SiteSearchItem[]>(providedItems || []);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const catalogRequested = useRef(false);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (providedItems) setCatalog(providedItems);
  }, [providedItems]);

  async function loadCatalog() {
    if (providedItems || catalogRequested.current) return;
    catalogRequested.current = true;
    setCatalogLoading(true);
    try {
      const { loadSiteSearchCatalog } = await import('../lib/siteSearch');
      const result = await loadSiteSearchCatalog();
      setCatalog(result.items);
      setCatalogFailed(result.partialFailure);
    } catch {
      catalogRequested.current = false;
      setCatalogFailed(true);
    } finally {
      setCatalogLoading(false);
    }
  }

  const visibleItems = filterSearchItems(catalog, query, 6);
  const isLoading = suggestionsLoading || catalogLoading;
  const hasPartialFailure = suggestionsError || catalogFailed;
  const suggestionsEnabled = variant !== 'page';
  const suggestionsOpen = suggestionsEnabled && open && query.trim().length > 0;

  function updateQuery(value: string) {
    setQuery(value);
    onQueryChange?.(value);
    setActiveIndex(-1);
    setOpen(true);
    if (value.trim()) void loadCatalog();
  }

  function goToSearch(value: string) {
    const normalized = value.trim();
    navigateInApp(normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search');
    setOpen(false);
    setActiveIndex(-1);
    onNavigate?.();
  }

  function selectSuggestion(item: SiteSearchItem) {
    navigateInApp(item.href);
    setOpen(false);
    onNavigate?.();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (suggestionsEnabled && activeIndex >= 0 && visibleItems[activeIndex]) {
      selectSuggestion(visibleItems[activeIndex]);
      return;
    }
    goToSearch(query);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsEnabled) return;
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!direction || !visibleItems.length) return;
    event.preventDefault();
    setOpen(true);
    setActiveIndex((index) => (index + direction + visibleItems.length) % visibleItems.length);
  }

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  return (
    <form
      ref={rootRef}
      className={`site-search site-search--${variant}`}
      role="search"
      aria-label={label}
      onSubmit={submit}
    >
      <input
        type="search"
        role={suggestionsEnabled ? 'combobox' : undefined}
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        onFocus={() => { setOpen(true); if (query.trim()) void loadCatalog(); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={label}
        aria-autocomplete={suggestionsEnabled ? 'list' : undefined}
        aria-expanded={suggestionsEnabled ? suggestionsOpen : undefined}
        aria-controls={suggestionsOpen ? listId : undefined}
        aria-activedescendant={suggestionsOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      <button type="submit">{submitLabel}</button>
      {suggestionsOpen && (
        <div className="site-search-popover">
          {isLoading && !visibleItems.length ? (
            <p className="site-search-message" role="status">Finding destinations…</p>
          ) : visibleItems.length ? (
            <>
              <ul id={listId} className="site-search-list" role="listbox" aria-label="Search suggestions">
                {visibleItems.map((item, index) => (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${index}`}
                      className={index === activeIndex ? 'is-active' : undefined}
                      role="option"
                      aria-selected={index === activeIndex}
                      onClick={() => selectSuggestion(item)}
                    >
                      <span><small>{item.category}</small><strong>{item.title}</strong></span>
                    </button>
                  </li>
                ))}
              </ul>
              {hasPartialFailure && <p className="site-search-message" role="status">Some live suggestions may be missing. Search the full catalogue instead.</p>}
            </>
          ) : (
            <p className="site-search-message" role="status">{hasPartialFailure ? 'Live suggestions are unavailable. Press Enter to search the catalogue.' : 'No suggestions yet. Press Enter to search the catalogue.'}</p>
          )}
        </div>
      )}
    </form>
  );
}
