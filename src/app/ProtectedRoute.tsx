import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';

function navigateInApp(path: string, replace = false) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function LoadingPortal() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#FAF8FF' }}>
      <div style={{ width: 'min(100%, 420px)', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', textAlign: 'center', boxShadow: '0 8px 24px rgba(15,23,42,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 12px' }}><BrandLogo height={44} radius="50%" /></div>
        <h1 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0F172A' }}>Checking your student session…</h1>
        <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px', lineHeight: 1.55 }}>Protected EduReach pages require an active student account.</p>
      </div>
    </div>
  );
}

// Every route wrapped in <ProtectedRoute> lives under one of these prefixes.
const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/settings', '/services/track', '/track'];
export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    // Never chain /login?next=/login?next=… (e.g. StrictMode double effects).
    if (window.location.pathname.startsWith('/login')) return;
    // Signing out navigates home in the same tick; if the URL has already left
    // the protected area, this stale guard must not bounce the user to /login.
    if (!isProtectedPath(window.location.pathname)) return;
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    navigateInApp(`/login?next=${encodeURIComponent(next)}`, true);
  }, [isAuthenticated, isLoading]);

  if (isLoading) return <LoadingPortal />;
  if (!isAuthenticated) return <LoadingPortal />;

  return <>{children}</>;
}
