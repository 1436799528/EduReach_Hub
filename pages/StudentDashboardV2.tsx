import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Calculator,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Edit,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  ScanSearch,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import BrandLogo from '../src/components/BrandLogo';
import CgpaCalculatorCard from '../src/components/dashboard/CgpaCalculatorCard';
import SchoolFinderCard, { type Institution } from '../src/components/dashboard/SchoolFinderCard';
import SecurityModal from '../src/components/dashboard/SecurityModal';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { localStorageKey, readLocalPreviewValue } from '../src/lib/localPreview';
import { useAuth } from '../src/lib/auth';
import { pageTitleFor } from '../src/lib/pageMeta';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import {
  deleteSavedItem,
  fetchLatestCgpaSnapshot,
  fetchSavedItems,
  upsertSavedItem,
  type CgpaCourseInput,
  type CgpaSnapshot,
  type DashboardSavedItem,
  type DashboardSavedItemInput,
} from '../src/lib/studentDashboard';
import '../src/student-dashboard.css';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DashboardTab = 'dashboard' | 'services' | 'cbt' | 'tools';

type Profile = {
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  school?: string | null;
  course_programme?: string | null;
  department?: string | null;
  faculty?: string | null;
  level?: string | null;
  session?: string | null;
  admission_year?: number | null;
  expected_graduation_year?: number | null;
  matric_number?: string | null;
  jamb_reg_no?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  mfa_enabled?: boolean | null;
};

type ServiceRow = { id: string; service_key: string; title: string };
type RequestRow = { id: string; status: string; form_data: Record<string, unknown>; created_at: string; reference_code: string; service_id: string };
type Attempt = { id: string; score: number | null; correct_answers: number; total_questions: number; submitted_at: string | null; created_at: string; subject?: string };

const TAB_ROUTES: Record<DashboardTab, string> = {
  dashboard: '/dashboard',
  services: '/dashboard/services',
  cbt: '/dashboard/cbt',
  tools: '/dashboard/tools',
};

const NAV: Array<{ tab: DashboardTab; label: string; short: string; Icon: typeof LayoutDashboard }> = [
  { tab: 'dashboard', label: 'Overview', short: 'Overview', Icon: LayoutDashboard },
  { tab: 'services', label: 'My Requests', short: 'Requests', Icon: ClipboardList },
  { tab: 'cbt', label: 'My CBT', short: 'CBT', Icon: MonitorPlay },
  { tab: 'tools', label: 'Tools & Saved', short: 'Tools', Icon: Wrench },
];

const localSavedItemsKey = () => localStorageKey('saved-items');

/* ------------------------------------------------------------------ */
/* Local (no-Supabase) readers                                         */
/* ------------------------------------------------------------------ */

function readLocalServiceRequests(): RequestRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localStorageKey('service-requests')) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => ({
        id: String(item.id || `local-${item.reference_code}`),
        service_id: String(item.service_id || item.form_data?.serviceSlug || 'local-service'),
        status: String(item.status || 'submitted'),
        reference_code: String(item.reference_code || 'ER-LOCAL'),
        created_at: String(item.created_at || new Date().toISOString()),
        form_data: {
          ...(item.form_data || {}),
          serviceTitle: item.form_data?.serviceTitle || item.service_catalog?.title || item.service_title || 'EduReach Service',
        },
      }))
      .sort((a: RequestRow, b: RequestRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

function readLocalCbtAttempts(): Attempt[] {
  try {
    const attempts: Attempt[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(localStorageKey('cbt-result-'))) continue;
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      if (!stored?.attempt) continue;
      attempts.push({
        id: String(stored.attempt.id || key.replace(localStorageKey('cbt-result-'), '')),
        score: Number(stored.attempt.score || 0),
        correct_answers: Number(stored.attempt.correct_answers || 0),
        total_questions: Number(stored.attempt.total_questions || stored.questions?.length || 0),
        submitted_at: stored.attempt.submitted_at || null,
        created_at: stored.attempt.submitted_at || new Date().toISOString(),
        subject: stored.exam?.title || stored.exam?.subject || stored.attempt.exam_id || 'CBT Practice',
      });
    }
    return attempts.sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime());
  } catch {
    return [];
  }
}

