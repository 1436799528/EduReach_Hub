import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from './AdminNav';
import { supabase } from '../src/lib/supabase';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
      const ok = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'moderator';
      if (!active) return;
      setAllowed(Boolean(ok));
      setUserEmail(user.email || profile?.full_name || 'Staff');
      setChecking(false);
      if (!ok) navigate('/');
    }
    check();
    return () => { active = false; };
  }, [navigate]);

  async function logout() { await supabase.auth.signOut(); navigate('/'); }
  if (checking) return <div className="admin-loading-screen">Checking administrative access…</div>;
  if (!allowed) return null;

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div>
        <div className="admin-brand"><div className="admin-brand-mark">ER</div><div><strong>EduReach Admin</strong><span>Live Production</span></div></div>
        <nav className="admin-nav">
          <NavLink href="/admin" icon="▦">Operations Dashboard</NavLink>
          <NavLink href="/admin/queue" icon="≋">Service Queue</NavLink>
          <NavLink href="/admin/cbt" icon="▣">CBT Question Bank</NavLink>
          <NavLink href="/admin/vouchers" icon="▤">Scratch Card Inventory</NavLink>
          <NavLink href="/admin/users" icon="♙">Student Accounts</NavLink>
        </nav>
      </div>
      <div className="admin-sidebar-footer">
        <div className="admin-health-card"><div><span>Database</span><b>Connected</b></div><div><span>Auth</span><b>Active</b></div></div>
        <div className="admin-user-email">{userEmail}</div>
        <button className="admin-logout" onClick={logout}>⎋ Terminate Admin Session</button>
      </div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><span>Production Node: <code>edureach-prod</code></span><span className="admin-health-pill">System Health</span></header>
      <main className="admin-main">{children}</main>
    </div>
  </div>;
}
