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
  '/screening-calculator': 'Screening Calculator',
  '/calculator': 'Screening Calculator',
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
      setLocationState({ pathname: url.pathname, routeKey: `${url.pathname}${url.search}` });
      scrollForNavigation(url.hash);
    };

    document.addEventListener('click', handleInternalLink);
    return () => document.removeEventListener('click', handleInternalLink);
  }, []);

  useEffect(() => {
    document.title = `EduReach — ${titleFor(locationState.pathname)}`;
  }, [locationState.pathname]);

  return <ErrorBoundary key={locationState.routeKey}>{renderRoute(locationState.pathname)}</ErrorBoundary>;
}
