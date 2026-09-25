import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Globe,
  Laptop,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Users,
} from 'lucide-react';
import { NavLink, useNavigate } from './AdminNav';
import { supabase } from '../src/lib/supabase';
import BrandLogo from '../src/components/BrandLogo';

type AdminSession = { id: string; email: string; fullName: string; role: 'admin' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [backend, setBackend] = useState('Checking…');

  useEffect(() => {
    let active = true;
    async function check() {
      setChecking(true);
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession?.access_token) {
          const response = await fetch('/api/admin/session', { headers: { Authorization: `Bearer ${authSession.access_token}` } });
          const body = await response.json().catch(() => null);
          if (response.ok && body?.user) {
            const user = body.user;
            if (active) { setSession({ id: user.id, email: user.email || '', fullName: user.fullName || '', role: 'admin' }); setBackend('Connected'); setChecking(false); }
            return;
          }

          // Keep the admin shell accessible when the local API is unavailable,
          // while still requiring the authenticated Supabase account to have an
          // explicit admin role in its own profile.
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('id', authSession.user.id)
            .maybeSingle();

          const role = String(profile?.role || '').toLowerCase();
          if (['admin', 'super_admin', 'moderator'].includes(role)) {
            if (active) {
              setSession({
                id: authSession.user.id,
                email: authSession.user.email || '',
                fullName: String(profile?.full_name || authSession.user.user_metadata?.full_name || ''),
                role: 'admin',
              });
              setBackend('Profile fallback');
              setChecking(false);
            }
            return;
          }
        }
      } catch {
        // Backend offline / not configured
      }

      if (active) {
        setSession(null);
        setChecking(false);
        navigate('/login');
      }
    }
    check();
    return () => { active = false; };
  }, [navigate]);

  async function logout() {
    window.sessionStorage.removeItem('edureach-admin-student-view');
    await supabase.auth.signOut();
    navigate('/login');
  }
  if (checking) return <div className="admin-loading-screen">Verifying administrative access…</div>;
  if (!session) return null;

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div>
        <div className="admin-brand"><BrandLogo height={40} radius="50%" /><div><strong>Admin</strong><span>Production Control</span></div></div>
        <nav className="admin-nav">
          <NavLink href="/admin" icon={<LayoutDashboard size={15} />}>Operations Dashboard</NavLink>
          <NavLink href="/admin/analytics" icon={<BarChart3 size={15} />}>Analytics & Reports</NavLink>
          <NavLink href="/admin/queue" icon={<ListChecks size={15} />}>Service Queue</NavLink>
          <NavLink href="/admin/cbt" icon={<Laptop size={15} />}>CBT Question Bank</NavLink>
          <NavLink href="/admin/news" icon={<Newspaper size={15} />}>Newsroom CMS</NavLink>
          <NavLink href="/admin/users" icon={<Users size={15} />}>Student Accounts</NavLink>
          <NavLink href="/" icon={<Globe size={15} />}>View Public Site</NavLink>
        </nav>
      </div>
      <div className="admin-sidebar-footer">
        <div className="admin-health-card"><div><span>Backend</span><b>{backend}</b></div><div><span>Session</span><b>Active</b></div></div>
        <div className="admin-user-email">{session.email}</div>
        <button type="button" className="admin-btn secondary" onClick={() => { window.sessionStorage.setItem('edureach-admin-student-view', '1'); navigate('/dashboard?view=student'); }}>View Student Site</button>
        <button type="button" className="admin-logout" onClick={logout}>Terminate Admin Session</button>
      </div>
    </aside>
    <div className="admin-workspace"><header className="admin-topbar"><span>Production Node: <code>edureach-prod</code></span><span className="admin-health-pill"><i /> Admin Session</span></header><main className="admin-main">{children}</main></div>
  </div>;
}
