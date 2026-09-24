/**
 * Student-facing option catalogues.
 *
 * These are intentionally finite, editable lists. They keep common profile and
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

export type StudentOption = (typeof commonInstitutions)[number];
