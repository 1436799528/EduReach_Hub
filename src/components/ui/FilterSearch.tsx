import { Search, X } from 'lucide-react';
import { useId, type FormEvent, type ReactNode } from 'react';

/**
 * UI-5 — the one page-level search field.
 *
 * The site search (`SiteSearch`) is the canonical *navigation* search: it
 * suggests destinations and goes to `/search`. This is its quieter sibling for
 * filtering the list a student is already looking at (news, papers, the school
 * finder). Both share the same visual contract — white surface, neutral border,
 * grey text, one neutral icon, a subtle focus ring — so a search box looks like
 * a search box everywhere without turning into a call to action.
 *
 * It is a `<form role="search">` rather than a `<label>` wrapper, because the
 * clear button must not be inside the element that labels the input.
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
  children,
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
  /** Optional suggestion popover, positioned by the caller's wrapper. */
  children?: ReactNode;
}) {
  const inputId = `er-filter-search-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(value.trim());
  }

  return (
    <form
      className="er-filter-search"
      role="search"
      aria-label={label}
      onSubmit={submit}
      style={maxWidth ? { maxWidth } : undefined}
    >
      <Search size={16} aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          className="er-filter-search-clear"
          aria-label={clearLabel || `Clear ${label.toLowerCase()}`}
          onClick={() => onChange('')}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {children}
    </form>
  );
}
