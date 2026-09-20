import { useCallback, type ReactNode } from 'react';

export function useNavigate() {
  return useCallback((path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);
}

export function NavLink({ href, icon, children }: { href: string; icon: string; children: ReactNode }) {
  const active = window.location.pathname === href;
  return <a className={`admin-nav-link ${active ? 'active' : ''}`} href={href}><span className="admin-nav-icon">{icon}</span><span>{children}</span></a>;
}
