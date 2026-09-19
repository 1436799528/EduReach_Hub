export type CardIdentity = {
  label: string;
  secondary?: string;
  kind: 'wordmark' | 'icon';
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate';
  imageUrls?: string[];
  accentIcon?:
    | 'monitor'
    | 'graduation'
    | 'file'
    | 'check'
    | 'award';
  icon?:
    | 'banknote'
    | 'book'
    | 'bookCheck'
    | 'brain'
    | 'briefcase'
    | 'calendar'
    | 'card'
    | 'calculator'
    | 'help'
    | 'file'
    | 'fileQuestion'
    | 'fileCheck'
    | 'monitor'
    | 'news'
    | 'printer'
    | 'user'
    | 'wallet'
    | 'receipt'
    | 'graduation'
    | 'clipboard'
    | 'award'
    | 'check'
    | 'headset'
    | 'bell'
    | 'settings'
    | 'search'
    | 'school'
    | 'dashboard';
  ariaLabel: string;
};

/**
 * Visual identity is data, not photography.
 * Keep service identity here so the same recognizable mark is reused on
 * cards, lists, side rails, CBT, news, dashboard and future screens.
 */
// Use recognizable examination/service identities rather than generic coloured card icons.
// JAMB and WAEC URLs are served by their official portals; NELFUND and the neutral
// study/CBT marks use stable Wikimedia-hosted assets.
const JAMB_LOGO_URL = 'https://centres.jamb.gov.ng/assets/images/icon/jamblogo.png';
const WAEC_LOGO_URL = 'https://examiners.waecnigeria.org/seapdc/images/bgLogo.png';
const NECO_LOGO_URL = 'https://raw.githubusercontent.com/Drslope-99/gradeup/edb86d539020b90996899b00721237350717d7d7/public/images/neco.png';
const NELFUND_LOGO_URL = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nigerian_Education_Loan_Fund_%28NELFUND%29.png';
const NABTEB_LOGO_URL = 'https://nabteb.gov.ng/wp-content/uploads/2021/09/logo.png';
const NYSC_LOGO_URL = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/NYSC_LOGO.svg';
const FME_LOGO_URL = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Federal_Ministry_of_Education_Logo.jpg';

