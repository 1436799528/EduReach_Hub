import { useEffect, useState } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { renderRoute } from './routes';

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
  '/admin/queue': 'Admin Queue',
  '/admin/cbt': 'Admin CBT',
  '/admin/vouchers': 'Admin Vouchers',
  '/admin/users': 'Admin Users',
};

function titleFor(pathname: string): string {
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized.startsWith('/services/apply/')) return 'Service Request';
  if (normalized.startsWith('/services/')) return 'Service';
  if (normalized.startsWith('/dashboard/cbt/results')) return 'CBT Results';
  if (normalized.startsWith('/news/')) return 'News Article';
  return routeTitles[normalized] || 'Page Not Found';
}

function scrollForNavigation(hash: string) {
  if (hash) {
    window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return;
  }
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
}

function readLocation() {
  return {
    pathname: window.location.pathname,
    routeKey: `${window.location.pathname}${window.location.search}`,
  };
}

function serviceActivityFor(pathname: string): { key: string; title: string; category: string } | null {
  if (pathname === '/cbt' || pathname === '/past-questions') return { key: 'cbt-practice', title: 'CBT & Past Question Bank', category: 'CBT Practice' };
  if (pathname === '/screening-calculator' || pathname === '/calculator' || pathname === '/admission') return { key: 'admission-tools', title: 'Admission & Screening Calculator', category: 'Academic Tool' };
  if (pathname === '/schools') return { key: 'school-finder', title: 'School Finder', category: 'Academic Tool' };
  if (pathname === '/jobs' || pathname === '/scholarships') return { key: 'scholarships', title: 'Scholarships & Grants', category: 'Funding' };
  if (pathname === '/nelfund') return { key: 'nelfund-loan', title: 'NELFUND Loan Application', category: 'Student Service' };
  if (pathname === '/results') return { key: 'results', title: 'WAEC / NECO Result Checking', category: 'Student Service' };
  if (pathname.startsWith('/services/apply/')) {
    const slug = decodeURIComponent(pathname.slice('/services/apply/'.length));
    return { key: slug, title: slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), category: 'Student Service' };
  }
  return null;
}

function analyticsSessionId() {
  const key = 'edureach-analytics-session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function recordPageView(pathname: string) {
  void fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      event_name: 'page_view',
      path: pathname,
      session_id: analyticsSessionId(),
      referrer: document.referrer || null,
    }),
  }).catch(() => undefined);
}

function recordServiceActivity(pathname: string, href: string) {
  const item = serviceActivityFor(pathname);
  if (!item) return;

  try {
    const current = JSON.parse(localStorage.getItem('edureach-accessed-services') || '[]');
    const list = Array.isArray(current) ? current : [];
    const existing = list.find((entry: any) => entry.key === item.key);
    const nextItem = {
      ...item,
      href,
      lastAccessedAt: new Date().toISOString(),
      count: existing ? Number(existing.count || 0) + 1 : 1,
    };
    const next = [nextItem, ...list.filter((entry: any) => entry.key !== item.key)].slice(0, 12);
    localStorage.setItem('edureach-accessed-services', JSON.stringify(next));
    window.dispatchEvent(new Event('edureach-activity-changed'));
  } catch {
    // Local activity tracking is best-effort only.
  }
}

export default function App() {
  const [locationState, setLocationState] = useState(readLocation);

  useEffect(() => {
    const syncPath = () => {
      setLocationState(readLocation());
      scrollForNavigation(window.location.hash);
    };
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    const handleInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor) return;
      if (anchor.target || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith('/api/')) return;

      event.preventDefault();
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next !== current) window.history.pushState({}, '', next);
      recordServiceActivity(url.pathname, next);
      setLocationState({ pathname: url.pathname, routeKey: `${url.pathname}${url.search}` });
      scrollForNavigation(url.hash);
    };

    document.addEventListener('click', handleInternalLink);
    return () => document.removeEventListener('click', handleInternalLink);
  }, []);

  useEffect(() => {
    document.title = `EduReach — ${titleFor(locationState.pathname)}`;
    recordPageView(locationState.pathname);
  }, [locationState.pathname]);

  return <ErrorBoundary key={locationState.routeKey}>{renderRoute(locationState.pathname)}</ErrorBoundary>;
}
