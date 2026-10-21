import { useCallback, type ReactNode } from 'react';
import { navigateInApp } from '../src/lib/navigation';

export function useNavigate() {
  return useCallback((path: string) => navigateInApp(path), []);
}

export function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const active = window.location.pathname === href;
  return <a className={`admin-nav-link ${active ? 'active' : ''}`} href={href}><span className="admin-nav-icon">{icon}</span><span>{children}</span></a>;
}
