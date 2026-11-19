import FilterSearch from '../ui/FilterSearch';
import type { SearchSuggestion } from '../../lib/searchMatch';

/**
 * The admin console's page-filter search. It keeps the dark console geometry
 * while inheriting the public site's accessible, substring-anywhere suggestion
 * contract. Callers pass the full row list currently shown on the page.
 */
export default function AdminFilterSearch({
  value,
  onChange,
  label,
  placeholder,
  items,
  suggestionLabel,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  items: readonly SearchSuggestion[];
  suggestionLabel: string;
  onSubmit?: (value: string) => void;
}) {
  return (
    <FilterSearch
      className="admin-filter-search"
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      clearLabel={`Clear ${label.toLowerCase()}`}
      suggestionItems={items}
      suggestionLimit={8}
      suggestionLabel={suggestionLabel}
      onSubmit={onSubmit}
    />
  );
}
