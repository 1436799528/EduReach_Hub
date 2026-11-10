// Parameters for the existing exam-scoped staff question list. All filtering
// happens in PostgREST before the bounded page is returned to the browser.
export type QuestionBankFilters = {
  page: number;
  pageSize: number;
  search: string;
  subject: string;
  topic: string;
  year: number | null;
  review: '' | 'needs_review' | 'approved' | 'rejected';
};

export function parseQuestionBankFilters(query: Record<string, unknown>): QuestionBankFilters {
  const read = (name: string, fallback = ''): string => {
    const value = query[name];
    if (value === undefined) return fallback;
    if (typeof value !== 'string') throw new Error('Invalid question filter.');
    return value.trim();
  };
  const pageText = read('page', '1');
  const sizeText = read('pageSize', '50');
  if (!/^\d+$/.test(pageText) || !/^\d+$/.test(sizeText)) throw new Error('Invalid pagination.');
  const page = Number(pageText);
  const pageSize = Number(sizeText);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger(page * pageSize)) throw new Error('Invalid pagination.');
  const search = read('search');
  const subject = read('subject');
  const topic = read('topic');
  if ([search, subject, topic].some(value => value.length > 120)) throw new Error('Question filter is too long.');
  const yearText = read('year');
  const year = yearText ? Number(yearText) : null;
  if (yearText && (!/^\d{4}$/.test(yearText) || year === null || year < 1954 || year > 2100)) throw new Error('Invalid source year.');
  const review = read('review');
  if (!['', 'needs_review', 'approved', 'rejected'].includes(review)) throw new Error('Invalid review status.');
  return { page, pageSize, search, subject, topic, year, review: review as QuestionBankFilters['review'] };
}

export function literalLike(value: string): string {
  return `%${value.replace(/[\\%_*]/g, '\\$&')}%`;
}

export function isQuestionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