export const serviceVisuals: Record<string, CardIdentity> = {
  'nelfund-loan': {
    label: 'NELFUND',
    imageUrls: [NELFUND_LOGO_URL],
    secondary: 'LOAN',
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'NELFUND student loan application',
  },
  results: {
    label: 'WAEC',
    secondary: 'NECO',
    imageUrls: [WAEC_LOGO_URL, NECO_LOGO_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'WAEC and NECO result checking',
  },
  'scratch-cards': {
    label: 'WAEC',
    secondary: 'NECO PIN',
    imageUrls: [WAEC_LOGO_URL, NECO_LOGO_URL],
    kind: 'wordmark',
    tone: 'amber',
    ariaLabel: 'WAEC and NECO scratch cards',
  },
  'jamb-slip': {
    label: 'JAMB',
    secondary: 'SLIP',
    imageUrls: [JAMB_LOGO_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB examination slip printing',
  },
  'admission-letters': {
    label: 'ADM',
    kind: 'icon',
    icon: 'file',
    tone: 'purple',
    ariaLabel: 'Admission deferment and supplementary letters',
  },
  cbt: {
    label: 'CBT',
    secondary: 'PRACTICE',
    kind: 'icon',
    icon: 'monitor',
    tone: 'blue',
    ariaLabel: 'Computer based test practice',
  },
  'jamb-cbt': {
    label: 'JAMB',
    secondary: 'CBT',
    imageUrls: [JAMB_LOGO_URL],
    accentIcon: 'monitor',
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB computer based test',
  },
  'post-utme': {
    label: 'JAMB',
    secondary: 'POST-UTME',
    imageUrls: [JAMB_LOGO_URL],
    accentIcon: 'graduation',
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'Post UTME and admission examination',
  },
  nabteb: {
    label: 'NABTEB',
    secondary: 'EXAM',
    imageUrls: [NABTEB_LOGO_URL],
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'NABTEB examination services',
  },
  nysc: {
    label: 'NYSC',
    secondary: 'SERVICE',
    imageUrls: [NYSC_LOGO_URL],
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'NYSC services',
  },
  'education-ministry': {
    label: 'FME',
    secondary: 'EDUCATION',
    imageUrls: [FME_LOGO_URL],
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'Federal Ministry of Education services',
  },
  'jamb-result': {
    label: 'JAMB',
    secondary: 'RESULT',
    imageUrls: [JAMB_LOGO_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB result checking',
  },
  'waec-result': {
    label: 'WAEC',
    secondary: 'RESULT',
    imageUrls: [WAEC_LOGO_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'WAEC result checking',
  },
  'neco-result': {
    label: 'NECO',
    secondary: 'RESULT',
    imageUrls: [NECO_LOGO_URL],
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'NECO result checking',
  },
  'past-questions': {
    label: 'PAST',
    secondary: 'QUESTIONS',
    kind: 'icon',
    icon: 'bookCheck',
    tone: 'purple',
    ariaLabel: 'Past questions and exam practice',
  },
  services: {
    label: 'ER',
    kind: 'icon',
    icon: 'briefcase',
    tone: 'slate',
    ariaLabel: 'EduReach student services',
  },
  admission: {
    label: '',
    kind: 'icon',
    icon: 'graduation',
    tone: 'purple',
    ariaLabel: 'Admission service',
  },
  'admission-consultation': { label: '', kind: 'icon', icon: 'help', tone: 'purple', ariaLabel: 'Admission consultation' },
  'admission-guidance': { label: '', kind: 'icon', icon: 'school', tone: 'purple', ariaLabel: 'Admission guidance' },
  'school-finder': { label: '', kind: 'icon', icon: 'school', tone: 'blue', ariaLabel: 'School and institution finder' },
  'course-finder': { label: '', kind: 'icon', icon: 'search', tone: 'blue', ariaLabel: 'Course finder' },
  'jamb-subject-combination': { label: '', kind: 'icon', icon: 'fileQuestion', tone: 'blue', ariaLabel: 'JAMB subject combination' },
  'post-utme-guidance': { label: '', kind: 'icon', icon: 'fileQuestion', tone: 'purple', ariaLabel: 'Post UTME guidance' },
  'admission-requirements': { label: '', kind: 'icon', icon: 'fileCheck', tone: 'green', ariaLabel: 'Admission requirements' },
  'admission-application-support': { label: '', kind: 'icon', icon: 'file', tone: 'purple', ariaLabel: 'Admission application support' },
  'change-institution-guidance': { label: '', kind: 'icon', icon: 'school', tone: 'amber', ariaLabel: 'Change of institution guidance' },
  'change-course-guidance': { label: '', kind: 'icon', icon: 'fileQuestion', tone: 'amber', ariaLabel: 'Change of course guidance' },
  'scholarship-finder': { label: '', kind: 'icon', icon: 'award', tone: 'amber', ariaLabel: 'Scholarship finder' },
  'scholarship-application': { label: '', kind: 'icon', icon: 'award', tone: 'amber', ariaLabel: 'Scholarship application' },
  'student-loan-guidance': { label: '', kind: 'icon', icon: 'file', tone: 'green', ariaLabel: 'Student loan guidance' },
  'financial-aid': { label: '', kind: 'icon', icon: 'wallet', tone: 'green', ariaLabel: 'Financial aid' },
  'education-cost-calculator': { label: '', kind: 'icon', icon: 'calculator', tone: 'blue', ariaLabel: 'Education cost calculator' },
  'certificate-verification': { label: '', kind: 'icon', icon: 'fileCheck', tone: 'green', ariaLabel: 'Certificate verification' },
  'certificate-services': { label: '', kind: 'icon', icon: 'file', tone: 'slate', ariaLabel: 'Certificate services' },
  'document-upload': { label: '', kind: 'icon', icon: 'file', tone: 'slate', ariaLabel: 'Document upload' },
  'result-verification': { label: '', kind: 'icon', icon: 'fileCheck', tone: 'green', ariaLabel: 'Result verification' },
  'academic-record': { label: '', kind: 'icon', icon: 'file', tone: 'blue', ariaLabel: 'Academic record' },
  'statement-of-result': { label: '', kind: 'icon', icon: 'file', tone: 'blue', ariaLabel: 'Statement of result' },
  'reference-letter': { label: '', kind: 'icon', icon: 'file', tone: 'purple', ariaLabel: 'Reference letter' },
  'cgpa-calculator': { label: '', kind: 'icon', icon: 'calculator', tone: 'blue', ariaLabel: 'CGPA calculator' },
  'gpa-calculator': { label: '', kind: 'icon', icon: 'calculator', tone: 'blue', ariaLabel: 'GPA calculator' },
  'study-planner': { label: '', kind: 'icon', icon: 'bookCheck', tone: 'purple', ariaLabel: 'Study planner' },
  'exam-countdown': { label: '', kind: 'icon', icon: 'calendar', tone: 'amber', ariaLabel: 'Exam countdown' },
  'grade-calculator': { label: '', kind: 'icon', icon: 'calculator', tone: 'blue', ariaLabel: 'Grade calculator' },
  'course-planner': { label: '', kind: 'icon', icon: 'clipboard', tone: 'blue', ariaLabel: 'Course planner' },
  'campus-news': { label: '', kind: 'icon', icon: 'news', tone: 'blue', ariaLabel: 'Campus news' },
  'education-news': { label: '', kind: 'icon', icon: 'news', tone: 'blue', ariaLabel: 'Education news' },
  'scholarship-updates': { label: '', kind: 'icon', icon: 'award', tone: 'amber', ariaLabel: 'Scholarship updates' },
  'admission-updates': { label: '', kind: 'icon', icon: 'graduation', tone: 'purple', ariaLabel: 'Admission updates' },
  'exam-updates': { label: '', kind: 'icon', icon: 'fileQuestion', tone: 'blue', ariaLabel: 'Exam updates' },
  'deadline-alerts': { label: '', kind: 'icon', icon: 'bell', tone: 'amber', ariaLabel: 'Deadline alerts' },
  'student-help': { label: '', kind: 'icon', icon: 'headset', tone: 'blue', ariaLabel: 'Student help' },
  'faqs': { label: '', kind: 'icon', icon: 'help', tone: 'blue', ariaLabel: 'Frequently asked questions' },
  'ask-consultant': { label: '', kind: 'icon', icon: 'help', tone: 'purple', ariaLabel: 'Ask a consultant' },
  'student-community': { label: '', kind: 'icon', icon: 'user', tone: 'purple', ariaLabel: 'Student community' },
  'school-fees': {
    label: '',
    kind: 'icon',
    icon: 'wallet',
    tone: 'green',
    ariaLabel: 'School fees and payment',
  },
  'course-registration': {
    label: '',
    kind: 'icon',
    icon: 'clipboard',
    tone: 'blue',
    ariaLabel: 'Course registration',
  },
  transcript: {
    label: '',
    kind: 'icon',
    icon: 'file',
    tone: 'slate',
    ariaLabel: 'Transcript request',
  },
  'student-id': {
    label: '',
    kind: 'icon',
    icon: 'card',
    tone: 'slate',
    ariaLabel: 'Student identification card',
  },
  scholarship: {
    label: '',
    kind: 'icon',
    icon: 'award',
    tone: 'amber',
    ariaLabel: 'Scholarship opportunity',
  },
  timetable: {
    label: '',
    kind: 'icon',
    icon: 'calendar',
    tone: 'blue',
    ariaLabel: 'Academic timetable',
  },
  calendar: {
    label: '',
    kind: 'icon',
    icon: 'calendar',
    tone: 'blue',
    ariaLabel: 'Academic calendar',
  },
  verification: {
    label: '',
    kind: 'icon',
    icon: 'check',
    tone: 'green',
    ariaLabel: 'Document verification',
  },
  document: {
    label: '',
    kind: 'icon',
    icon: 'file',
    tone: 'slate',
    ariaLabel: 'Document request',
  },
  support: {
    label: '',
    kind: 'icon',
    icon: 'headset',
    tone: 'blue',
    ariaLabel: 'Student support',
  },
  payment: {
    label: '',
    kind: 'icon',
    icon: 'wallet',
    tone: 'green',
    ariaLabel: 'Payment',
  },
  profile: {
    label: '',
    kind: 'icon',
    icon: 'user',
    tone: 'slate',
    ariaLabel: 'Student profile',
  },
  news: {
    label: '',
    kind: 'icon',
    icon: 'news',
    tone: 'slate',
    ariaLabel: 'News',
  },
  notification: {
    label: '',
    kind: 'icon',
    icon: 'bell',
    tone: 'slate',
    ariaLabel: 'Notifications',
  },
  settings: {
    label: '',
    kind: 'icon',
    icon: 'settings',
    tone: 'slate',
    ariaLabel: 'Settings',
  },
  search: {
    label: '',
    kind: 'icon',
    icon: 'search',
    tone: 'slate',
    ariaLabel: 'Search',
  },
  dashboard: {
    label: '',
    kind: 'icon',
    icon: 'dashboard',
    tone: 'slate',
    ariaLabel: 'Dashboard',
  },
};

export const contentVisuals: Record<string, CardIdentity> = {
  news: {
    label: '',
    kind: 'icon',
    icon: 'news',
    tone: 'slate',
    ariaLabel: 'News and academic updates',
  },
  jobs: {
    label: '',
    kind: 'icon',
    icon: 'briefcase',
    tone: 'purple',
    ariaLabel: 'Student jobs and opportunities',
  },
  admissions: {
    label: 'ADM',
    kind: 'icon',
    icon: 'graduation',
    tone: 'purple',
    ariaLabel: 'Admissions',
  },
  payments: {
    label: '',
    kind: 'icon',
    icon: 'wallet',
    tone: 'green',
    ariaLabel: 'Student payments',
  },
  profile: {
    label: '',
    kind: 'icon',
    icon: 'user',
    tone: 'slate',
    ariaLabel: 'Student profile',
  },
  results: serviceVisuals.results,
  jamb: serviceVisuals['jamb-result'],
  cbt: serviceVisuals.cbt,
  nelfund: serviceVisuals['nelfund-loan'],
};

export function serviceCardIdentity(serviceKey: string): CardIdentity {
  const key = serviceKey.toLowerCase();

  // Exact mappings take priority so the same identity is reused everywhere.
  if (serviceVisuals[key]) return serviceVisuals[key];

  // Future service_catalog rows can use descriptive keys without needing another
  // component or another card-specific icon mapping.
  if (key.includes('nelfund') || key.includes('student-loan')) return serviceVisuals['nelfund-loan'];
  if (key.includes('jamb') && key.includes('cbt')) return serviceVisuals['jamb-cbt'];
  if (key.includes('post-utme')) return serviceVisuals['post-utme'];
  if (key.includes('jamb') && key.includes('result')) return serviceVisuals['jamb-result'];
  if (key.includes('jamb')) return serviceVisuals['jamb-slip'];
  if (key.includes('nabteb')) return serviceVisuals.nabteb;
  if (key.includes('nysc')) return serviceVisuals.nysc;
  if (key.includes('education-ministry') || key.includes('federal-ministry') || key === 'fme') {
    return serviceVisuals['education-ministry'];
  }
  if (key.includes('waec') && key.includes('neco')) return serviceVisuals.results;
  if (key.includes('waec')) return serviceVisuals['waec-result'];
  if (key.includes('neco')) return serviceVisuals['neco-result'];
  if (key.includes('cbt')) return serviceVisuals.cbt;
  if (key.includes('past') || key.includes('question') || key.includes('practice')) return serviceVisuals['past-questions'];

  return {
    label: 'ER',
    kind: 'wordmark',
    tone: 'slate',
    ariaLabel: 'EduReach service',
  };
}

export function newsCardIdentity(category: string): CardIdentity {
  const key = category.toLowerCase();

  if (key.includes('jamb')) {
    return { ...serviceVisuals['jamb-result'], ariaLabel: 'JAMB news' };
  }
  if (key.includes('fund') || key.includes('nelfund')) {
    return { ...serviceVisuals.nelfund, ariaLabel: 'NELFUND news' };
  }
  if (key.includes('admission') || key.includes('post-utme')) {
    return {
      label: 'ADM',
      kind: 'icon',
      icon: 'graduation',
      tone: 'purple',
      ariaLabel: 'Admission news',
    };
  }
  if (key.includes('result') || key.includes('waec') || key.includes('neco')) {
    return { ...serviceVisuals.results, ariaLabel: 'WAEC and NECO result news' };
  }
  if (key.includes('opportun') || key.includes('job') || key.includes('scholar')) {
    return contentVisuals.jobs;
  }

  return contentVisuals.news;
}

export function upcomingCardIdentity(kind: 'deadline' | 'exam'): CardIdentity {
  return kind === 'exam'
    ? { ...serviceVisuals.cbt, ariaLabel: 'Computer based examination' }
    : {
        label: 'DUE',
        kind: 'icon',
        icon: 'calendar',
        tone: 'amber',
        ariaLabel: 'Deadline',
      };
}

export function contentCardIdentity(key: string): CardIdentity {
  return contentVisuals[key] ?? {
    label: 'ER',
    kind: 'wordmark',
    tone: 'slate',
    ariaLabel: 'EduReach',
  };
}
