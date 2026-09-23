import { useEffect, useState } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { renderRoute } from './routes';
import { pageTitleFor } from '../lib/pageMeta';

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
    document.title = `EduReach — ${pageTitleFor(locationState.pathname)}`;
    recordPageView(locationState.pathname);
  }, [locationState.pathname]);

  return (
    <>
      {/* Thin top progress bar: in-app navigation never triggers the browser's own loading UI. */}
      <div key={`progress:${locationState.routeKey}`} className="er-route-progress" aria-hidden="true" />
      <ErrorBoundary key={locationState.routeKey}>{renderRoute(locationState.pathname)}</ErrorBoundary>
    </>
  );
}
