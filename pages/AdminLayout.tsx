import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Database,
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
import SkipLink from '../src/components/a11y/SkipLink';
import { useAdminHealth } from '../src/components/admin/AdminKit';
import { AdminCapabilityProvider } from '../src/components/admin/Can';
import { API_BASE_PATH } from '../src/lib/apiBase';
import {
  capabilitiesForRole,
  capabilityForAdminPath,
  hasCapability,
  isStaffRole,
  resolveAppRole,
  type Capability,
} from '../src/lib/capabilities';

const ADMIN_API_BASE = API_BASE_PATH;

type AdminSession = { id: string; email: string; fullName: string; role: string; capabilities: Capability[] };

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
        role: String(body.user.role || ''),
        // The server is the source of truth; never derive capabilities from
        // anything the browser stored.
        capabilities: Array.isArray(body.user.capabilities) ? (body.user.capabilities as Capability[]) : [],
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

  // Backend unreachable: fall back to the profile row the account can read
  // under RLS, resolving capabilities through the same vocabulary the server
  // uses. The API still authorizes every call, so this cannot grant anything.
  const appRole = resolveAppRole(profile?.role);
  if (isStaffRole(appRole)) {
    return {
      session: {
        id: authSession.user.id,
        email: authSession.user.email || '',
        fullName: String(profile?.full_name || authSession.user.user_metadata?.full_name || ''),
        role: appRole,
        capabilities: [...capabilitiesForRole(appRole)],
      },
      backend: 'Profile fallback',
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Console navigation, capability-aware.
//
// `capability: null` means any staff member may open the section. The mapping
// is the same one the server enforces (src/lib/capabilities.ts,
// ADMIN_ROUTE_CAPABILITIES), so the console never advertises a section the API
// will refuse.
// ---------------------------------------------------------------------------

type AdminNavEntry =
  | { kind: 'group'; label: string }
  | { kind: 'link'; href: string; label: string; icon: ReactNode; capability: Capability | null };

const ADMIN_CONSOLE_NAV: AdminNavEntry[] = [
  { kind: 'link', href: '/admin', label: 'Overview', icon: <LayoutDashboard size={15} />, capability: null },
  { kind: 'group', label: 'Content' },
  { kind: 'link', href: '/admin/news', label: 'Newsroom CMS', icon: <Newspaper size={15} />, capability: 'news.read' },
  { kind: 'link', href: '/admin/content', label: 'Events & Key Dates', icon: <CalendarDays size={15} />, capability: 'calendar.read' },
  { kind: 'link', href: '/admin/opportunities', label: 'Scholarships & Opportunities', icon: <GraduationCap size={15} />, capability: 'opportunity.read' },
  { kind: 'group', label: 'Services' },
  { kind: 'link', href: '/admin/services', label: 'Service Catalogue', icon: <Briefcase size={15} />, capability: 'service.read' },
  { kind: 'link', href: '/admin/queue', label: 'Service Queue', icon: <ListChecks size={15} />, capability: 'service_request.read' },
  { kind: 'group', label: 'Academics' },
  { kind: 'link', href: '/admin/schools', label: 'Schools & Institutions', icon: <School size={15} />, capability: 'institution.read' },
  { kind: 'group', label: 'Examinations' },
  { kind: 'link', href: '/admin/cbt', label: 'CBT Manager', icon: <Laptop size={15} />, capability: 'cbt.read' },
  { kind: 'group', label: 'Users' },
  { kind: 'link', href: '/admin/users', label: 'Student Accounts', icon: <Users size={15} />, capability: 'user.read' },
  { kind: 'group', label: 'Analytics' },
  { kind: 'link', href: '/admin/analytics', label: 'Analytics & Reports', icon: <BarChart3 size={15} />, capability: 'analytics.read' },
  { kind: 'link', href: '/admin/content-manager', label: 'Data Control Center', icon: <Database size={15} />, capability: 'data.read' },
  { kind: 'link', href: '/', label: 'View Public Site', icon: <Globe size={15} />, capability: null },
];

/** Path changes go through history/popstate in this app, so track them. */
function useCurrentAdminPath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onNavigate = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);
  return path;
}

function AdminSectionDenied({ session, capability, onLeave }: { session: AdminSession; capability: Capability; onLeave: () => void }) {
  return (
    <div className="admin-access-screen">
      <div className="admin-access-card">
        <BrandLogo height={52} radius="50%" />
        <h1>Not available for your role</h1>
        <p>This section needs the <code>{capability}</code> capability. Your account ({session.role}) does not have it.</p>
        <div className="admin-access-actions">
          <button type="button" className="admin-btn" onClick={() => onLeave()}>Back to overview</button>
        </div>
        <p className="admin-access-note">Every admin API re-checks capabilities, so nothing can be reached by editing the URL.</p>
      </div>
    </div>
  );
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

  const pathname = useCurrentAdminPath();
  const requiredCapability = capabilityForAdminPath(pathname);
  if (requiredCapability && !hasCapability(session, requiredCapability)) {
    return <AdminSectionDenied session={session} capability={requiredCapability} onLeave={() => navigate('/admin')} />;
  }

  const navItems = ADMIN_CONSOLE_NAV.filter((item) => item.kind === 'group' || item.capability === null || hasCapability(session, item.capability));

  return <div className="admin-shell">
    <SkipLink />
    <aside className="admin-sidebar">
      <div>
        <div className="admin-brand"><BrandLogo height={40} radius="50%" /><div><strong>Admin</strong><span>Production Control</span></div></div>
        <nav className="admin-nav">
          {navItems.map((item, index) => (
            item.kind === 'group'
              ? <div className="admin-nav-group" key={`group-${index}`}>{item.label}</div>
              : <NavLink key={item.href} href={item.href} icon={item.icon}>{item.label}</NavLink>
          ))}
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
      <main className="admin-main" id="main-content" tabIndex={-1}>
        <AdminCapabilityProvider value={session}>{children}</AdminCapabilityProvider>
      </main>
    </div>
  </div>;
}
