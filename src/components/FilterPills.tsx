export type FilterPillOption = { id: string; label: string };

/** Shared category filter pills in EduReach theme. */
export default function FilterPills({
  options,
  active,
  onChange,
  ariaLabel = 'Filter',
}: {
  options: FilterPillOption[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="er-pills" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={active === option.id ? 'er-pill active' : 'er-pill'}
          aria-pressed={active === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
