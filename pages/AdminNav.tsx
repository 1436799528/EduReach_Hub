import { useCallback, type MouseEvent, type ReactNode } from 'react';
import { navigateInApp } from '../src/lib/navigation';

export function useNavigate() {
  return useCallback((path: string) => navigateInApp(path), []);
}

/**
 * UX-3 — the admin shell is one client-side application.
 *
 * These links used to rely on the browser's default anchor behaviour, so every
 * sidebar click was a full document reload: the session was re-verified, the
 * sidebar closed, scroll reset, and the console looked like it had navigated
 * away rather than changed section. Writing the history entry here keeps the
 * shell mounted and makes the active state update in the same render.
 */
export function NavLink({ href, icon, children, onNavigate }: { href: string; icon: ReactNode; children: ReactNode; onNavigate?: () => void }) {
  const active = window.location.pathname === href;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open a new tab/window as the browser intended.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    onNavigate?.();
    navigateInApp(href);
  };
  return (
    <a
      className={`admin-nav-link ${active ? 'active' : ''}`}
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={follow}
    >
      <span className="admin-nav-icon">{icon}</span>
      <span>{children}</span>
    </a>
  );
}
