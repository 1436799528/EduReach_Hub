import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';

function navigateInApp(path: string, replace = false) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function LoadingPortal() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#FAF8FF' }}>
      <div style={{ width: 'min(100%, 420px)', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', textAlign: 'center', boxShadow: '0 8px 24px rgba(15,23,42,.06)' }}>
        <div style={{ width: '38px', height: '38px', margin: '0 auto 12px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: '#FFF0E6', color: '#D9381E', fontWeight: 900 }}>ER</div>
        <h1 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0F172A' }}>Checking your student session…</h1>
        <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px', lineHeight: 1.55 }}>Protected EduReach pages require an active student account.</p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    navigateInApp(`/login?next=${encodeURIComponent(next)}`, true);
  }, [isAuthenticated, isLoading]);

  if (isLoading) return <LoadingPortal />;
  if (!isAuthenticated) return <LoadingPortal />;

  return <>{children}</>;
}
