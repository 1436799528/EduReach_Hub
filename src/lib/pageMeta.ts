// Canonical page titles shared by the document title and the global PageBar.
// Keep route additions in sync with src/app/routes.tsx.

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/services': 'Services',
  '/services/track': 'Request Tracker',
  '/track': 'Request Tracker',
  '/cbt': 'CBT',
  '/cbt/practice': 'CBT Practice',
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
  '/dashboard/services': 'My Services',
  '/dashboard/applications': 'Applications',
  '/dashboard/cbt': 'CBT Progress',
  '/dashboard/past-questions': 'Past Question Progress',
  '/dashboard/saved': 'Saved Items',
  '/dashboard/scholarships': 'Scholarships',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/tools': 'Dashboard Tools',
  '/dashboard/settings': 'Settings',
  '/settings': 'Settings',
  '/admin': 'Admin Dashboard',
  '/admin/analytics': 'Admin Analytics',
  '/admin/queue': 'Admin Queue',
  '/admin/cbt': 'Admin CBT',
  '/admin/news': 'Admin Newsroom',
  '/admin/vouchers': 'Admin Vouchers',
  '/admin/users': 'Admin Users',
};

export function pageTitleFor(pathname: string): string {
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized.startsWith('/services/apply/')) return 'Service Request';
  if (normalized.startsWith('/services/')) return 'Service';
  if (normalized.startsWith('/dashboard/cbt/results') || normalized.startsWith('/cbt/results')) return 'CBT Results';
  if (normalized.startsWith('/news/')) return 'News Article';
  if (normalized.startsWith('/admission/')) return 'Admission';
  if (normalized.startsWith('/tools/')) return 'Academic Tools';
  return routeTitles[normalized] || 'Page Not Found';
}
