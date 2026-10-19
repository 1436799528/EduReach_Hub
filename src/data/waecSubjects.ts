export const WAEC_SUBJECT_GROUPS = ['Core Subjects', 'Science', 'Arts & Humanities', 'Commercial & Business', 'Trade & Vocational', 'Other'] as const;
export type WaecSubjectGroup = (typeof WAEC_SUBJECT_GROUPS)[number];
const TERMS: Record<Exclude<WaecSubjectGroup, 'Other'>, string[]> = {
  'Core Subjects': ['english', 'mathematics'],
  Science: ['biology','chemistry','physics','agricultural science','agriculture','further mathematics','geography','technical drawing','health education','physical education','foods and nutrition','food and nutrition','computer studies','data processing'],
  'Arts & Humanities': ['literature','government','history','christian religious studies','crs','islamic studies','irs','yoruba','igbo','hausa','french','arabic','visual art','music','home management','catering craft'],
  'Commercial & Business': ['financial accounting','accounting','commerce','economics','marketing'],
  'Trade & Vocational': ['fashion design','garment making','livestock farming','beauty','cosmetology','computer hardware','gsm repairs','solar photovoltaic','horticulture','crop production','auto mechanics','basic electricity','building construction'],
};
export function waecSubjectGroup(subject: string): WaecSubjectGroup {
  const value = String(subject || '').trim().toLowerCase();
  if (value.includes('literature')) return 'Arts & Humanities';
  for (const group of WAEC_SUBJECT_GROUPS) {
    if (group !== 'Other' && TERMS[group].some((term) => value.includes(term))) return group;
  }
  return 'Other';
}
export function isWaecEnglishSubject(subject: string): boolean {
  const value = String(subject || '').trim().toLowerCase();
  return value === 'english' || value === 'english language' || value === 'use of english';
}
