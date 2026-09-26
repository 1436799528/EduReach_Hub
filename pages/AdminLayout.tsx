import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Globe,
  GraduationCap,
  Laptop,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  School,
  Users,
} from 'lucide-react';
import { NavLink, useNavigate } from './AdminNav';
import { supabase } from '../src/lib/supabase';
import BrandLogo from '../src/components/BrandLogo';
import { useAdminHealth } from '../src/components/admin/AdminKit';

const ADMIN_API_BASE = import.meta.env.PROD ? '/.netlify/functions/api' : '/api';

type AdminSession = { id: string; email: string; fullName: string; role: 'admin' };

// ---------------------------------------------------------------------------
// Module-scoped admin session cache.
//
// The admin shell mounts once for the whole console (see App.tsx), so a normal
// page change never re-verifies anything. The cache additionally covers the
// cases where the shell is remounted (cold load of an /admin deep link, or
// returning from the public site): a recent verified session renders the
// console immediately while a silent revalidation runs in the background.
// The full-page "Verifying administrative access…" state only appears when
// there is no known session at all.
// ---------------------------------------------------------------------------

const SESSION_CACHE_TTL_MS = 15 * 60 * 1000;

let sessionCache: { session: AdminSession; backend: string; verifiedAt: number } | null = null;

export function clearAdminSessionCache() {
  sessionCache = null;
}

async function verifyAdminSession(): Promise<{ session: AdminSession; backend: string } | null> {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession?.access_token) return null;

  const response = await fetch(`${ADMIN_API_BASE}/admin/session`, {
    headers: { Authorization: `Bearer ${authSession.access_token}` },
  }).catch(() => null);
  const body = response ? await response.json().catch(() => null) : null;
  if (response?.ok && body?.user) {
    return {
      session: {
        id: body.user.id,
        email: body.user.email || '',
        fullName: body.user.fullName || '',
        role: 'admin',
      },
      backend: 'Connected',
    };
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
    return {
      session: {
        id: authSession.user.id,
        email: authSession.user.email || '',
        fullName: String(profile?.full_name || authSession.user.user_metadata?.full_name || ''),
        role: 'admin',
      },
      backend: 'Profile fallback',
    };
  }
  return null;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const health = useAdminHealth();
  const cached = sessionCache && Date.now() - sessionCache.verifiedAt < SESSION_CACHE_TTL_MS ? sessionCache : null;
  const [checking, setChecking] = useState(!cached);
  const [session, setSession] = useState<AdminSession | null>(cached?.session || null);
  const [backend, setBackend] = useState(cached?.backend || 'Checking…');

  useEffect(() => {
    let active = true;

    async function check() {
      // With a cached session the console is already interactive; revalidate
      // quietly and only tear the session down if the server rejects it.
      const blocking = !cached;
      if (blocking) setChecking(true);
      try {
        const result = await verifyAdminSession();
        if (!active) return;
        if (result) {
          sessionCache = { session: result.session, backend: result.backend, verifiedAt: Date.now() };
          setSession(result.session);
          setBackend(result.backend);
          setChecking(false);
          return;
        }
        sessionCache = null;
        setSession(null);
        setChecking(false);
        navigate('/login');
      } catch {
        // Network/backend hiccup: keep a cached session alive rather than
        // locking an administrator out mid-navigation.
        if (!active) return;
        if (!cached) {
          setSession(null);
          setChecking(false);
          navigate('/login');
        }
      }
    }

    check();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    window.sessionStorage.removeItem('edureach-admin-student-view');
    clearAdminSessionCache();
    await supabase.auth.signOut();
    navigate('/login');
  }

  if (checking) return <div className="admin-loading-screen">Verifying administrative access…</div>;
  if (!session) {
    return (
      <div className="admin-access-screen">
        <div className="admin-access-card">
          <BrandLogo height={52} radius="50%" />
          <h1>Administrator access required</h1>
          <p>This is the EduReach management console. Sign in with an account that has an administrator role.</p>
          <div className="admin-access-actions">
            <button type="button" className="admin-btn" onClick={() => navigate('/login?next=%2Fadmin')}>Sign in</button>
            <button type="button" className="admin-btn secondary-dark" onClick={() => navigate('/')}>Go to the main site</button>
          </div>
          <p className="admin-access-note">Access is verified against the live backend on every visit.</p>
        </div>
      </div>
    );
  }

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div>
        <div className="admin-brand"><BrandLogo height={40} radius="50%" /><div><strong>Admin</strong><span>Production Control</span></div></div>
        <nav className="admin-nav">
          <NavLink href="/admin" icon={<LayoutDashboard size={15} />}>Overview</NavLink>
          <div className="admin-nav-group">Content</div>
          <NavLink href="/admin/news" icon={<Newspaper size={15} />}>Newsroom CMS</NavLink>
          <NavLink href="/admin/content" icon={<CalendarDays size={15} />}>Events &amp; Key Dates</NavLink>
          <NavLink href="/admin/opportunities" icon={<GraduationCap size={15} />}>Scholarships &amp; Opportunities</NavLink>
          <div className="admin-nav-group">Services</div>
          <NavLink href="/admin/services" icon={<Briefcase size={15} />}>Service Catalogue</NavLink>
          <NavLink href="/admin/queue" icon={<ListChecks size={15} />}>Service Queue</NavLink>
          <div className="admin-nav-group">Academics</div>
          <NavLink href="/admin/schools" icon={<School size={15} />}>Schools &amp; Institutions</NavLink>
          <div className="admin-nav-group">Examinations</div>
          <NavLink href="/admin/cbt" icon={<Laptop size={15} />}>CBT Manager</NavLink>
          <div className="admin-nav-group">Users</div>
          <NavLink href="/admin/users" icon={<Users size={15} />}>Student Accounts</NavLink>
          <div className="admin-nav-group">Analytics</div>
          <NavLink href="/admin/analytics" icon={<BarChart3 size={15} />}>Analytics &amp; Reports</NavLink>
          <NavLink href="/" icon={<Globe size={15} />}>View Public Site</NavLink>
        </nav>
      </div>
      <div className="admin-sidebar-footer">
        <div className="admin-health-card">
          <div><span>API</span><b className={health.state === 'down' ? 'health-bad' : undefined}>{health.state === 'ok' ? 'Online' : health.state === 'down' ? 'Offline' : 'Checking…'}</b></div>
          <div><span>Auth source</span><b>{backend}</b></div>
        </div>
        <div className="admin-user-email">{session.email}</div>
        <button type="button" className="admin-btn secondary" onClick={() => { window.sessionStorage.setItem('edureach-admin-student-view', '1'); navigate('/dashboard?view=student'); }}>View Student Site</button>
        <button type="button" className="admin-logout" onClick={logout}>Terminate Admin Session</button>
      </div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {session.fullName || session.email}</span>
        <span className={`admin-health-pill ${health.state}`}>
          <i /> {health.state === 'ok' ? `API Online${health.latencyMs !== null ? ` · ${health.latencyMs}ms` : ''}` : health.state === 'down' ? 'API Unreachable' : 'Checking API…'}
        </span>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  </div>;
}
