export const APP_NAME = 'EduReach';
export const APP_DOMAIN = 'EduReach.ng';

export const ROUTES = {
  home: '/', login: '/login', register: '/register', forgotPassword: '/forgot-password',
  dashboard: '/dashboard', services: '/services', serviceTrack: '/services/track',
  cbt: '/cbt', cbtPractice: '/cbt/practice', cbtResults: '/cbt/results',
  news: '/news', jobs: '/jobs', screeningCalculator: '/screening-calculator', admin: '/admin',
} as const;

export const SERVICE_CATEGORIES = ['Examinations', 'Admission', 'Financial Aid', 'Documents', 'Student Tools', 'Support'] as const;
