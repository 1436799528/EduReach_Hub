/**
 * Date formatting for server responses, results and listings.
 *
 * All dates stored by the API are ISO-8601 strings. Formatting is fixed to
 * en-NG so the same value reads the same way on every page, regardless of the
 * device locale. Invalid or missing values return the caller's fallback
 * instead of "Invalid Date".
 */

const LONG_DATE = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatLongDate(value?: string | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : LONG_DATE.format(date);
}
