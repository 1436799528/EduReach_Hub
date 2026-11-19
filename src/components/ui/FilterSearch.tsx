import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { filterSearchSuggestions, highlightSegments, type SearchSuggestion } from '../../lib/searchMatch';

/**
 * UI-5 / SEARCH-2 — the one page-level search field.
 *
 * The site search (`SiteSearch`) is the canonical *navigation* search. This is
 * its quieter sibling for filtering the list a student is already looking at.
 * Every instance now carries the same suggestion contract: all records visible
 * to the page are searchable by any word, at the start, middle or end of a
 * field, in any order. Suggestions are a real listbox with keyboard controls,
 * not a decorative dropdown. Callers pass the page's own content; the field
 * never invents a destination.
 */
export default function FilterSearch({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
  onSubmit,
  autoFocus = false,
  maxWidth,
  className,
  suggestionItems = [],
  suggestionLimit = 6,
  suggestionLabel = 'Suggestions',
}: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the field. Visible context may already say the same. */
  label: string;
  placeholder?: string;
  clearLabel?: string;
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
  maxWidth?: number | string;
  className?: string;
  /** Everything on this page that a typed word should be able to suggest. */
  suggestionItems?: readonly SearchSuggestion[];
  suggestionLimit?: number;
  suggestionLabel?: string;
}) {
  const inputId = `er-filter-search-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const listId = `er-filter-suggestions-${inputId}`;
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const visibleSuggestions = filterSearchSuggestions(suggestionItems, value, suggestionLimit);
  const suggestionsOpen = open && Boolean(value.trim());
  const activeDescendant = suggestionsOpen && activeIndex >= 0 && visibleSuggestions[activeIndex]
    ? `${listId}-${activeIndex}`
    : undefined;

  function updateValue(next: string) {
    onChange(next);
    setActiveIndex(-1);
    setOpen(Boolean(next.trim()));
  }

  function clearValue() {
    onChange('');
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  }

  function selectSuggestion(item: SearchSuggestion) {
    onChange(item.title);
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (suggestionsOpen && activeIndex >= 0 && visibleSuggestions[activeIndex]) {
      selectSuggestion(visibleSuggestions[activeIndex]);
      return;
    }
    onSubmit?.(value.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen) return;
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!direction || !visibleSuggestions.length) return;
    event.preventDefault();
    setOpen(true);
    setActiveIndex((index) => (index + direction + visibleSuggestions.length) % visibleSuggestions.length);
  }

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  return (
    <form
      ref={rootRef}
      className={`er-filter-search${className ? ` ${className}` : ''}`}
      role="search"
      aria-label={label}
      onSubmit={submit}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={suggestionsOpen}
        aria-controls={suggestionsOpen ? listId : undefined}
        aria-activedescendant={activeDescendant}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          className="er-filter-search-clear"
          aria-label={clearLabel || `Clear ${label.toLowerCase()}`}
          onClick={clearValue}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {suggestionsOpen && (
        <div className="er-filter-suggestions">
          {visibleSuggestions.length > 0 ? (
            <ul id={listId} className="er-filter-suggestion-list" role="listbox" aria-label={suggestionLabel}>
              {visibleSuggestions.map((item, index) => (
                <li key={item.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? 'is-active' : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(item)}
                  >
                    <span>
                      {item.category && <small>{item.category}</small>}
                      <strong>
                        {highlightSegments(item.title, value).map((segment, segmentIndex) =>
                          segment.match
                            ? <mark key={segmentIndex}>{segment.text}</mark>
                            : <span key={segmentIndex}>{segment.text}</span>
                        )}
                      </strong>
                      {item.description && <em>{item.description}</em>}
                    </span>
                    <span aria-hidden="true">↵</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="er-filter-suggestion-empty" role="status">
              No matching {suggestionLabel.toLowerCase()} on this page. Try another word.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
