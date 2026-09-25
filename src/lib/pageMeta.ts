// Canonical page titles shared by the document title and the global PageBar.
// Keep route additions in sync with src/app/routes.tsx.

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/services': 'Services',
  '/search': 'Search',
  '/services/track': 'My Requests',
  '/track': 'My Requests',
  '/cbt': 'CBT',
  '/cbt/practice': 'CBT Practice',
  '/cbt/setup/jamb': 'JAMB Practice Setup',
  '/cbt/setup/waec': 'WAEC Practice Setup',
  '/cbt/setup/neco': 'NECO Practice Setup',
  '/cbt/setup/post-utme': 'Post-UTME Practice Setup',
  '/cbt/results': 'CBT Results',
  '/dashboard/cbt/results': 'CBT Results',
  '/screening-calculator': 'Screening Calculator',
  '/calculator': 'Screening Calculator',
  '/admission': 'Admission',
  '/tools': 'Academic Tools',
  '/schools': 'School Finder',
  '/past-questions': 'Past Questions',
  '/news': 'News',
  '/events': 'Events',
  '/jobs': 'Jobs',
  '/scholarships': 'Scholarships',
  '/jamb': 'JAMB',
  '/waec': 'WAEC',
  '/neco': 'NECO',
  '/post-utme': 'Post-UTME',
  '/nabteb': 'NABTEB',
  '/support': 'Student Support',
  '/nelfund': 'NELFUND',
  '/results': 'Results',
  '/login': 'Sign In',
  '/signin': 'Sign In',
  '/register': 'Register',
  '/signup': 'Register',
  '/forgot-password': 'Password Recovery',
  '/reset-password': 'Reset Password',
  '/verify-email': 'Verify Email',
  '/profile/complete': 'Academic Profile Completion',
  '/profile': 'Academic Profile',
  '/dashboard': 'Student Dashboard',
  '/dashboard/services': 'My Requests',
  '/dashboard/applications': 'My Requests',
  '/dashboard/cbt': 'My CBT',
  '/dashboard/past-questions': 'My CBT',
  '/dashboard/tools': 'Tools & Saved',
  '/dashboard/saved': 'Tools & Saved',
  '/dashboard/notifications': 'Student Dashboard',
  '/dashboard/scholarships': 'Scholarships & Grants',
  '/dashboard/settings': 'Settings',
  '/settings': 'Settings',
  '/admin': 'Admin Dashboard',
  '/admin/analytics': 'Admin Analytics',
  '/admin/queue': 'Admin Queue',
  '/admin/cbt': 'Admin CBT',
  '/admin/news': 'Admin Newsroom',
  '/admin/users': 'Admin Users',
};

export function pageTitleFor(pathname: string): string {
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized.startsWith('/cbt/setup/')) return 'Practice Setup';
  if (normalized.startsWith('/services/apply/')) return 'Service Guide';
  if (normalized.startsWith('/services/')) return 'Service';
  if (normalized.startsWith('/dashboard/cbt/results') || normalized.startsWith('/cbt/results')) return 'CBT Results';
  if (normalized.startsWith('/news/')) return 'News Article';
  if (normalized.startsWith('/schools/')) return 'School Details';
  if (normalized.startsWith('/admission/')) return 'Admission';
  if (normalized.startsWith('/tools/')) return 'Academic Tools';
  return routeTitles[normalized] || 'Page Not Found';
}
