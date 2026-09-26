import { lazy, Suspense, useEffect, useRef, useState, useTransition } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { RouteFallback } from '../components/Skeleton';
import { renderRoute } from './routes';
import { pageTitleFor } from '../lib/pageMeta';

// The admin console keeps ONE mounted shell (sidebar, top bar, session state)
// across every /admin route; only the inner content area re-renders. This is
// what stops the console from showing "verifying administrator…" on every
// internal navigation.
const AdminShell = lazy(() => import('../../pages/AdminLayout'));

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
  // Route changes run as transitions: when the next page's code chunk is still
  // downloading (see routes.tsx), the current page stays on screen and the
  // progress bar shows "pending" instead of flashing a skeleton.
  const [isPending, startTransition] = useTransition();
  const pendingHash = useRef<string | null>(null);
  const currentRouteKey = useRef(locationState.routeKey);
  currentRouteKey.current = locationState.routeKey;

  useEffect(() => {
    if (pendingHash.current === null) return;
    scrollForNavigation(pendingHash.current);
    pendingHash.current = null;
  }, [locationState.routeKey]);

  useEffect(() => {
    try {
      window.history.replaceState({ ...(window.history.state || {}), edureach: true }, '', window.location.href);
    } catch {
      // History state is optional; navigation still works without the marker.
    }

    const syncPath = () => {
      pendingHash.current = null;
      try {
        window.history.replaceState({ ...(window.history.state || {}), edureach: true }, '', window.location.href);
        window.sessionStorage.setItem('edureach-app-history', '1');
      } catch {
        // Storage may be unavailable in a restricted browser context.
      }
      // Always publish a fresh location object: the dashboard relies on it to
      // re-sync its tab after a silent pushState + browser back.
      startTransition(() => setLocationState(readLocation()));
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
      if (next !== current) {
        window.history.pushState({ edureach: true }, '', next);
        try { window.sessionStorage.setItem('edureach-app-history', '1'); } catch { /* optional */ }
      }
      const routeKey = `${url.pathname}${url.search}`;
      if (routeKey === currentRouteKey.current) {
        // Same page (or hash-only change): nothing new to load, scroll right away.
        scrollForNavigation(url.hash);
      } else {
        // Scroll once the new page has actually committed (after its chunk loads).
        pendingHash.current = url.hash;
      }
      startTransition(() => setLocationState({ pathname: url.pathname, routeKey }));
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
      {isPending && <div className="er-route-progress is-pending" aria-hidden="true" />}
      {/* Suspense stays mounted across routes (only the inner tree is keyed) so a
          transition keeps the current page visible while the next chunk loads;
          the skeleton fallback only appears on a cold load. Admin routes wrap
          the keyed content in a single persistent console shell. */}
      {locationState.pathname.startsWith('/admin') ? (
        <ErrorBoundary key="admin-shell-boundary">
          <Suspense fallback={<RouteFallback />}>
            <AdminShell>
              <ErrorBoundary key={locationState.routeKey}>{renderRoute(locationState.pathname)}</ErrorBoundary>
            </AdminShell>
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary key={locationState.routeKey}>
          <Suspense fallback={<RouteFallback />}>
            {renderRoute(locationState.pathname)}
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
