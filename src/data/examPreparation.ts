export type ExamSetupKey = 'jamb' | 'waec' | 'neco' | 'post-utme';

export type JambCourse = {
  name: string;
  department: 'Science' | 'Engineering' | 'Medicine & Health' | 'Arts & Humanities' | 'Social Science' | 'Commercial' | 'Education';
  subjects: string[];
};

/**
 * A transparent starting catalogue for the subject-combination wizard. JAMB
 * and institutions can change requirements, so the setup page always tells a
 * student to confirm the current brochure before registration.
 */
export const jambCourses: JambCourse[] = [
  { name: 'Medicine and Surgery', department: 'Medicine & Health', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Nursing Science', department: 'Medicine & Health', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Medical Laboratory Science', department: 'Medicine & Health', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Pharmacy', department: 'Medicine & Health', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Biochemistry', department: 'Science', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Microbiology', department: 'Science', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Physics', department: 'Science', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Chemistry', department: 'Science', subjects: ['Use of English', 'Mathematics', 'Chemistry', 'Physics'] },
  { name: 'Mathematics', department: 'Science', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Computer Science', department: 'Science', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Statistics', department: 'Science', subjects: ['Use of English', 'Mathematics', 'Physics', 'Economics'] },
  { name: 'Civil Engineering', department: 'Engineering', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Electrical / Electronics Engineering', department: 'Engineering', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Mechanical Engineering', department: 'Engineering', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Chemical Engineering', department: 'Engineering', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Architecture', department: 'Engineering', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { name: 'Accounting', department: 'Commercial', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
  { name: 'Business Administration', department: 'Commercial', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
  { name: 'Banking and Finance', department: 'Commercial', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
  { name: 'Marketing', department: 'Commercial', subjects: ['Use of English', 'Mathematics', 'Economics', 'Commerce'] },
  { name: 'Economics', department: 'Social Science', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
  { name: 'Political Science', department: 'Social Science', subjects: ['Use of English', 'Government', 'Economics', 'History'] },
  { name: 'Mass Communication', department: 'Social Science', subjects: ['Use of English', 'Literature in English', 'Government', 'Economics'] },
  { name: 'Psychology', department: 'Social Science', subjects: ['Use of English', 'Biology', 'Economics', 'Government'] },
  { name: 'Sociology', department: 'Social Science', subjects: ['Use of English', 'Government', 'Economics', 'Biology'] },
  { name: 'Law', department: 'Arts & Humanities', subjects: ['Use of English', 'Literature in English', 'Government', 'CRS / IRS'] },
  { name: 'English and Literary Studies', department: 'Arts & Humanities', subjects: ['Use of English', 'Literature in English', 'Government', 'CRS / IRS'] },
  { name: 'History and International Studies', department: 'Arts & Humanities', subjects: ['Use of English', 'History', 'Government', 'Literature in English'] },
  { name: 'Theatre and Film Studies', department: 'Arts & Humanities', subjects: ['Use of English', 'Literature in English', 'Government', 'CRS / IRS'] },
  { name: 'Education and Biology', department: 'Education', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { name: 'Education and English', department: 'Education', subjects: ['Use of English', 'Literature in English', 'Government', 'CRS / IRS'] },
  { name: 'Business Education', department: 'Education', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
];

export const jambDepartments = ['All departments', ...Array.from(new Set(jambCourses.map((course) => course.department)))];

/**
 * Subject choices shown in the JAMB setup dropdowns. The catalogue is a
 * practical starter set grouped by interest area; it is not a claim that every
 * institution accepts every combination. The setup page keeps the official
 * brochure reminder visible and lets a student choose a different subject when
 * their current course guide requires it.
 */
export const jambSubjectCatalog: Record<JambCourse['department'], string[]> = {
  Science: ['Use of English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Agricultural Science', 'Economics', 'Geography', 'Further Mathematics'],
  Engineering: ['Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Economics', 'Geography', 'Further Mathematics'],
  'Medicine & Health': ['Use of English', 'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Agricultural Science', 'Economics'],
  'Arts & Humanities': ['Use of English', 'Literature in English', 'Government', 'History', 'Economics', 'Geography', 'Christian Religious Studies', 'Islamic Religious Studies', 'CRS / IRS', 'French', 'Arabic'],
  'Social Science': ['Use of English', 'Mathematics', 'Economics', 'Government', 'Biology', 'Geography', 'History', 'Commerce', 'Literature in English'],
  Commercial: ['Use of English', 'Mathematics', 'Economics', 'Commerce', 'Financial Accounting', 'Government', 'Geography', 'Marketing', 'Business Studies'],
  Education: ['Use of English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Literature in English', 'Government', 'Economics', 'Agricultural Science', 'CRS / IRS'],
};

export type SecondarySubjectTrack = 'General' | 'Science' | 'Arts & Humanities' | 'Social Science' | 'Commercial' | 'Technical / Vocational';

/** Track filters are deliberately transparent and fall back to the maintained general catalogue. */
export const secondarySubjectTracks: SecondarySubjectTrack[] = ['General', 'Science', 'Arts & Humanities', 'Social Science', 'Commercial', 'Technical / Vocational'];

export const secondarySubjectCatalog: Record<SecondarySubjectTrack, string[]> = {
  General: [],
  Science: ['Use of English', 'Mathematics', 'Civic Education', 'Biology', 'Chemistry', 'Physics', 'Agricultural Science', 'Further Mathematics', 'Economics', 'Geography', 'Computer Studies', 'Data Processing'],
  'Arts & Humanities': ['Use of English', 'Mathematics', 'Civic Education', 'Literature in English', 'Government', 'History', 'Geography', 'Christian Religious Studies', 'Islamic Religious Studies', 'French', 'Arabic', 'Igbo', 'Hausa', 'Yoruba', 'Visual Art', 'Music'],
  'Social Science': ['Use of English', 'Mathematics', 'Civic Education', 'Economics', 'Government', 'Geography', 'History', 'Biology', 'Commerce', 'Financial Accounting', 'Marketing', 'Computer Studies'],
  Commercial: ['Use of English', 'Mathematics', 'Civic Education', 'Economics', 'Commerce', 'Financial Accounting', 'Marketing', 'Business Studies', 'Government', 'Data Processing', 'Computer Studies'],
  'Technical / Vocational': ['Use of English', 'Mathematics', 'Civic Education', 'Technical Drawing', 'Basic Electricity', 'Building Construction', 'Auto Mechanics', 'Dyeing and Bleaching', 'Leather Goods Manufacturing', 'Clothing and Textiles', 'Computer Studies', 'Data Processing'],
};

export const secondarySchoolSubjects = [
  'Use of English',
  'Mathematics',
  'Civic Education',
  'Biology',
  'Chemistry',
  'Physics',
  'Agricultural Science',
  'Further Mathematics',
  'Economics',
  'Government',
  'Commerce',
  'Financial Accounting',
  'Marketing',
  'Literature in English',
  'History',
  'Geography',
  'Christian Religious Studies',
  'Islamic Religious Studies',
  'Computer Studies',
  'Data Processing',
  'Technical Drawing',
  'Food and Nutrition',
  'Home Management',
  'Visual Art',
  'Music',
  'French',
  'Arabic',
  'Hausa',
  'Igbo',
  'Yoruba',
  'Business Studies',
  'Basic Electricity',
  'Building Construction',
  'Auto Mechanics',
  'Dyeing and Bleaching',
  'Leather Goods Manufacturing',
  'Clothing and Textiles',
];

export type PostUtmeSchool = {
  id: string;
  name: string;
  location: string;
  examLabel: string;
  subjects: string[];
  offersPostUtme: true;
};

/**
 * Schools in this starter catalogue are deliberately limited to institutions
 * with a Post-UTME practice profile. The list is an editable product data
 * source, not a claim that every school runs a screening exercise every year.
 */
export const postUtmeSchools: PostUtmeSchool[] = [
  { id: 'unilag', name: 'University of Lagos (UNILAG)', location: 'Lagos', examLabel: 'UNILAG Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Knowledge'], offersPostUtme: true },
  { id: 'ui', name: 'University of Ibadan (UI)', location: 'Oyo', examLabel: 'UI Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'oau', name: 'Obafemi Awolowo University (OAU)', location: 'Osun', examLabel: 'OAU Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'uniben', name: 'University of Benin (UNIBEN)', location: 'Edo', examLabel: 'UNIBEN Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'unn', name: 'University of Nigeria, Nsukka (UNN)', location: 'Enugu', examLabel: 'UNN Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'abu', name: 'Ahmadu Bello University (ABU)', location: 'Kaduna', examLabel: 'ABU Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'futa', name: 'Federal University of Technology, Akure (FUTA)', location: 'Ondo', examLabel: 'FUTA Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'], offersPostUtme: true },
  { id: 'lasu', name: 'Lagos State University (LASU)', location: 'Lagos', examLabel: 'LASU screening practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'unilorin', name: 'University of Ilorin (UNILORIN)', location: 'Kwara', examLabel: 'UNILORIN Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
  { id: 'delsu', name: 'Delta State University (DELSU)', location: 'Delta', examLabel: 'DELSU Post-UTME practice', subjects: ['Use of English', 'Mathematics', 'General Studies'], offersPostUtme: true },
];

export type PastQuestionRecord = {
  id: string;
  title: string;
  exam: 'JAMB' | 'WAEC' | 'NECO' | 'Post-UTME';
  school: string;
  year: string;
  subjects: string;
  description: string;
  href: string;
};

export const pastQuestionLibrary: PastQuestionRecord[] = [
  { id: 'jamb-utme-core', title: 'JAMB UTME Core Practice Bank', exam: 'JAMB', school: 'JAMB / UTME', year: 'Practice set', subjects: 'Use of English, Mathematics, Biology, Chemistry, Physics', description: 'Timed questions organised around common UTME subject combinations.', href: '/cbt/setup/jamb' },
  { id: 'waec-ssce-core', title: 'WAEC SSCE Revision Bank', exam: 'WAEC', school: 'WAEC', year: 'Practice set', subjects: 'English, Mathematics and elective subjects', description: 'Choose the nine subjects you are preparing before opening the practice hall.', href: '/cbt/setup/waec' },
  { id: 'neco-ssce-core', title: 'NECO SSCE Revision Bank', exam: 'NECO', school: 'NECO', year: 'Practice set', subjects: 'English, Mathematics and elective subjects', description: 'Build a nine-subject NECO practice plan and revise at your pace.', href: '/cbt/setup/neco' },
  ...postUtmeSchools.map((school) => ({
    id: `post-utme-${school.id}`,
    title: school.examLabel,
    exam: 'Post-UTME' as const,
    school: school.name,
    year: 'Practice set',
    subjects: school.subjects.join(', '),
    description: `School-focused aptitude practice for ${school.location} applicants.`,
    href: `/cbt/setup/post-utme?school=${school.id}`,
  })),
];

export type AdmissionMethodProfile = {
  id: string;
  school: string;
  method: string;
  explanation: string;
  formula: '50-50' | '60-40' | '70-30' | 'jamb-only' | 'points';
  officialReminder: string;
};

export const admissionMethodProfiles: AdmissionMethodProfile[] = [
  { id: 'unilag', school: 'University of Lagos (UNILAG)', method: 'Institution-published screening aggregate', explanation: 'Use the current UNILAG screening notice for its exact UTME, O-Level and screening inputs. This calculator provides a planning estimate only.', formula: '50-50', officialReminder: 'Confirm the current UNILAG admission and screening brochure before relying on a score.' },
  { id: 'ui', school: 'University of Ibadan (UI)', method: 'Post-UTME screening aggregate', explanation: 'UI applicants should follow the university screening notice and the course-specific requirements. Do not assume a generic 50/50 formula is official.', formula: '60-40', officialReminder: 'Check the current UI admission portal for the active session’s weighting and cut-offs.' },
  { id: 'oau', school: 'Obafemi Awolowo University (OAU)', method: 'UTME plus institution screening profile', explanation: 'OAU admission planning should combine the current UTME threshold, screening requirements and course competitiveness.', formula: '60-40', officialReminder: 'Verify OAU’s current screening instructions and departmental requirements.' },
  { id: 'abu', school: 'Ahmadu Bello University (ABU)', method: 'UTME / screening requirements', explanation: 'Use ABU’s active admission notice to confirm whether screening scores, O-Level points or other checks apply to your programme.', formula: '70-30', officialReminder: 'Confirm the current ABU admission guide before submitting an application.' },
  { id: 'lasu', school: 'Lagos State University (LASU)', method: 'Screening and aggregate planning', explanation: 'LASU requirements can vary by programme and admission cycle. Use this estimate to compare scenarios, not as an official score.', formula: '50-50', officialReminder: 'Confirm LASU’s current screening formula and programme cut-off.' },
  { id: 'custom', school: 'My school is not listed', method: 'Enter the published method', explanation: 'Select the closest planning model, then replace it with the weights and requirements in your institution’s current admission notice.', formula: '50-50', officialReminder: 'The institution’s official portal and brochure always take priority.' },
];

/**
 * Study-material records are honest route cards, never document claims.
 *
 * There are no third-party document links (Scribd was removed entirely on
 * 2026-09-27): each record either routes into the first-party CBT practice
 * (`cbtHref`) or into EduReach's own material-request channel. When an admin
 * publishes real question content in the CBT catalogue, students reach it
 * without leaving EduReach.
 */
export type StudyMaterialRecord = {
  id: string;
  title: string;
  exam: PastQuestionRecord['exam'];
  school: string;
  formats: string[];
  subjects: string;
  description: string;
  cbtHref?: string;
};

export const studyMaterialLibrary: StudyMaterialRecord[] = [
  {
    id: 'materials-jamb-utme',
    title: 'JAMB UTME Past Questions & Study Materials',
    exam: 'JAMB',
    school: 'JAMB / UTME',
    formats: ['PDF', 'DOC', 'Study materials'],
    subjects: 'Use of English, Mathematics, Biology, Chemistry and Physics',
    description: 'Timed JAMB practice is available now. Request document materials through EduReach while the library is being configured.',
    cbtHref: '/cbt/setup/jamb',
  },
  {
    id: 'materials-waec-ssce',
    title: 'WAEC SSCE Past Questions & Study Materials',
    exam: 'WAEC',
    school: 'WAEC',
    formats: ['PDF', 'DOC', 'Revision materials'],
    subjects: 'English, Mathematics and elective subjects',
    description: 'Timed practice is available now. Request document materials through EduReach while the library is being configured.',
    cbtHref: '/cbt/setup/waec',
  },
  {
    id: 'materials-neco-ssce',
    title: 'NECO SSCE Past Questions & Study Materials',
    exam: 'NECO',
    school: 'NECO',
    formats: ['PDF', 'DOC', 'Revision materials'],
    subjects: 'English, Mathematics and elective subjects',
    description: 'Timed practice is available now. Request document materials through EduReach while the library is being configured.',
    cbtHref: '/cbt/setup/neco',
  },
  ...postUtmeSchools.map((school) => ({
    id: `materials-${school.id}`,
    title: `${school.name} Past Questions & Materials`,
    exam: 'Post-UTME' as const,
    school: school.name,
    formats: ['PDF', 'DOC', 'School materials'],
    subjects: school.subjects.join(', '),
    description: `Timed practice is available now. Request ${school.name} document materials through EduReach and confirm the current school notice before relying on any paper.`,
    cbtHref: school.offersPostUtme ? `/cbt/setup/post-utme?school=${school.id}` : undefined,
  })),
];
