/**
 * Student-facing option catalogues.
 *
 * These are finite, editable lists. They keep common profile and
 * service fields predictable without pretending that EduReach has an exhaustive
 * catalogue of every Nigerian institution or programme.
 */
export const commonInstitutions = [
  'University of Lagos (UNILAG)',
  'University of Calabar (UNICAL)',
  'University of Nigeria, Nsukka (UNN)',
  'University of Ibadan (UI)',
  'Obafemi Awolowo University (OAU)',
  'Ahmadu Bello University (ABU)',
  'University of Benin (UNIBEN)',
  'University of Ilorin (UNILORIN)',
  'University of Port Harcourt (UNIPORT)',
  'University of Uyo (UNIUYO)',
  'Lagos State University (LASU)',
  'Federal University of Technology, Akure (FUTA)',
  'Federal University of Technology, Owerri (FUTO)',
  'Other Nigerian University / Polytechnic',
] as const;

export const faculties = [
  'Faculty of Science',
  'Faculty of Engineering & Technology',
  'Faculty of Clinical Sciences / Medicine',
  'Faculty of Law',
  'Faculty of Social Sciences',
  'Faculty of Arts & Humanities',
  'Faculty of Management / Business Administration',
  'Faculty of Environmental Sciences',
  'Faculty of Education',
  'Faculty of Agriculture',
  'Basic Medical Sciences',
  'Other Faculty / School',
] as const;

/** A maintained starter list; students can choose Other when their programme is not listed. */
export const courseProgrammes = [
  'Accounting',
  'Agricultural Science',
  'Architecture',
  'Banking and Finance',
  'Biochemistry',
  'Business Administration',
  'Business Education',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Science',
  'Economics',
  'Education and Biology',
  'Education and English',
  'Electrical / Electronics Engineering',
  'English and Literary Studies',
  'History and International Studies',
  'Law',
  'Marketing',
  'Mass Communication',
  'Mathematics',
  'Mechanical Engineering',
  'Medical Laboratory Science',
  'Medicine and Surgery',
  'Microbiology',
  'Nursing Science',
  'Pharmacy',
  'Physics',
  'Political Science',
  'Psychology',
  'Sociology',
  'Statistics',
  'Theatre and Film Studies',
  'Other programme',
] as const;

export const departments = [
  'Accounting',
  'Agricultural Science',
  'Architecture',
  'Banking and Finance',
  'Biochemistry',
  'Business Administration',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Science',
  'Economics',
  'Electrical / Electronics Engineering',
  'English and Literary Studies',
  'Estate Management',
  'Fisheries / Aquaculture',
  'Food Science and Technology',
  'History and International Studies',
  'Law',
  'Mass Communication',
  'Mathematics',
  'Mechanical Engineering',
  'Medical Laboratory Science',
  'Medicine and Surgery',
  'Microbiology',
  'Nursing Science',
  'Pharmacy',
  'Physics',
  'Political Science',
  'Psychology',
  'Public Administration',
  'Quantity Surveying',
  'Sociology',
  'Statistics',
  'Theatre and Film Studies',
  'Other department',
] as const;

export const levels = [
  '100 Level (Freshman)',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level (Final Year)',
  'Post-Graduate (Masters / PhD)',
  'JAMB Aspirant / Pre-Degree',
] as const;

export const academicSessions = [
  '2026/2027',
  '2025/2026',
  '2024/2025',
  '2023/2024',
  'Other session',
] as const;

export const academicYears = Array.from({ length: 21 }, (_, index) => String(2015 + index));

/**
 * Limited, editable search tags for the starter school directory. These are
 * discovery hints, not an exhaustive programme or admissions catalogue.
 */
export const institutionCourseContexts: Record<string, string> = {
  UNILAG: 'accounting architecture business administration computer science economics engineering law mass communication medicine nursing pharmacy',
  UNICAL: 'accounting computer science education engineering law medicine nursing social sciences',
  UNN: 'agriculture computer science engineering law medicine pharmacy social sciences',
  UI: 'agriculture computer science education law medicine pharmacy psychology social sciences',
  OAU: 'accounting architecture computer science engineering law medicine nursing pharmacy',
  ABU: 'agriculture accounting computer science engineering law medicine pharmacy education',
  UNIBEN: 'accounting architecture computer science engineering law medicine nursing pharmacy',
  UNILORIN: 'accounting agriculture computer science education engineering law medicine nursing pharmacy',
  UNIPORT: 'accounting agriculture computer science engineering law medicine nursing pharmacy',
  UNIUYO: 'accounting education engineering law medicine nursing pharmacy computer science',
  LASU: 'accounting business administration computer science education engineering law medicine mass communication',
  FUTA: 'architecture computer science engineering information technology statistics',
  FUTO: 'architecture computer science engineering information technology statistics',
};

export type StudentOption = (typeof commonInstitutions)[number];

/**
 * UX-3 — legacy profile values.
 *
 * Earlier profile forms stored short faculty and level labels ("Science",
 * "300"). The current selects use the long catalogue labels. A legacy value
 * that is not in the option list makes the browser render an empty select and
 * silently block native form validation, so Save appears to do nothing.
 *
 * These helpers keep the stored value visible and map the common legacy labels
 * to their current name. Unknown values are returned unchanged; the caller adds
 * them to the option list so nothing is lost or invented.
 */
const facultyAliases: Record<string, string> = {
  science: 'Faculty of Science',
  engineering: 'Faculty of Engineering & Technology',
  'engineering & technology': 'Faculty of Engineering & Technology',
  medicine: 'Faculty of Clinical Sciences / Medicine',
  'clinical sciences': 'Faculty of Clinical Sciences / Medicine',
  law: 'Faculty of Law',
  'social sciences': 'Faculty of Social Sciences',
  arts: 'Faculty of Arts & Humanities',
  humanities: 'Faculty of Arts & Humanities',
  'business administration': 'Faculty of Management / Business Administration',
  management: 'Faculty of Management / Business Administration',
  'environmental sciences': 'Faculty of Environmental Sciences',
  education: 'Faculty of Education',
  agriculture: 'Faculty of Agriculture',
  'basic medical sciences': 'Basic Medical Sciences',
};

const levelAliases: Record<string, string> = {
  '100': '100 Level (Freshman)',
  '200': '200 Level',
  '300': '300 Level',
  '400': '400 Level',
  '500': '500 Level (Final Year)',
  'postgraduate': 'Post-Graduate (Masters / PhD)',
  'post-graduate': 'Post-Graduate (Masters / PhD)',
  'jamb': 'JAMB Aspirant / Pre-Degree',
  'aspirant': 'JAMB Aspirant / Pre-Degree',
};

export function normalizeFacultyValue(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if ((faculties as readonly string[]).includes(raw)) return raw;
  return facultyAliases[raw.toLowerCase()] || raw;
}

export function normalizeLevelValue(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if ((levels as readonly string[]).includes(raw)) return raw;
  return levelAliases[raw.toLowerCase()] || raw;
}

/** Keep a saved legacy value selectable instead of rendering a blank select. */
export function optionsIncludingSaved<T extends string>(options: readonly T[], saved: string): string[] {
  if (!saved || (options as readonly string[]).includes(saved)) return [...options];
  return [saved, ...options];
}