function readLocalSavedItems(): DashboardSavedItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localSavedItemsKey()) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSavedItems(items: DashboardSavedItem[]) {
  try {
    localStorage.setItem(localSavedItemsKey(), JSON.stringify(items));
  } catch {
    // storage unavailable
  }
}

function readStoredProfile(): any {
  try {
    return JSON.parse(readLocalPreviewValue('profile') || 'null');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ER';
}
function fmtDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function statusClass(status: string) {
  if (status === 'completed') return 'dash-status-pill dash-status-completed';
  if (status === 'rejected' || status === 'cancelled') return 'dash-status-pill dash-status-rejected';
  if (status === 'processing' || status === 'reviewing') return 'dash-status-pill dash-status-processing';
  return 'dash-status-pill dash-status-submitted';
}
function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StudentDashboardV2({ initialTab = 'dashboard', openSettings = false }: { initialTab?: DashboardTab; openSettings?: boolean }) {
  const { user: authUser, signOut: authSignOut } = useAuth();

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(!isSupabaseConfigured);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [savedItems, setSavedItems] = useState<DashboardSavedItem[]>([]);
  const [cgpaCourses, setCgpaCourses] = useState<CgpaCourseInput[]>([]);
  const [latestCgpaSnapshot, setLatestCgpaSnapshot] = useState<CgpaSnapshot | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [securityOpen, setSecurityOpen] = useState(openSettings);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  /* ---------------- data ---------------- */
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !session?.user) {
        if (isSupabaseConfigured && !authUser?.isLocal) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState({}, '', `/login?next=${encodeURIComponent(next)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }
        // Local preview session: only real locally-entered data, honest empty states elsewhere.
        const stored = readStoredProfile();
        if (!active) return;
        setIsLocalMode(true);
        setUserId('');
        setEmail(stored?.email || authUser?.email || '');
        setProfile({
          first_name: stored?.first_name || (authUser?.name || 'Student').split(/\s+/)[0],
          last_name: stored?.last_name || null,
          full_name: stored?.full_name || authUser?.name || 'Student',
          school: stored?.school || '',
          course_programme: stored?.course_programme || '',
          department: stored?.department || '',
          faculty: stored?.faculty || '',
          level: stored?.level || '',
          session: stored?.session || '',
          admission_year: stored?.admission_year || null,
          expected_graduation_year: stored?.expected_graduation_year || null,
          matric_number: stored?.matric_number || null,
          jamb_reg_no: stored?.jamb_reg_no || '',
          avatar_url: stored?.avatar_url || null,
          role: 'student',
        });
        setServices([]);
        setInstitutions([]);
        setRequests(readLocalServiceRequests());
        setAttempts(readLocalCbtAttempts());
        setSavedItems(readLocalSavedItems());
        setLoading(false);
        return;
      }

      const user = session.user;
      const [profileResult, serviceResult, institutionResult, requestResult, attemptsResult, savedResult, cgpaSnapshot] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('institutions').select('id,school_name,acronym,state,institution_type,website_url').order('school_name').limit(400),
        supabase.from('service_requests').select('id,status,form_data,created_at,reference_code,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('cbt_attempts').select('id,score,correct_answers,total_questions,submitted_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        fetchSavedItems(user.id),
        fetchLatestCgpaSnapshot(user.id),
      ]);
      if (!active) return;

      let adminSession = false;
      try {
        const adminResponse = await fetch('/api/admin/session', { headers: { Authorization: `Bearer ${session.access_token}` } });
        adminSession = adminResponse.ok;
      } catch {
        adminSession = false;
      }
      const metadataRole = String(user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase();
      const profileRole = String(profileResult.data?.role || metadataRole || '').toLowerCase();
      if (!active) return;

      setIsLocalMode(false);
      setUserId(user.id);
      setEmail(user.email || '');
      setIsAdminUser(adminSession || ['admin', 'super_admin', 'moderator'].includes(profileRole));
      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
        setMfaEnabled(Boolean(profileResult.data.mfa_enabled));
      } else {
        setProfile({ full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student', role: metadataRole || 'student' });
      }
      if (profileResult.error) setError('We could not load your profile. Please refresh or update your academic profile.');
      setServices((serviceResult.data || []) as ServiceRow[]);
      setInstitutions((institutionResult.data || []) as Institution[]);
      setRequests((requestResult.data || []) as RequestRow[]);
      setAttempts((attemptsResult.data || []) as Attempt[]);
      setSavedItems(savedResult);
      setLatestCgpaSnapshot(cgpaSnapshot);
      if (cgpaSnapshot?.courses?.length) setCgpaCourses(cgpaSnapshot.courses);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- tabs & URL ---------------- */
  const openTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setAccountSheetOpen(false);
    setProfileMenuOpen(false);
    const route = TAB_ROUTES[tab];
    if (`${window.location.pathname}` !== route) {
      window.history.pushState({}, '', route);
      document.title = `EduReach — ${pageTitleFor(route)}`;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Tab switches use a silent pushState, so the browser back button must
  // re-sync the view from the URL (the route props do not change in that case).
  useEffect(() => {
    const syncTabFromUrl = () => {
      const match = (Object.keys(TAB_ROUTES) as DashboardTab[]).find((tab) => TAB_ROUTES[tab] === window.location.pathname);
      if (match) setActiveTab(match);
    };
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  /* ---------------- derived ---------------- */
  const serviceMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const displayName = profile?.full_name || authUser?.name || 'Student';
  const firstName = profile?.first_name || displayName.split(/\s+/)[0];
  const profileBits = [profile?.school, profile?.course_programme || profile?.department, profile?.level].filter(Boolean) as string[];
  const requiredProfileValues = [profile?.school, profile?.course_programme, profile?.department, profile?.faculty, profile?.level, profile?.session];
  const profileComplete = requiredProfileValues.every((value) => Boolean(String(value || '').trim()));
  const requestTitle = (row: RequestRow) => String(row.form_data?.serviceTitle || serviceMap[row.service_id]?.title || 'EduReach Service');
  const openRequests = requests.filter((r) => !['completed', 'rejected', 'cancelled'].includes(r.status)).length;
  const averageScore = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / attempts.length) : 0;
  const bestScore = attempts.length ? Math.max(...attempts.map((a) => Number(a.score || 0))) : 0;
  const questionsAnswered = attempts.reduce((sum, a) => sum + Number(a.total_questions || 0), 0);
  const activeSaved = savedItems.filter((item) => item.saved);

  /* ---------------- actions ---------------- */
  const logout = async () => {
    await authSignOut();
    navigateInApp('/');
  };

  const isSavedItem = (type: DashboardSavedItemInput['type'], key: string) => activeSaved.some((item) => item.type === type && item.key === key);

  const saveItem = async (input: DashboardSavedItemInput) => {
    if (isSavedItem(input.type, input.key)) return;
    const optimistic: DashboardSavedItem = {
      id: `local-${input.type}-${input.key}`,
      key: input.key,
      type: input.type,
      name: input.name,
      detail: input.detail || '',
      location: input.location,
      href: input.href,
      saved: true,
      createdAt: new Date().toISOString(),
    };
    const next = [optimistic, ...savedItems];
    setSavedItems(next);
    if (isLocalMode || !userId) {
      writeLocalSavedItems(next);
      return;
    }
    const persisted = await upsertSavedItem(userId, input);
    if (persisted) setSavedItems((prev) => prev.map((item) => (item.id === optimistic.id ? persisted : item)));
    else {
      setSavedItems((prev) => prev.filter((item) => item.id !== optimistic.id));
      setNotice('We could not save that item online. Please try again.');
    }
  };

  const removeSaved = async (id: string) => {
    const item = savedItems.find((entry) => entry.id === id);
    if (!item) return;
    const next = savedItems.filter((entry) => entry.id !== id);
    setSavedItems(next);
    if (isLocalMode || !userId || id.startsWith('local-')) {
      writeLocalSavedItems(next);
      return;
    }
    try {
      await deleteSavedItem(id);
    } catch {
      setSavedItems((prev) => [item, ...prev]);
      setNotice('Unable to remove saved item. Please check your connection and try again.');
    }
  };

  /* ---------------- loading ---------------- */
  if (loading) {
    return (
      <div className="edureach-dash-container" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ margin: '0 auto 12px', display: 'flex', justifyContent: 'center' }}><BrandLogo height={48} radius="50%" /></div>
          <h1 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0f172a' }}>Loading your dashboard…</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Checking your session and syncing your records.</p>
        </div>
      </div>
    );
  }

  const adminStudentView =
    new URLSearchParams(window.location.search).get('view') === 'student' && window.sessionStorage.getItem('edureach-admin-student-view') === '1';

  /* ---------------- shared pieces ---------------- */
  const avatar = profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initials(displayName)}</span>;

  const accountLinks = (
    <>
      <a href="/profile" className="edureach-nav-item"><User size={15} /> Academic Profile</a>
      <button type="button" className="edureach-nav-item" onClick={() => { setSecurityOpen(true); setAccountSheetOpen(false); setProfileMenuOpen(false); }}>
        <Shield size={15} /> Security &amp; Password
      </button>
      {isAdminUser && <a href="/admin" className="edureach-nav-item"><ShieldCheck size={15} /> Admin Console</a>}
      <button type="button" className="edureach-nav-item is-danger" onClick={logout}><LogOut size={15} /> Sign Out</button>
    </>
  );

  const emptyState = (text: string, href: string, cta: string) => (
    <div className="dash-empty">
      <p>{text}</p>
      <a href={href} className="dash-btn dash-btn-primary">{cta}</a>
    </div>
  );

  const requestsTable = (rows: RequestRow[]) => (
    <>
      <div className="dash-table-wrap dash-desktop-only">
        <table className="dash-table">
          <thead>
            <tr><th>Reference</th><th>Service</th><th>Status</th><th>Date</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="dash-mono">{row.reference_code}</td>
                <td>{requestTitle(row)}</td>
                <td><span className={statusClass(row.status)}>{statusLabel(row.status)}</span></td>
                <td>{fmtDate(row.created_at)}</td>
                <td><a className="dash-card-link" href={`/dashboard/services?ref=${encodeURIComponent(row.reference_code)}`}>Track</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="dash-rows dash-mobile-only">
        {rows.map((row) => (
          <li key={row.id} className="dash-row">
            <div className="dash-row-top">
              <span className="dash-mono">{row.reference_code}</span>
              <span className={statusClass(row.status)}>{statusLabel(row.status)}</span>
            </div>
            <strong className="dash-row-title">{requestTitle(row)}</strong>
            <div className="dash-row-meta">
              <span>{fmtDate(row.created_at)}</span>
              <a className="dash-card-link" href={`/dashboard/services?ref=${encodeURIComponent(row.reference_code)}`}>Track status →</a>
            </div>
          </li>
        ))}
      </ul>
    </>
  );

  const attemptsTable = (rows: Attempt[]) => (
    <>
      <div className="dash-table-wrap dash-desktop-only">
        <table className="dash-table">
          <thead>
            <tr><th>Test</th><th>Score</th><th>Correct</th><th>Date</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.subject || 'CBT Practice'}</td>
                <td><strong>{Math.round(Number(row.score || 0))}%</strong></td>
                <td>{row.correct_answers}/{row.total_questions}</td>
                <td>{fmtDate(row.submitted_at || row.created_at)}</td>
                <td><a className="dash-card-link" href={`/cbt/results?attempt=${encodeURIComponent(row.id)}`}>Review</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="dash-rows dash-mobile-only">
        {rows.map((row) => (
          <li key={row.id} className="dash-row">
            <div className="dash-row-top">
              <strong className="dash-row-title">{row.subject || 'CBT Practice'}</strong>
              <span className="dash-row-score">{Math.round(Number(row.score || 0))}%</span>
            </div>
            <div className="dash-row-meta">
              <span>{row.correct_answers}/{row.total_questions} correct • {fmtDate(row.submitted_at || row.created_at)}</span>
              <a className="dash-card-link" href={`/cbt/results?attempt=${encodeURIComponent(row.id)}`}>Review →</a>
            </div>
          </li>
        ))}
      </ul>
    </>
  );

  /* ---------------- views ---------------- */
  const overview = (
    <>
      <section className="dash-welcome-card">
        <div className="dash-welcome-top">
          <div>
            <h1 className="dash-welcome-title">Welcome back, {firstName}</h1>
            <p className="dash-welcome-subtitle">
              {profileBits.length ? profileBits.join(' • ') : 'Complete your academic profile to personalise this dashboard.'}
            </p>
          </div>
          <a href="/profile" className="dash-btn dash-btn-secondary"><Edit size={13} /> {profileComplete ? 'Edit Profile' : 'Complete Profile'}</a>
        </div>
        <div className="dash-welcome-pills">
          <span className="dash-pill dash-pill-green"><ShieldCheck size={12} /> {isLocalMode ? 'Local session' : 'Verified student'}</span>
          {email && <span className="dash-pill">{email}</span>}
          {(profile?.jamb_reg_no || profile?.matric_number) && <span className="dash-pill dash-mono">{profile?.jamb_reg_no || profile?.matric_number}</span>}
        </div>
      </section>

      <section className="dash-profile-summary" aria-labelledby="saved-profile-heading">
        <div className="dash-section-head">
          <div>
            <h2 id="saved-profile-heading">Saved profile details</h2>
            <p>{profileComplete ? 'These details are used to personalise exam and service guidance.' : 'Add the missing details so exam and service guidance can be personalised.'}</p>
          </div>
          <a href="/profile" className="dash-card-link">{profileComplete ? 'Update details' : 'Complete profile'} <ChevronRight size={13} /></a>
        </div>
        <div className="dash-profile-detail-grid">
          {[
            ['Institution', profile?.school],
            ['Course / programme', profile?.course_programme],
            ['Department', profile?.department],
            ['Faculty', profile?.faculty],
            ['Level', profile?.level],
            ['Session', profile?.session],
          ].map(([label, value]) => (
            <div className="dash-profile-detail" key={label}>
              <span>{label}</span>
              <strong>{value || 'Not added yet'}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-quick-grid">
        <a href="/cbt" className="dash-quick-card">
          <div className="dash-quick-card-top"><MonitorPlay size={18} color="#C85841" /></div>
          <h3 className="dash-quick-card-title">Start a CBT test</h3>
          <span className="dash-quick-card-sub">JAMB • WAEC • NECO • Post-UTME</span>
        </a>
        <a href="/services" className="dash-quick-card">
          <div className="dash-quick-card-top"><FileText size={18} color="#1d4ed8" /></div>
          <h3 className="dash-quick-card-title">Request a service</h3>
          <span className="dash-quick-card-sub">NELFUND, results, slips</span>
        </a>
        <a href="/dashboard/services" className="dash-quick-card">
          <div className="dash-quick-card-top"><ScanSearch size={18} color="#059669" /></div>
          <h3 className="dash-quick-card-title">Track a request</h3>
          <span className="dash-quick-card-sub">Live status by reference</span>
        </a>
        <a href="/screening-calculator" className="dash-quick-card">
          <div className="dash-quick-card-top"><Calculator size={18} color="#7c3aed" /></div>
          <h3 className="dash-quick-card-title">Screening calculator</h3>
          <span className="dash-quick-card-sub">Estimate your aggregate</span>
        </a>
      </div>

      <section className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title"><ClipboardList size={14} className="dash-card-title-icon" /> Latest requests</h2>
          {requests.length > 0 && <button type="button" className="dash-card-link" onClick={() => openTab('services')}>View all ({requests.length})</button>}
        </div>
        {requests.length
          ? requestsTable(requests.slice(0, 3))
          : emptyState('No service requests yet. When you request NELFUND help, result checking, a JAMB slip or admission support, its live status appears here.', '/services', 'Browse services')}
      </section>

      <section className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title"><CheckSquare size={14} className="dash-card-title-icon" /> Latest CBT results</h2>
          {attempts.length > 0 && <button type="button" className="dash-card-link" onClick={() => openTab('cbt')}>View all ({attempts.length})</button>}
        </div>
        {attempts.length
          ? attemptsTable(attempts.slice(0, 3))
          : emptyState('No CBT attempts yet. Take a timed practice test and your scores will be tracked here.', '/cbt', 'Start a practice test')}
      </section>

      <a className="dash-help" href={`https://wa.me/${EDUREACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
        <strong>Need help with a request?</strong>
        <span>Chat with EduReach support on WhatsApp <ExternalLink size={12} /></span>
      </a>
    </>
  );

  const requestsView = (
    <section className="dash-card">
      <div className="dash-card-header">
        <div>
          <h1 className="dash-page-title">My Requests</h1>
          <p className="dash-page-sub">{requests.length ? `${requests.length} request${requests.length === 1 ? '' : 's'} • ${openRequests} in progress` : 'Every service request you submit is tracked here.'}</p>
        </div>
        <a href="/services" className="dash-btn dash-btn-primary">New request</a>
      </div>
      {requests.length
        ? requestsTable(requests)
        : emptyState('No service requests yet. Choose a service to get started — NELFUND loan support, WAEC/NECO result checking, JAMB slips or admission letters.', '/services', 'Browse services')}
    </section>
  );

  const cbtView = (
    <section className="dash-card">
      <div className="dash-card-header">
        <div>
          <h1 className="dash-page-title">My CBT</h1>
          <p className="dash-page-sub">Timed practice attempts across JAMB, WAEC, NECO and Post-UTME.</p>
        </div>
        <a href="/cbt" className="dash-btn dash-btn-primary">Start a test</a>
      </div>
      <div className="dash-metric-strip">
        <div className="dash-metric-card"><span className="dash-metric-label">Tests taken</span><span className="dash-metric-val">{attempts.length}</span></div>
        <div className="dash-metric-card"><span className="dash-metric-label">Average score</span><span className="dash-metric-val">{averageScore}%</span></div>
        <div className="dash-metric-card"><span className="dash-metric-label">Best score</span><span className="dash-metric-val">{bestScore}%</span></div>
        <div className="dash-metric-card"><span className="dash-metric-label">Questions answered</span><span className="dash-metric-val">{questionsAnswered}</span></div>
      </div>
      {attempts.length
        ? attemptsTable(attempts)
        : emptyState('No attempts yet. Your scores, best result and question count will build up here after your first practice test.', '/cbt', 'Start a practice test')}
    </section>
  );

  const toolsView = (
    <>
      <div className="dash-page-head">
        <h1 className="dash-page-title">Tools &amp; Saved</h1>
        <p className="dash-page-sub">Your CGPA calculator, the verified school directory and everything you have shortlisted.</p>
      </div>
      <div className="dash-tools-grid">
        <CgpaCalculatorCard userId={userId} isLocalMode={isLocalMode} initialCourses={cgpaCourses} latestSnapshot={latestCgpaSnapshot} onSnapshotSaved={setLatestCgpaSnapshot} />
        <SchoolFinderCard institutions={institutions} isSaved={isSavedItem} onSave={saveItem} />
      </div>
      <section className="dash-card" id="saved">
        <div className="dash-card-header">
          <h2 className="dash-card-title"><Bookmark size={14} className="dash-card-title-icon" /> Saved items</h2>
          <span className="dash-card-meta">{activeSaved.length} saved</span>
        </div>
        {activeSaved.length ? (
          <ul className="dash-list">
            {activeSaved.map((item) => (
              <li key={item.id} className="dash-list-row">
                <div className="dash-list-copy">
                  <strong>{item.name}</strong>
                  <span>{[item.detail, item.location].filter(Boolean).join(' • ') || statusLabel(item.type)}</span>
                </div>
                <div className="dash-list-actions">
                  {item.href && <a className="dash-btn dash-btn-small dash-btn-secondary" href={item.href} target={item.href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">Open</a>}
                  <button type="button" className="dash-icon-btn" aria-label={`Remove ${item.name}`} onClick={() => removeSaved(item.id)}><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dash-empty"><p>Nothing saved yet. Use the School Finder above to shortlist institutions you are considering.</p></div>
        )}
      </section>
    </>
  );

  const view = activeTab === 'services' ? requestsView : activeTab === 'cbt' ? cbtView : activeTab === 'tools' ? toolsView : overview;

  /* ---------------- render ---------------- */
  return (
    <div className="edureach-dash-container">
      {adminStudentView && (
        <div className="er-admin-view-banner" role="note">
          <span>Admin preview — you are browsing the student portal as a student.</span>
          <button type="button" onClick={() => { window.sessionStorage.removeItem('edureach-admin-student-view'); navigateInApp('/admin'); }}>← Return to admin</button>
        </div>
      )}

      <header className="edureach-dash-header">
        <div className="edureach-dash-bar">
          <a href="/" className="edureach-dash-brand" aria-label="EduReach home"><BrandLogo height={36} radius="50%" /></a>

          <form
            className="edureach-dash-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchTerm.trim();
              navigateInApp(q ? `/services?q=${encodeURIComponent(q)}` : '/services');
            }}
          >
            <Search size={15} className="edureach-dash-search-icon" />
            <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search services…" aria-label="Search services" />
          </form>

          <div className="edureach-dash-actions">
            <a href="/" className="dash-btn dash-btn-secondary dash-hide-mobile">Student site</a>
            <div style={{ position: 'relative' }}>
              <button type="button" className="edureach-dash-profile-btn" onClick={() => setProfileMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={profileMenuOpen}>
                <div className="edureach-dash-avatar">{avatar}</div>
                <span className="edureach-dash-profile-name">{firstName}</span>
              </button>
              {profileMenuOpen && (
                <div className="dash-menu" role="menu">
                  <div className="dash-menu-head">
                    <strong>{displayName}</strong>
                    {email && <span>{email}</span>}
                  </div>
                  {accountLinks}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="edureach-dash-body">
        <aside className="edureach-dash-sidebar" aria-label="Dashboard navigation">
          {NAV.map(({ tab, label, Icon }) => (
            <button key={tab} type="button" className={`edureach-nav-item ${activeTab === tab ? 'active' : ''}`} onClick={() => openTab(tab)} aria-current={activeTab === tab ? 'page' : undefined}>
              <Icon size={15} /> {label}
              {tab === 'services' && openRequests > 0 && <span className="edureach-nav-item-badge">{openRequests}</span>}
            </button>
          ))}
          <div className="dash-nav-divider" />
          {accountLinks}
        </aside>

        <main className="edureach-dash-main" id="dashboard-main">
          {error && <div className="dash-note is-error">{error}</div>}
          {notice && (
            <div className="dash-note is-error" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
            </div>
          )}
          {view}
        </main>
      </div>

      <nav className="edureach-bottom-nav" aria-label="Dashboard">
        <div className="edureach-bottom-nav-inner">
          {NAV.map(({ tab, short, Icon }) => (
            <button key={tab} type="button" className={`edureach-bottom-link ${activeTab === tab && !accountSheetOpen ? 'active' : ''}`} onClick={() => openTab(tab)}>
              <Icon size={18} /> {short}
            </button>
          ))}
          <button type="button" className={`edureach-bottom-link ${accountSheetOpen ? 'active' : ''}`} onClick={() => setAccountSheetOpen((open) => !open)} aria-expanded={accountSheetOpen}>
            <User size={18} /> Account
          </button>
        </div>
      </nav>

      {accountSheetOpen && (
        <div className="dash-sheet-backdrop" onClick={() => setAccountSheetOpen(false)}>
          <div className="dash-sheet" role="dialog" aria-label="Account" onClick={(e) => e.stopPropagation()}>
            <div className="dash-sheet-head">
              <div className="edureach-dash-avatar">{avatar}</div>
              <div>
                <strong>{displayName}</strong>
                {email && <span>{email}</span>}
              </div>
            </div>
            {accountLinks}
          </div>
        </div>
      )}

      <SecurityModal open={securityOpen} onClose={() => setSecurityOpen(false)} userId={userId} isLocalMode={isLocalMode} mfaEnabled={mfaEnabled} onMfaChange={setMfaEnabled} />
    </div>
  );
}
