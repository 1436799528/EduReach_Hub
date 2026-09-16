import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from './AdminNav';
import { supabase } from '../src/lib/supabase';

type AdminSession = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin';
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let active = true;

    async function check() {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        });
        if (!response.ok) {
          await supabase.auth.signOut();
          navigate('/login');
          return;
        }
        const data = await response.json() as { user: AdminSession };
        if (!active) return;
        setSession(data.user);
        setChecking(false);
      } catch {
        if (active) {
          setChecking(false);
          navigate('/login');
        }
      }
    }

    check();
    return () => { active = false; };
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  if (checking) return <div className="admin-loading-screen">Verifying administrative session…</div>;
  if (!session) return null;

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div>
        <div className="admin-brand">
          <div className="admin-brand-mark">ER</div>
          <div><strong>EduReach Admin</strong><span>Production Control</span></div>
        </div>
        <nav className="admin-nav">
          <NavLink href="/admin" icon="▦">Operations Dashboard</NavLink>
          <NavLink href="/admin/queue" icon="≋">Service Queue</NavLink>
          <NavLink href="/admin/cbt" icon="▣">CBT Question Bank</NavLink>
          <NavLink href="/admin/vouchers" icon="▤">Scratch Card Inventory</NavLink>
          <NavLink href="/admin/users" icon="♙">Student Accounts</NavLink>
        </nav>
      </div>
      <div className="admin-sidebar-footer">
        <div className="admin-health-card">
          <div><span>Database</span><b>Connected</b></div>
          <div><span>Auth</span><b>Active</b></div>
        </div>
        <div className="admin-user-email">{session.email}</div>
        <button className="admin-btn secondary" onClick={() => navigate('/dashboard')}>Student Workspace</button>
        <button className="admin-logout" onClick={logout}>Terminate Admin Session</button>
      </div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <span>Production Node: <code>edureach-prod</code></span>
        <span className="admin-health-pill"><i /> System Health</span>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  </div>;
}
