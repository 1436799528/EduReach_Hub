import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortState } from '../../lib/tableSort';

/**
 * A column header that cycles ascending → descending → server order.
 * The visible label stays the column name; the state is announced through the
 * button's accessible name and the parent th's aria-sort.
 */
export default function AdminSortButton({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  const active = sort.key === sortKey && sort.direction !== 'none';
  const direction = active ? sort.direction : 'none';
  const next = direction === 'ascending' ? 'descending' : direction === 'descending' ? 'unsorted' : 'ascending';
  const Icon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      className={`admin-sort-btn${active ? ' is-active' : ''}`}
      onClick={() => onSort(sortKey)}
      aria-label={`${label}, sort ${next} (this page)`}
    >
      <span>{label}</span>
      <Icon size={12} aria-hidden="true" />
    </button>
  );
}
