import { useEffect, useState } from 'react';
import { renderRoute } from './routes';

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/services': 'Services',
  '/services/track': 'Request Tracker',
  '/cbt': 'CBT',
  '/cbt/practice': 'CBT Practice',
  '/cbt/results': 'CBT Results',
  '/screening-calculator': 'Screening Calculator',
  '/news': 'News',
  '/jobs': 'Jobs',
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
  '/admin': 'Admin Dashboard',
  '/admin/queue': 'Admin Queue',
  '/admin/cbt': 'Admin CBT',
  '/admin/vouchers': 'Admin Vouchers',
  '/admin/users': 'Admin Users',
};

function titleFor(pathname: string): string {
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized.startsWith('/services/apply/')) return 'Service Request';
  if (normalized.startsWith('/services/')) return 'Service';
  if (normalized.startsWith('/news/')) return 'News Article';
  return routeTitles[normalized] || 'Page Not Found';
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    document.title = `EduReach — ${titleFor(currentPath)}`;
  }, [currentPath]);

  return renderRoute(currentPath);
}
