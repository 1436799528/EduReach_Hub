export type SortDirection = 'ascending' | 'descending' | 'none';

export type SortState = {
  key: string;
  direction: SortDirection;
};

export const NO_SORT: SortState = { key: '', direction: 'none' };

/**
 * Tri-state sort for one client-side page of an admin table.
 *
 * ascending → descending → none. "None" restores the server's order exactly,
 * which is the only order that is meaningful across pages; the control says
 * "this page" so nobody mistakes it for a global sort.
 */
export function nextSortState(current: SortState, key: string): SortState {
  if (current.key !== key) return { key, direction: 'ascending' };
  if (current.direction === 'ascending') return { key, direction: 'descending' };
  if (current.direction === 'descending') return { key, direction: 'none' };
  return { key, direction: 'ascending' };
}

export function ariaSortFor(state: SortState, key: string): 'ascending' | 'descending' | 'none' {
  return state.key === key && state.direction !== 'none' ? state.direction : 'none';
}

type Comparable = string | number | boolean | null | undefined;

export function sortRows<T>(
  rows: T[],
  state: SortState,
  read: (row: T, key: string) => Comparable,
): T[] {
  if (!state.key || state.direction === 'none') return rows;
  const collator = new Intl.Collator('en-NG', { numeric: true, sensitivity: 'base' });
  const direction = state.direction === 'ascending' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = read(left.row, state.key);
      const b = read(right.row, state.key);
      // Empty values are missing data, not the smallest string: keep them at
      // the end in both directions so "no publication date" never tops a list.
      const aEmpty = a === null || a === undefined || a === '';
      const bEmpty = b === null || b === undefined || b === '';
      if (aEmpty && bEmpty) return left.index - right.index;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      const compared = collator.compare(String(a), String(b));
      return compared === 0 ? left.index - right.index : compared * direction;
    })
    .map((entry) => entry.row);
}
