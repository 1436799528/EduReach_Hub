import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Plus,
  Search,
  Wallet,
  Shield,
  KeyRound,
  Smartphone,
  LogOut,
  Laptop,
  CheckCircle2,
  Clock,
  Sparkles,
  School,
  GraduationCap,
  ExternalLink,
  Edit,
  X,
  Bell,
  BookOpen,
  ClipboardList,
  Bookmark,
  Award,
  Wrench,
  Settings,
  User,
  MoreVertical,
  ChevronRight,
  TrendingUp,
  FileText,
  AlertCircle,
  HelpCircle,
  Calculator,
  Compass,
  BookmarkCheck,
  LayoutDashboard,
  CheckSquare,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import WalletModal from '../src/components/WalletModal';
import {
  calculateCgpa,
  createNotification,
  deleteSavedItem,
  fetchLatestCgpaSnapshot,
  fetchNotifications,
  fetchSavedItems,
  markNotificationsRead,
  recordSecurityEvent,
  saveCgpaSnapshot,
  upsertSavedItem,
  type CgpaCourseInput,
  type CgpaSnapshot,
  type DashboardNotification,
  type DashboardSavedItem,
  type DashboardSavedItemInput,
} from '../src/lib/studentDashboard';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { useAuth } from '../src/lib/auth';
import '../src/student-dashboard.css';

type Profile = {
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  account_type?: 'student' | 'parent' | 'teacher' | null;
  school: string;
  course_programme?: string | null;
  faculty?: string | null;
  department: string;
  level: string;
  admission_year?: number | null;
  expected_graduation_year?: number | null;
  matric_number: string | null;
  role: string;
  phone?: string | null;
  jamb_reg_no?: string | null;
  target_exam?: string | null;
  academic_interests?: string[] | null;
  avatar_url?: string | null;
  notification_preferences?: {
    email_alerts?: boolean;
    whatsapp_alerts?: boolean;
    sms_alerts?: boolean;
  } | null;
};

type ServiceRow = { id: string; service_key: string; title: string };
type RequestRow = { id: string; status: string; form_data: Record<string, unknown>; created_at: string; reference_code: string; service_id: string };
type WalletState = { balance: number; currency: string };
type Attempt = { id: string; score: number | null; correct_answers: number; total_questions: number; submitted_at: string | null; created_at: string; subject?: string };
type AccessedService = { key: string; title: string; href: string; category: string; lastAccessedAt: string; count: number };

export type DashboardTab =
  | 'dashboard'
  | 'services'
  | 'applications'
  | 'saved'
  | 'cbt'
  | 'past-questions'
  | 'admission'
  | 'scholarships'
  | 'tools'
  | 'notifications'
  | 'profile'
  | 'settings';

type TabType = DashboardTab;


const emptySavedItems: DashboardSavedItem[] = [];
const emptyNotifications: DashboardNotification[] = [];
const emptyCgpaCourses: CgpaCourseInput[] = [];

function readAccessedServices(): AccessedService[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('edureach-accessed-services') || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function readLocalServiceRequests(): RequestRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('edureach-service-requests') || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => ({
      id: String(item.id || `local-${item.reference_code}`),
      service_id: String(item.service_id || item.form_data?.serviceSlug || 'local-service'),
      status: String(item.status || 'submitted'),
      reference_code: String(item.reference_code || 'ER-LOCAL'),
      created_at: String(item.created_at || new Date().toISOString()),
      form_data: {
        ...(item.form_data || {}),
        serviceTitle: item.form_data?.serviceTitle || item.service_catalog?.title || 'EduReach Service',
      },
    })).slice(0, 8);
  } catch {
    return [];
  }
}

function readLocalCbtAttempts(): Attempt[] {
  try {
    const attempts: Attempt[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('edureach-cbt-result-')) continue;
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      if (!stored?.attempt) continue;
      attempts.push({
        id: String(stored.attempt.id || key.replace('edureach-cbt-result-', '')),
        score: Number(stored.attempt.score || 0),
        correct_answers: Number(stored.attempt.correct_answers || 0),
        total_questions: Number(stored.attempt.total_questions || stored.questions?.length || 0),
        submitted_at: stored.attempt.submitted_at || null,
        created_at: stored.attempt.submitted_at || new Date().toISOString(),
        subject: stored.exam?.subject || stored.attempt.exam_id || 'CBT Practice',
      });
    }
    return attempts.sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()).slice(0, 8);
  } catch {
    return [];
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ER';
}
function fmtDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StudentDashboardV2({ initialTab = 'dashboard', openSettings = false }: { initialTab?: DashboardTab; openSettings?: boolean }) {
  const { user: authUser, signOut: authSignOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [institutions, setInstitutions] = useState<Array<{ id: string; school_name: string; acronym?: string | null; state?: string | null; institution_type?: string | null; website_url?: string | null }>>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('Student');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Panels
  const [walletOpen, setWalletOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cgpaModalOpen, setCgpaModalOpen] = useState(false);
  const [schoolFinderOpen, setSchoolFinderOpen] = useState(false);
  const [courseFinderOpen, setCourseFinderOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Security State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);

  const [userId, setUserId] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(!isSupabaseConfigured);
  const [dashboardNotice, setDashboardNotice] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Saved Schools & Courses state
  const [savedItems, setSavedItems] = useState<DashboardSavedItem[]>(emptySavedItems);

  // Recently accessed services/tools state
  const [accessedServices, setAccessedServices] = useState<AccessedService[]>(() => readAccessedServices());

  // Notifications state
  const [notifications, setNotifications] = useState<DashboardNotification[]>(emptyNotifications);

  // CGPA Calculator local state
  const [cgpaCourses, setCgpaCourses] = useState<CgpaCourseInput[]>(emptyCgpaCourses);
  const [latestCgpaSnapshot, setLatestCgpaSnapshot] = useState<CgpaSnapshot | null>(null);
  const [cgpaSaving, setCgpaSaving] = useState(false);
  const [cgpaSaveMessage, setCgpaSaveMessage] = useState('');

  // School Finder filter state
  const [schoolFilterQuery, setSchoolFilterQuery] = useState('');
  const [schoolTypeFilter, setSchoolTypeFilter] = useState('ALL');

  // Course Finder query state
  const [courseFilterQuery, setCourseFilterQuery] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const {
        data: { session: currentSession },
        error: authError,
      } = await supabase.auth.getSession();

      // Check locally saved profile if exists
      let locallySavedProfile: any = null;
      try {
        locallySavedProfile = JSON.parse(localStorage.getItem('edureach-student-profile') || 'null');
      } catch {
        locallySavedProfile = null;
      }

      if (authError || !currentSession?.user) {
        if (isSupabaseConfigured && !authUser?.isLocal) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState({}, '', `/login?next=${encodeURIComponent(next)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }

        // Local preview/offline session: use only real locally-entered account data and empty states.
        setIsLocalMode(true);
        setUserId('');
        setEmail(locallySavedProfile?.email || authUser?.email || '');
        setUserName(locallySavedProfile?.full_name || authUser?.name || 'Student');
        setProfile({
          first_name: locallySavedProfile?.first_name || (authUser?.name || 'Student').split(/\s+/)[0] || 'Student',
          last_name: locallySavedProfile?.last_name || null,
          full_name: locallySavedProfile?.full_name || authUser?.name || 'Student',
          account_type: locallySavedProfile?.account_type || 'student',
          school: locallySavedProfile?.school || '',
          course_programme: locallySavedProfile?.course_programme || '',
          faculty: locallySavedProfile?.faculty || '',
          department: locallySavedProfile?.department || '',
          level: locallySavedProfile?.level || '',
          admission_year: locallySavedProfile?.admission_year || null,
          expected_graduation_year: locallySavedProfile?.expected_graduation_year || null,
          matric_number: locallySavedProfile?.matric_number || null,
          role: 'student',
          phone: locallySavedProfile?.phone || '',
          jamb_reg_no: locallySavedProfile?.jamb_reg_no || '',
          target_exam: locallySavedProfile?.target_exam || '',
          academic_interests: locallySavedProfile?.academic_interests || [],
          avatar_url: locallySavedProfile?.avatar_url || null,
          notification_preferences: locallySavedProfile?.notification_preferences || { email_alerts: false, whatsapp_alerts: false, sms_alerts: false },
        });

        setServices([]);
        setInstitutions([]);
        setRequests([]);
        setWallet(null);
        setSavedItems(emptySavedItems);
        setAccessedServices(readAccessedServices());
        setNotifications(emptyNotifications);
        setCgpaCourses(emptyCgpaCourses);
        setLatestCgpaSnapshot(null);
        setAttempts(readLocalCbtAttempts());
        setLoading(false);
        return;
      }

      const user = currentSession.user;
      setIsLocalMode(false);
      setUserId(user.id);
      setEmail(user.email || '');
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student');

      const [
        profileResult,
        serviceResult,
        institutionResult,
        requestResult,
        walletResult,
        attemptsResult,
        savedResult,
        notificationResult,
        cgpaSnapshot,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('institutions').select('id,school_name,acronym,state,institution_type,website_url').order('school_name').limit(329),
        supabase.from('service_requests').select('id,status,form_data,created_at,reference_code,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
        supabase.from('student_wallets').select('balance,currency').eq('user_id', user.id).maybeSingle(),
        supabase.from('cbt_attempts').select('id,score,correct_answers,total_questions,submitted_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
        fetchSavedItems(user.id),
        fetchNotifications(user.id),
        fetchLatestCgpaSnapshot(user.id),
      ]);

      if (!active) return;
      const metadataRole = String(currentSession.user.app_metadata?.role || currentSession.user.user_metadata?.role || '').toLowerCase();
      let adminSession = false;
      try {
        const adminResponse = await fetch('/api/admin/session', { headers: { Authorization: `Bearer ${currentSession.access_token}` } });
        adminSession = adminResponse.ok;
      } catch {
        adminSession = false;
      }
      setIsAdminUser(adminSession || ['admin', 'super_admin', 'moderator'].includes(metadataRole));
      if (profileResult.data) {
        setProfile({ ...(profileResult.data as Profile), role: metadataRole || String(profileResult.data.role || 'student') });
        setMfaEnabled(Boolean(profileResult.data.mfa_enabled));
      } else {
        setProfile({
          full_name: currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || 'Student',
          school: '', course_programme: '', faculty: '', department: '', level: '', matric_number: null,
          role: metadataRole || 'student', phone: '', jamb_reg_no: '', target_exam: '', academic_interests: [], avatar_url: null,
        });
      }

      if (profileResult.error) setError('We could not load your profile. Please refresh or update your academic profile.');
      setServices((serviceResult.data || []) as ServiceRow[]);
      setInstitutions((institutionResult.data || []) as typeof institutions);
      setRequests((requestResult.data || []) as RequestRow[]);
      if (walletResult.data) setWallet({ balance: Number(walletResult.data.balance), currency: walletResult.data.currency });
      setAttempts((attemptsResult.data || []) as Attempt[]);
      setSavedItems(savedResult.length ? savedResult : []);
      setAccessedServices(readAccessedServices());
      setNotifications(notificationResult.length ? notificationResult : []);
      setLatestCgpaSnapshot(cgpaSnapshot);
      if (cgpaSnapshot?.courses?.length) setCgpaCourses(cgpaSnapshot.courses);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncAccessed = () => setAccessedServices(readAccessedServices());
    window.addEventListener('edureach-activity-changed', syncAccessed);
    window.addEventListener('storage', syncAccessed);
    return () => {
      window.removeEventListener('edureach-activity-changed', syncAccessed);
      window.removeEventListener('storage', syncAccessed);
    };
  }, []);

  const serviceMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const displayName = profile?.full_name || userName;
  const profileSummaryItems = [profile?.school, profile?.course_programme || profile?.department, profile?.level].filter(Boolean);
  const reg = profile?.jamb_reg_no || profile?.matric_number || '';
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attempts.length)
    : 0;
  const bestScore = attempts.length ? Math.max(...attempts.map((item) => Number(item.score || 0))) : 0;
  const pastQuestionsSolved = attempts.reduce((sum, item) => sum + Number(item.total_questions || 0), 0);
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;
  const savedItemsCount = savedItems.filter((item) => item.saved).length;
  const savedScholarships = savedItems.filter((item) => item.saved && item.type === 'scholarship');
  const currentCgpa = useMemo(() => calculateCgpa(cgpaCourses), [cgpaCourses]);
  const walletBalanceLabel = wallet ? `₦${wallet.balance.toLocaleString()}` : 'Not enabled';
  const walletStatusLabel = wallet ? 'ACTIVE' : 'UNAVAILABLE';
  const recentActivities = useMemo(() => {
    const activities: Array<{ id: string; kind: 'attempt' | 'saved' | 'request' | 'cgpa'; title: string; time: string }> = [];
    const latestAttempt = attempts[0];
    if (latestAttempt) {
      activities.push({
        id: `attempt-${latestAttempt.id}`,
        kind: 'attempt',
        title: `Completed ${latestAttempt.subject || 'CBT practice'} (Score: ${latestAttempt.score || 0}%)`,
        time: fmtDate(latestAttempt.submitted_at || latestAttempt.created_at),
      });
    }
    const latestSaved = savedItems[0];
    if (latestSaved) {
      activities.push({
        id: `saved-${latestSaved.id}`,
        kind: 'saved',
        title: `Saved ${latestSaved.name} to your shortlist`,
        time: latestSaved.createdAt ? fmtDate(latestSaved.createdAt) : 'Recently',
      });
    }
    const latestRequest = requests[0];
    if (latestRequest) {
      const title = String(latestRequest.form_data?.serviceTitle || serviceMap[latestRequest.service_id]?.title || 'EduReach Service');
      activities.push({
        id: `request-${latestRequest.id}`,
        kind: 'request',
        title: `Submitted ${title} (Ref: ${latestRequest.reference_code})`,
        time: fmtDate(latestRequest.created_at),
      });
    }
    if (latestCgpaSnapshot) {
      activities.push({
        id: `cgpa-${latestCgpaSnapshot.id}`,
        kind: 'cgpa',
        title: `Saved CGPA snapshot (${latestCgpaSnapshot.gpa}/5.00)`,
        time: fmtDate(latestCgpaSnapshot.createdAt),
      });
    }
    return activities;
  }, [attempts, latestCgpaSnapshot, requests, savedItems, serviceMap]);

  const copyReg = () => {
    if (!reg) return;
    navigator.clipboard?.writeText(reg);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const logout = async () => {
    await authSignOut();
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const addLocalNotification = (title: string, type = 'system') => {
    const notification: DashboardNotification = {
      id: `local-${Date.now()}`,
      title,
      time: 'Just now',
      read: false,
      type,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [notification, ...prev].slice(0, 20));
  };

  const isSavedItem = (type: DashboardSavedItemInput['type'], key: string) =>
    savedItems.some((item) => item.saved && item.type === type && item.key === key);

  const saveDashboardItem = async (input: DashboardSavedItemInput) => {
    if (isSavedItem(input.type, input.key)) return;

    const optimistic: DashboardSavedItem = {
      id: `temp-${input.type}-${input.key}`,
      key: input.key,
      type: input.type,
      name: input.name,
      detail: input.detail || '',
      location: input.location,
      href: input.href,
      saved: true,
      createdAt: new Date().toISOString(),
    };

    setSavedItems((prev) => [optimistic, ...prev]);
    addLocalNotification(`${input.name} saved to your dashboard shortlist.`, 'saved');

    if (isLocalMode || !userId) return;

    const persisted = await upsertSavedItem(userId, input);
    if (persisted) {
      setSavedItems((prev) => prev.map((item) => (item.id === optimistic.id ? persisted : item)));
      void createNotification(userId, {
        title: `${input.name} saved to your dashboard shortlist.`,
        type: 'saved',
        href: input.href,
      });
    } else {
      setSavedItems((prev) => prev.filter((item) => item.id !== optimistic.id));
      setDashboardNotice('We could not save that item online. Please try again.');
    }
  };

  const toggleSave = async (id: string) => {
    const item = savedItems.find((entry) => entry.id === id);
    if (!item) return;

    setSavedItems((prev) => prev.filter((entry) => entry.id !== id));
    if (isLocalMode || !userId || id.startsWith('local-') || id.startsWith('temp-')) return;

    try {
      await deleteSavedItem(id);
    } catch (err) {
      setSavedItems((prev) => [item, ...prev]);
      setDashboardNotice('Unable to remove saved item. Please check your connection and try again.');
    }
  };

  const markAllNotifsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (isLocalMode || !userId) return;
    try {
      await markNotificationsRead(userId);
    } catch (err) {
      setDashboardNotice('Unable to sync notification read state right now.');
    }
  };

  // CGPA calculation
  const calculateCGPA = () => currentCgpa.gpaText;

  const handleSaveCgpaSnapshot = async () => {
    setCgpaSaving(true);
    setCgpaSaveMessage('');
    try {
      if (isLocalMode || !userId) {
        setLatestCgpaSnapshot({
          id: `local-cgpa-${Date.now()}`,
          termLabel: 'Current Semester',
          gpa: currentCgpa.gpaText,
          totalUnits: currentCgpa.totalUnits,
          classification: currentCgpa.classification,
          createdAt: new Date().toISOString(),
          courses: cgpaCourses,
        });
        setCgpaSaveMessage('CGPA is available in preview mode only. Sign in with Supabase to save it to your student account.');
        return;
      }

      const snapshot = await saveCgpaSnapshot(userId, cgpaCourses);
      setLatestCgpaSnapshot(snapshot);
      setCgpaSaveMessage('CGPA snapshot saved to your student portal.');
      const notification = await createNotification(userId, {
        title: `CGPA snapshot saved: ${snapshot.gpa}/5.00`,
        type: 'tools',
      });
      if (notification) setNotifications((prev) => [notification, ...prev]);
    } catch (err) {
      setCgpaSaveMessage(err instanceof Error ? err.message : 'Unable to save CGPA snapshot.');
    } finally {
      setCgpaSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      setPasswordBusy(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      setPasswordBusy(false);
      return;
    }

    try {
      if (!isLocalMode) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        if (userId) void recordSecurityEvent(userId, 'password_changed', 'Password changed from student dashboard');
      }
      setPasswordMessage(isLocalMode ? 'Password validated for this local account session.' : 'Password updated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Password update failed. Please try again.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSignOutOtherDevices = async () => {
    setSessionRevoked(false);
    try {
      if (!isLocalMode) {
        const { error } = await supabase.auth.signOut({ scope: 'others' });
        if (error) throw error;
        if (userId) void recordSecurityEvent(userId, 'sessions_revoked', 'Other sessions revoked from student dashboard');
      }
      setSessionRevoked(true);
      window.setTimeout(() => setSessionRevoked(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to sign out other devices right now.');
    }
  };

  const handleMfaToggle = async () => {
    const nextValue = !mfaEnabled;
    setMfaEnabled(nextValue);
    if (isLocalMode || !userId) return;

    const { error: updateError } = await supabase.from('profiles').update({ mfa_enabled: nextValue }).eq('id', userId);
    if (updateError) {
      setMfaEnabled(!nextValue);
      setPasswordError(updateError.message);
      return;
    }
    void recordSecurityEvent(userId, nextValue ? 'mfa_enabled' : 'mfa_disabled', `MFA ${nextValue ? 'enabled' : 'disabled'} from student dashboard`);
  };

  const itemKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // School Finder uses the verified institution directory from Supabase.
  const filteredSchools = institutions.filter((school) => {
    const haystack = [school.school_name, school.acronym, school.state].filter(Boolean).join(' ').toLowerCase();
    const matchQuery = haystack.includes(schoolFilterQuery.toLowerCase());
    if (schoolTypeFilter === 'ALL') return matchQuery;
    return matchQuery && String(school.institution_type || '').toLowerCase().includes(schoolTypeFilter.toLowerCase());
  });

  // Course Finder must not display fabricated cut-offs or requirements. Until the academic
  // course directory is populated, show an honest empty state rather than mock records.
  const coursesList: Array<{ name: string; faculty: string; cutOff: number; utme: string; olevel: string }> = [];
  const filteredCourses = coursesList.filter((course) =>
    course.name.toLowerCase().includes(courseFilterQuery.toLowerCase()) || course.faculty.toLowerCase().includes(courseFilterQuery.toLowerCase())
  );

  const navigateInApp = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const routeForTab: Partial<Record<TabType, string>> = {
    dashboard: '/dashboard',
    services: '/dashboard/services',
    applications: '/dashboard/applications',
    saved: '/dashboard/saved',
    cbt: '/dashboard/cbt',
    'past-questions': '/dashboard/past-questions',
    scholarships: '/dashboard/scholarships',
    tools: '/dashboard/tools',
    notifications: '/dashboard/notifications',
    profile: '/profile',
    settings: '/settings',
  };

  const openDashboardTab = (tab: TabType, syncUrl = true) => {
    if (tab === 'profile') return navigateInApp('/profile');
    if (tab === 'admission') return navigateInApp('/admission');

    setActiveTab(tab);
    if (tab === 'settings') setSecurityOpen(true);
    if (syncUrl && routeForTab[tab] && `${window.location.pathname}${window.location.search}` !== routeForTab[tab]) {
      window.history.pushState({}, '', routeForTab[tab]!);
    }

    const targetId: Partial<Record<TabType, string>> = {
      dashboard: 'dashboard-overview',
      services: 'services',
      applications: 'applications',
      saved: 'saved',
      cbt: 'cbt',
      'past-questions': 'past-questions',
      scholarships: 'scholarships',
      tools: 'tools',
      notifications: 'notifications',
      settings: 'dashboard-overview',
    };
    window.requestAnimationFrame(() => {
      const target = targetId[tab] ? document.getElementById(targetId[tab]!) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  useEffect(() => {
    if (loading) return;
    if (openSettings) setSecurityOpen(true);
    openDashboardTab(initialTab, false);
  }, [initialTab, loading, openSettings]);

  if (loading) {
    return (
      <div className="edureach-dash-container" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', textAlign: 'center', maxWidth: '420px' }}>
          <div className="edureach-dash-logo-icon" style={{ margin: '0 auto 12px' }}>ER</div>
          <h1 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0f172a' }}>Loading your student workspace…</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Checking your secure session and syncing dashboard records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edureach-dash-container">
      {/* 1. CLEAN NORMAL HEADER (No green utility strip) */}
      <header className="edureach-dash-header">
        <div className="edureach-dash-bar">
          {/* LOGO */}
          <a href="/" className="edureach-dash-brand">
            <div className="edureach-dash-logo-icon">ER</div>
            <span>
              EduReach<span style={{ color: '#D9381E' }}>.ng</span>
            </span>
          </a>

          {/* SEARCH BAR (Middle) */}
          <div className="edureach-dash-search">
            <Search size={15} className="edureach-dash-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search services, CBT tests, schools, scholarships…"
              aria-label="Search dashboard"
            />
          </div>

          {/* ACTIONS: 🔔 NOTIFICATIONS + PROFILE + THREE-DOT (MOBILE ONLY) */}
          <div className="edureach-dash-actions">
            {/* NOTIFICATION BELL */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="edureach-dash-btn-icon"
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell size={17} />
                {unreadNotifsCount > 0 && <span className="edureach-dash-badge">{unreadNotifsCount}</span>}
              </button>

              {/* NOTIFICATIONS DROPDOWN */}
              {notifDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '320px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <strong style={{ fontSize: '12px', color: '#0f172a' }}>Personalized Alerts</strong>
                    {unreadNotifsCount > 0 && (
                      <button
                        onClick={markAllNotifsRead}
                        style={{ background: 'none', border: 0, color: '#059669', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {!notifications.length && (
                      <div style={{ padding: '18px 14px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                        No notifications yet. Saved schools, CGPA snapshots, service updates, and CBT reminders will appear here.
                      </div>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          background: n.read ? '#ffffff' : '#f0fdf4',
                        }}
                      >
                        <strong style={{ fontSize: '11.5px', color: '#0f172a', display: 'block', lineHeight: 1.3 }}>{n.title}</strong>
                        <small style={{ fontSize: '10px', color: '#64748b', marginTop: '3px', display: 'block' }}>{n.time}</small>
                      </div>
                    ))}
                  </div>
                  <a
                    href="#notifications"
                    onClick={() => {
                      openDashboardTab('notifications');
                      setNotifDropdownOpen(false);
                    }}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#059669',
                      textDecoration: 'none',
                      background: '#f8fafc',
                    }}
                  >
                    View All Notifications →
                  </a>
                </div>
              )}
            </div>

            {/* PROFILE MENU DROPDOWN */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="edureach-dash-profile-btn"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                <div className="edureach-dash-avatar">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" />
                  ) : (
                    initials(displayName)
                  )}
                </div>
                <span className="edureach-dash-profile-name">{profile?.first_name || displayName}</span>
              </button>

              {profileDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '240px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    padding: '8px',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '12.5px', display: 'block', color: '#0f172a' }}>{displayName}</strong>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>{profile?.school || 'Student account'}</span>
                  </div>

                  <button
                    onClick={() => {
                      setWalletOpen(true);
                      setProfileDropdownOpen(false);
                    }}
                    className="edureach-nav-item"
                    style={{ padding: '6px 10px' }}
                  >
                    <Wallet size={14} color="#059669" /> Wallet: {walletBalanceLabel}
                  </button>
                  <a
                    href="/profile"
                    className="edureach-nav-item"
                    style={{ padding: '6px 10px' }}
                  >
                    <User size={14} /> Academic Profile
                  </a>
                  <button
                    onClick={() => {
                      setSecurityOpen(true);
                      setProfileDropdownOpen(false);
                    }}
                    className="edureach-nav-item"
                    style={{ padding: '6px 10px' }}
                  >
                    <Shield size={14} /> Security &amp; Settings
                  </button>
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '6px', paddingTop: '6px' }}>
                    <button
                      onClick={logout}
                      className="edureach-nav-item"
                      style={{ padding: '6px 10px', color: '#dc2626' }}
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* THREE-DOT TRIGGER: ONLY VISIBLE ON MOBILE */}
            <button
              type="button"
              className="edureach-dash-btn-icon hub-mobile-trigger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mobile dashboard menu"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. THREE-COLUMN DESKTOP LAYOUT (Sidebar + Main + Right Rail) */}
      <div className="edureach-dash-body">
        {/* DESKTOP SIDEBAR:
            Dashboard → Applications → Saved → CBT → Past Questions → Admission → Scholarships → Tools → Notifications → Profile → Settings */}
        <aside className="edureach-dash-sidebar">
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => openDashboardTab('dashboard')}
          >
            <LayoutDashboard size={15} /> Dashboard
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => openDashboardTab('services')}
          >
            <FileText size={15} /> Services
            {requests.length > 0 && <span className="edureach-nav-item-badge">{requests.length}</span>}
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => openDashboardTab('applications')}
          >
            <ClipboardList size={15} /> Applications
            {requests.length > 0 && <span className="edureach-nav-item-badge">{requests.length}</span>}
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => openDashboardTab('saved')}
          >
            <Bookmark size={15} /> Saved
            <span className="edureach-nav-item-badge">{savedItemsCount}</span>
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'cbt' ? 'active' : ''}`}
            onClick={() => openDashboardTab('cbt')}
          >
            <CheckSquare size={15} /> CBT Practice
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'past-questions' ? 'active' : ''}`}
            onClick={() => openDashboardTab('past-questions')}
          >
            <BookOpen size={15} /> Past Questions
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'admission' ? 'active' : ''}`}
            onClick={() => openDashboardTab('admission')}
          >
            <GraduationCap size={15} /> Admission
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'scholarships' ? 'active' : ''}`}
            onClick={() => openDashboardTab('scholarships')}
          >
            <Award size={15} /> Scholarships
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => openDashboardTab('tools')}
          >
            <Wrench size={15} /> Tools &amp; Calc
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => openDashboardTab('notifications')}
          >
            <Bell size={15} /> Notifications
            {unreadNotifsCount > 0 && <span className="edureach-nav-item-badge">{unreadNotifsCount}</span>}
          </button>
          <a
            href="/profile"
            className={`edureach-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <User size={15} /> Profile
          </a>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSecurityOpen(true)}
          >
            <Settings size={15} /> Settings
          </button>

          {(isAdminUser || (profile?.role && ['admin', 'super_admin', 'moderator'].includes(String(profile.role).toLowerCase()))) && (
            <div className="edureach-admin-nav-group" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
              <a href="/admin" className="edureach-nav-item" style={{ color: '#b91c1c', fontWeight: 800 }}>
                <Shield size={15} /> Admin Panel
              </a>
              <a href="/admin/analytics" className="edureach-nav-item edureach-admin-subitem">Analytics &amp; Reports</a>
              <a href="/admin/queue" className="edureach-nav-item edureach-admin-subitem">Service Queue</a>
              <a href="/admin/cbt" className="edureach-nav-item edureach-admin-subitem">CBT Question Bank</a>
              <a href="/admin/vouchers" className="edureach-nav-item edureach-admin-subitem">Scratch Card Inventory</a>
              <a href="/admin/users" className="edureach-nav-item edureach-admin-subitem">Student Accounts</a>
            </div>
          )}
        </aside>

        {/* MAIN DASHBOARD STREAM */}
        <main className="edureach-dash-main">
          {(error || dashboardNotice) && (
            <div
              style={{
                background: error ? '#fef2f2' : '#FFF8DF',
                border: error ? '1px solid #fecaca' : '1px solid #fef08a',
                color: error ? '#b91c1c' : '#92400e',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                fontWeight: 700,
                marginBottom: '12px',
              }}
            >
              {error || dashboardNotice}
            </div>
          )}


          {/* SECTION 1: WELCOME / PROFILE SUMMARY */}
          <section className="dash-welcome-card" id="dashboard-overview">
            <div className="dash-welcome-top">
              <div>
                <h1 className="dash-welcome-title">Welcome back, {profile?.first_name || displayName}</h1>
                <p className="dash-welcome-subtitle">
                  {profileSummaryItems.length ? (
                    profileSummaryItems.map((item, index) => (
                      <span key={item}>
                        {index > 0 && ' • '}{item}
                      </span>
                    ))
                  ) : (
                    <span>Complete your academic profile to personalize this dashboard.</span>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="/profile"
                  className="dash-pill"
                  style={{ textDecoration: 'none', color: '#059669', borderColor: '#a7f3d0' }}
                >
                  <Edit size={11} /> Edit Profile
                </a>
              </div>
            </div>

            <div className="dash-welcome-pills">
              <span className="dash-pill dash-pill-green">
                <Shield size={11} /> Verified {profile?.account_type ? profile.account_type.toUpperCase() : 'STUDENT'}
              </span>

              {reg && (
                <button
                  onClick={copyReg}
                  className="dash-pill"
                  style={{ cursor: 'pointer', background: '#ffffff' }}
                  title="Click to copy JAMB / Matric Number"
                >
                  <span>Reg: {reg}</span>
                  {copied ? <Check size={11} color="#059669" /> : <Copy size={11} />}
                </button>
              )}

              <button
                onClick={() => setWalletOpen(true)}
                className="dash-pill"
                style={{ cursor: 'pointer', background: '#f8fafc' }}
              >
                <Wallet size={11} color="#059669" />
                <span>Wallet: {walletBalanceLabel}</span>
                <b style={{ color: '#059669', marginLeft: '3px' }}>{wallet ? '+ Fund' : 'Set Up'}</b>
              </button>
            </div>
          </section>

          {/* SECTION 2: QUICK-ACCESS 4 COMPACT CARDS (CBT, Past Q, Admission, Scholarships) */}
          <section className="dash-quick-grid">
            <a href="/cbt" className="dash-quick-card">
              <div className="dash-quick-card-top">
                <CardIdentityMark value="cbt" type="service" size="sm" />
                <ChevronRight size={15} color="#64748b" />
              </div>
              <div>
                <div className="dash-quick-card-title">CBT Practice</div>
                <div className="dash-quick-card-sub">JAMB / WAEC Practice →</div>
              </div>
            </a>

            <a href="/cbt?mode=WAEC" className="dash-quick-card">
              <div className="dash-quick-card-top">
                <CardIdentityMark value="past-questions" type="service" size="sm" />
                <ChevronRight size={15} color="#64748b" />
              </div>
              <div>
                <div className="dash-quick-card-title">Past Questions</div>
                <div className="dash-quick-card-sub">JAMB &amp; WAEC →</div>
              </div>
            </a>

            <a href="/screening-calculator" className="dash-quick-card">
              <div className="dash-quick-card-top">
                <CardIdentityMark value="admission" type="service" size="sm" />
                <ChevronRight size={15} color="#64748b" />
              </div>
              <div>
                <div className="dash-quick-card-title">Admission</div>
                <div className="dash-quick-card-sub">CAPS &amp; Screening →</div>
              </div>
            </a>

            <a href="/jobs" className="dash-quick-card">
              <div className="dash-quick-card-top">
                <CardIdentityMark value="scholarship" type="service" size="sm" />
                <ChevronRight size={15} color="#64748b" />
              </div>
              <div>
                <div className="dash-quick-card-title">Scholarships</div>
                <div className="dash-quick-card-sub">NELFUND &amp; Grants →</div>
              </div>
            </a>
          </section>

          {/* SECTION 3: QUICK ACTIONS (CGPA Calculator, School Finder, Course Finder) */}
          <section className="dash-card" id="tools">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Wrench size={14} className="dash-card-title-icon" /> Quick Actions &amp; Academic Tools
              </h2>
            </div>
            <div className="dash-actions-grid">
              <button
                type="button"
                className="dash-action-box"
                onClick={() => setCgpaModalOpen(true)}
              >
                <div className="dash-action-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                  <Calculator size={18} />
                </div>
                <div className="dash-action-text">
                  <strong>CGPA Calculator</strong>
                  <small>Grade point &amp; degree scale</small>
                </div>
              </button>

              <button
                type="button"
                className="dash-action-box"
                onClick={() => setSchoolFinderOpen(true)}
              >
                <div className="dash-action-icon-wrap" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  <School size={18} />
                </div>
                <div className="dash-action-text">
                  <strong>School Finder</strong>
                  <small>Federal, State &amp; Poly</small>
                </div>
              </button>

              <button
                type="button"
                className="dash-action-box"
                onClick={() => setCourseFinderOpen(true)}
              >
                <div className="dash-action-icon-wrap" style={{ background: '#faf5ff', color: '#7e22ce' }}>
                  <Compass size={18} />
                </div>
                <div className="dash-action-text">
                  <strong>Course Finder</strong>
                  <small>Cut-offs &amp; UTME subjects</small>
                </div>
              </button>
            </div>
          </section>

          {/* SECTION 4: MY SERVICES / ACCESSED SERVICES */}
          <section className="dash-card" id="services">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <FileText size={14} className="dash-card-title-icon" /> My Services &amp; Accessed Tools
              </h2>
              <a href="/services" className="dash-card-link">
                Request New Service →
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              {requests.slice(0, 3).map((req) => {
                const service = serviceMap[req.service_id];
                const title = String(req.form_data?.serviceTitle || service?.title || 'EduReach Service');
                return (
                  <a
                    key={req.id}
                    href={`/dashboard/services?ref=${encodeURIComponent(req.reference_code)}`}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '9px',
                      padding: '11px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      textDecoration: 'none',
                      color: '#0f172a',
                    }}
                  >
                    <CardIdentityMark value={service?.service_key || title} type="service" size="sm" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</strong>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748b', margin: '2px 0' }}>Ref: {req.reference_code}</span>
                      <span className={`dash-status-pill dash-status-${req.status}`}>{statusLabel(req.status)}</span>
                    </div>
                  </a>
                );
              })}
              {!requests.length && (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '9px', padding: '12px', color: '#64748b', fontSize: '12px' }}>
                  No service requests yet. When you request NELFUND, result checking, scratch cards, or JAMB slips, live status appears here.
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <strong style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Recently Accessed
                </strong>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Tracked on this student account</span>
              </div>
              <div style={{ display: 'grid', gap: '7px' }}>
                {(accessedServices.length ? accessedServices : []).slice(0, 5).map((item) => (
                  <a
                    key={`${item.key}-${item.href}`}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      background: '#f8fafc',
                      border: '1px solid #eef2f7',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      textDecoration: 'none',
                      color: '#0f172a',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</strong>
                      <small style={{ color: '#64748b', fontSize: '10px' }}>{item.category} • opened {item.count}x • {fmtDate(item.lastAccessedAt)}</small>
                    </span>
                    <ChevronRight size={14} color="#94a3b8" />
                  </a>
                ))}
                {!accessedServices.length && (
                  <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
                    Start using CBT, services, school finder, or scholarships and your recent activity will appear here.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 5: MY APPLICATIONS */}
          <section className="dash-card" id="applications">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <ClipboardList size={14} className="dash-card-title-icon" /> My Applications &amp; Service Tracking
              </h2>
              <a href="/services" className="dash-card-link">
                New Request →
              </a>
            </div>

            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Ref Code</th>
                    <th>Service Request</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const title = String(req.form_data?.serviceTitle || serviceMap[req.service_id]?.title || 'EduReach Service');
                    return (
                      <tr key={req.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', fontSize: '11px', color: '#0f172a' }}>{req.reference_code}</strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CardIdentityMark value={serviceMap[req.service_id]?.service_key || 'services'} type="service" size="sm" />
                            <span>{title}</span>
                          </div>
                        </td>
                        <td style={{ color: '#64748b' }}>{fmtDate(req.created_at)}</td>
                        <td>
                          <span className={`dash-status-pill dash-status-${req.status}`}>{statusLabel(req.status)}</span>
                        </td>
                        <td>
                          <a
                            href={`/dashboard/services?ref=${encodeURIComponent(req.reference_code)}`}
                            style={{ color: '#059669', textDecoration: 'none', fontWeight: 800, fontSize: '11px' }}
                          >
                            Track →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {!requests.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                        No service requests recorded. Need exam pins or NELFUND loan help? Browse Services.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 5: CBT & PAST QUESTION PROGRESS */}
          <section className="dash-card" id="cbt">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <CheckSquare size={14} className="dash-card-title-icon" /> CBT &amp; Past Question Progress
              </h2>
              <a href="/cbt" className="dash-card-link">
                Start Timed Test →
              </a>
            </div>

            <div className="dash-metric-strip">
              <div className="dash-metric-card">
                <span className="dash-metric-label">Average Score</span>
                <span className="dash-metric-val" style={{ color: averageScore >= 70 ? '#059669' : '#d97706' }}>
                  {averageScore}%
                </span>
              </div>
              <div className="dash-metric-card">
                <span className="dash-metric-label">Best Score</span>
                <span className="dash-metric-val" style={{ color: '#059669' }}>
                  {bestScore}%
                </span>
              </div>
              <div className="dash-metric-card">
                <span className="dash-metric-label">Tests Taken</span>
                <span className="dash-metric-val">{attempts.length}</span>
              </div>
              <div className="dash-metric-card">
                <span className="dash-metric-label">Past Q Solved</span>
                <span className="dash-metric-val">{pastQuestionsSolved}</span>
              </div>
            </div>

            {attempts.length > 0 && (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Subject / Paper</th>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Correct / Total</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.slice(0, 3).map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.subject || 'JAMB UTME Practice'}</strong>
                        </td>
                        <td style={{ color: '#64748b' }}>{fmtDate(a.submitted_at || a.created_at)}</td>
                        <td>
                          <strong style={{ color: Number(a.score || 0) >= 70 ? '#059669' : '#d97706' }}>{a.score}%</strong>
                        </td>
                        <td>
                          {a.correct_answers} / {a.total_questions}
                        </td>
                        <td>
                          <a
                            href={`/dashboard/cbt/results?attempt=${encodeURIComponent(a.id)}`}
                            style={{ color: '#059669', textDecoration: 'none', fontWeight: 800, fontSize: '11px' }}
                          >
                            Scorecard →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* SECTION 6: PAST QUESTION PROGRESS */}
          <section className="dash-card" id="past-questions">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <BookOpen size={14} className="dash-card-title-icon" /> Past Question Progress
              </h2>
              <a href="/past-questions" className="dash-card-link">
                Continue Practice →
              </a>
            </div>
            {!attempts.length && (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No past-question progress yet. Start a practice session and your solved-question count will appear here.
              </div>
            )}
            {!!attempts.length && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {attempts.slice(0, 3).map((item) => {
                  const total = Number(item.total_questions || 0);
                  const done = Number(item.correct_answers || 0);
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <div key={item.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px', padding: '11px' }}>
                      <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a', marginBottom: '5px' }}>{item.subject || 'CBT Practice'}</strong>
                      <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '5px' }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#D9381E' }} />
                      </div>
                      <small style={{ color: '#64748b', fontSize: '10px' }}>{done}/{total} correct • {pct}% score path</small>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 7: SAVED SCHOOLS / COURSES */}
          <section className="dash-card" id="saved">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Bookmark size={14} className="dash-card-title-icon" /> Saved Schools &amp; Courses
              </h2>
              <button
                type="button"
                onClick={() => setSchoolFinderOpen(true)}
                className="dash-card-link"
                style={{ background: 'none', border: 0, cursor: 'pointer' }}
              >
                + Find More
              </button>
            </div>

            {!savedItemsCount && (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px', marginBottom: '10px' }}>
                Your shortlist is empty. Use School Finder or Course Finder to save institutions and courses to this dashboard.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {savedItems
                .filter((item) => item.saved)
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        {item.type === 'school' ? <School size={13} color="#059669" /> : <GraduationCap size={13} color="#2563eb" />}
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{item.name}</strong>
                      </div>
                      <p style={{ margin: '0 0 4px', fontSize: '10.5px', color: '#64748b' }}>{item.detail}</p>
                      <small style={{ fontSize: '9.5px', color: '#94a3b8' }}>📍 {item.location}</small>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSave(item.id)}
                      style={{ background: 'none', border: 0, color: '#059669', cursor: 'pointer', padding: '2px' }}
                      title="Unsave"
                    >
                      <BookmarkCheck size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </section>

          {/* SECTION 8: SAVED / APPLIED SCHOLARSHIPS */}
          <section className="dash-card" id="scholarships">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Award size={14} className="dash-card-title-icon" /> Scholarships &amp; Funding Watchlist
              </h2>
              <a href="/scholarships" className="dash-card-link">
                Browse Grants →
              </a>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {!savedScholarships.length && (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No saved scholarships or funding applications yet. Browse grants and save real opportunities to track them here.
                </div>
              )}
              {savedScholarships.map((item) => (
                <a
                  key={item.id}
                  href={item.href || '/scholarships'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '9px 11px',
                    color: '#0f172a',
                    textDecoration: 'none',
                  }}
                >
                  <span>
                    <strong style={{ display: 'block', fontSize: '12px' }}>{item.name}</strong>
                    <small style={{ color: '#64748b', fontSize: '10px' }}>{item.detail || 'Saved funding opportunity'}</small>
                  </span>
                  <ChevronRight size={14} color="#94a3b8" />
                </a>
              ))}
            </div>
          </section>

          {/* SECTION 9: NOTIFICATIONS & ALERTS */}
          <section className="dash-card" id="notifications">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Bell size={14} className="dash-card-title-icon" /> Notifications &amp; Alerts
              </h2>
              {unreadNotifsCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotifsRead}
                  className="dash-card-link"
                  style={{ background: 'none', border: 0, cursor: 'pointer' }}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {!notifications.length && (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No alerts yet. Service updates, CBT reminders, saved items, and funding announcements will appear here.
                </div>
              )}
              {notifications.slice(0, 5).map((notice) => (
                <div
                  key={notice.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: notice.read ? '#ffffff' : '#FFF0E6',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '9px 11px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {notice.title}
                    </strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{notice.time}</span>
                  </div>
                  {!notice.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D9381E', flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 10: AVAILABLE SERVICES FROM CATALOG */}
          <section className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Sparkles size={14} className="dash-card-title-icon" /> Available Academic Services
              </h2>
              <a href="/services" className="dash-card-link">
                View All Services →
              </a>
            </div>

            {!services.length && (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No service catalog records are available for this account yet.
              </div>
            )}
            {!!services.length && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {services.slice(0, 3).map((service) => (
                  <div
                    key={service.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <CardIdentityMark value={service.service_key} type="service" size="sm" />
                      <div>
                        <strong style={{ fontSize: '12px', display: 'block', color: '#0f172a' }}>{service.title}</strong>
                        <small style={{ fontSize: '10px', color: '#64748b' }}>Available in service catalog</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <a
                        href={`/services/apply/${service.service_key}`}
                        className="dash-pill"
                        style={{ textDecoration: 'none', background: '#059669', color: '#ffffff', borderColor: '#059669' }}
                      >
                        Open Service
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 9: RECENT ACTIVITY */}
          <section className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Clock size={14} className="dash-card-title-icon" /> Recent Activity
              </h2>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {!recentActivities.length && (
                <div style={{ padding: '12px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
                  No activity yet. Your CBT attempts, saved schools, applications, and tool snapshots will appear here.
                </div>
              )}
              {recentActivities.map((activity, index) => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 0',
                    borderBottom: index === recentActivities.length - 1 ? 0 : '1px solid #f1f5f9',
                  }}
                >
                  {activity.kind === 'attempt' && <CheckCircle2 size={15} color="#059669" />}
                  {activity.kind === 'saved' && <BookmarkCheck size={15} color="#2563eb" />}
                  {activity.kind === 'request' && <ClipboardList size={15} color="#d97706" />}
                  {activity.kind === 'cgpa' && <Calculator size={15} color="#7e22ce" />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: 600 }}>
                      {activity.title}
                    </span>
                    <small style={{ display: 'block', fontSize: '9.5px', color: '#94a3b8' }}>{activity.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* 3. RIGHT RAIL: NOTICEBOARD, UPCOMING DEADLINES & AD SPACE (Prevents cards from stretching too long) */}
        <aside className="edureach-dash-rail">
          {/* ACCOUNT SHORTCUTS */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <LayoutDashboard size={13} className="dash-card-title-icon" /> Account Shortcuts
              </h2>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                { label: 'My Services', href: '/dashboard/services', count: requests.length },
                { label: 'CBT Attempts', href: '/dashboard/cbt', count: attempts.length },
                { label: 'Saved Items', href: '/dashboard/saved', count: savedItemsCount },
                { label: 'Notifications', href: '/dashboard/notifications', count: unreadNotifsCount },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 10px', textDecoration: 'none', color: '#0f172a' }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 800 }}>{item.label}</span>
                  <strong style={{ fontSize: '11px', color: '#D9381E' }}>{item.count}</strong>
                </a>
              ))}
            </div>
          </div>

          {/* UPCOMING DEADLINES & EVENTS */}
          <div className="dash-card" id="deadlines">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Clock size={13} className="dash-card-title-icon" /> Upcoming Deadlines
              </h2>
            </div>
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
              No personalized deadlines yet. Deadlines from saved schools, applications, and notifications will appear here.
            </div>
          </div>

          {/* STUDENT WALLET MINI WIDGET */}
          <div className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                Wallet Balance
              </strong>
              <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#059669', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                {walletStatusLabel}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: '4px 0 10px' }}>
              {walletBalanceLabel}
            </div>
            <button
              onClick={() => setWalletOpen(true)}
              style={{
                width: '100%',
                background: '#059669',
                color: '#ffffff',
                border: 0,
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              <Plus size={14} /> Top Up Wallet
            </button>
          </div>

          {/* OFFICIAL WHATSAPP HELPLINE */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#25d366',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <HelpCircle size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '11.5px', display: 'block', color: '#0f172a' }}>Need Academic Help?</strong>
              <a
                href="https://wa.me/2348000000000"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '10.5px', color: '#059669', fontWeight: 800, textDecoration: 'none' }}
              >
                Chat on WhatsApp Support →
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* 4. COMPACT MOBILE BOTTOM NAVIGATION / MENU */}
      <nav className="edureach-bottom-nav">
        <div className="edureach-bottom-nav-inner">
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => openDashboardTab('dashboard')}
          >
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => openDashboardTab('applications')}
          >
            <ClipboardList size={17} />
            <span>Apply</span>
          </button>
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'cbt' ? 'active' : ''}`}
            onClick={() => openDashboardTab('cbt')}
          >
            <CheckSquare size={17} />
            <span>CBT</span>
          </button>
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => openDashboardTab('saved')}
          >
            <Bookmark size={17} />
            <span>Saved</span>
          </button>
          <button
            type="button"
            className="edureach-bottom-link"
            onClick={() => setMobileMenuOpen(true)}
          >
            <MoreVertical size={17} />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* MOBILE DRAWER MODAL */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
          }}
        >
          <div
            style={{
              width: '280px',
              background: '#ffffff',
              height: '100%',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9', marginBottom: '14px' }}>
              <strong style={{ fontSize: '16px', color: '#0f172a' }}>Dashboard Menu</strong>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '4px' }}>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  openDashboardTab('dashboard');
                  setMobileMenuOpen(false);
                }}
              >
                <LayoutDashboard size={15} /> Dashboard Overview
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  openDashboardTab('services');
                  setMobileMenuOpen(false);
                }}
              >
                <FileText size={15} /> My Services
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  openDashboardTab('applications');
                  setMobileMenuOpen(false);
                }}
              >
                <ClipboardList size={15} /> My Applications
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  openDashboardTab('saved');
                  setMobileMenuOpen(false);
                }}
              >
                <Bookmark size={15} /> Saved Schools
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  openDashboardTab('cbt');
                  setMobileMenuOpen(false);
                }}
              >
                <CheckSquare size={15} /> CBT Practice
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setCgpaModalOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                <Calculator size={15} /> CGPA Calculator
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setSchoolFinderOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                <School size={15} /> School Finder
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setCourseFinderOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                <Compass size={15} /> Course Finder
              </button>
              <a
                href="/profile"
                className="edureach-nav-item"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User size={15} /> Academic Profile
              </a>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setSecurityOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                <Shield size={15} /> Security Settings
              </button>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={logout}
                className="edureach-nav-item"
                style={{ color: '#dc2626' }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </div>
          <div style={{ flex: 1 }} onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* 5. INTERACTIVE TOOL MODAL: CGPA CALCULATOR */}
      {cgpaModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '500px',
              width: '100%',
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                  Nigerian Tertiary CGPA Calculator (5.0 Scale)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCgpaModalOpen(false)}
                style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px', textAlign: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#065f46' }}>Estimated Semester GPA</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#059669', lineHeight: 1.1 }}>
                {calculateCGPA()} <small style={{ fontSize: '14px', color: '#065f46' }}>/ 5.00</small>
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#047857' }}>
                {currentCgpa.classification}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
              {cgpaCourses.map((c, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '8px' }}>
                  <input
                    type="text"
                    value={c.code}
                    onChange={(e) => {
                      const updated = [...cgpaCourses];
                      updated[idx].code = e.target.value;
                      setCgpaCourses(updated);
                    }}
                    placeholder="Course Code"
                    style={{ padding: '6px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={c.units}
                    onChange={(e) => {
                      const updated = [...cgpaCourses];
                      updated[idx].units = Number(e.target.value) || 1;
                      setCgpaCourses(updated);
                    }}
                    placeholder="Units"
                    style={{ padding: '6px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <select
                    value={c.grade}
                    onChange={(e) => {
                      const updated = [...cgpaCourses];
                      updated[idx].grade = e.target.value;
                      setCgpaCourses(updated);
                    }}
                    style={{ padding: '6px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    <option value="A">A (5 pts)</option>
                    <option value="B">B (4 pts)</option>
                    <option value="C">C (3 pts)</option>
                    <option value="D">D (2 pts)</option>
                    <option value="E">E (1 pt)</option>
                    <option value="F">F (0 pts)</option>
                  </select>
                </div>
              ))}
            </div>

            {latestCgpaSnapshot && (
              <div style={{ background: '#F2F3FF', border: '1px solid #DAE2FD', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '11px', color: '#283044' }}>
                Last saved: {latestCgpaSnapshot.gpa}/5.00 • {latestCgpaSnapshot.totalUnits} units • {latestCgpaSnapshot.classification}
              </div>
            )}
            {cgpaSaveMessage && (
              <div style={{ background: cgpaSaveMessage.toLowerCase().includes('unable') ? '#fef2f2' : '#EAF8EE', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '11px', color: cgpaSaveMessage.toLowerCase().includes('unable') ? '#b91c1c' : '#166534' }}>
                {cgpaSaveMessage}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCgpaCourses([...cgpaCourses, { code: 'NEW 101', units: 2, grade: 'A' }])}
                style={{
                  width: '100%',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                + Add Course
              </button>
              <button
                type="button"
                onClick={handleSaveCgpaSnapshot}
                disabled={cgpaSaving}
                style={{
                  width: '100%',
                  background: '#059669',
                  border: 0,
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {cgpaSaving ? 'Saving…' : 'Save Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. INTERACTIVE TOOL MODAL: SCHOOL FINDER */}
      {schoolFinderOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              padding: '20px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <School size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                  Nigerian School &amp; Institution Explorer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSchoolFinderOpen(false)}
                style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={schoolFilterQuery}
                onChange={(e) => setSchoolFilterQuery(e.target.value)}
                placeholder="Search by school name or state..."
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
              <select
                value={schoolTypeFilter}
                onChange={(e) => setSchoolTypeFilter(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                <option value="ALL">All Institutions</option>
                <option value="Federal">Federal Universities</option>
                <option value="State">State Universities</option>
                <option value="Polytechnic">Polytechnics</option>
              </select>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gap: '8px' }}>
              {filteredSchools.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{s.name}</strong>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                      {s.type} • 📍 {s.state} State • Est. {s.founded}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        saveDashboardItem({
                          type: 'school',
                          key: itemKey(s.name),
                          name: s.name,
                          detail: `${s.type} • Est. ${s.founded}`,
                          location: `${s.state} State`,
                          href: s.url,
                        })
                      }
                      disabled={isSavedItem('school', itemKey(s.name))}
                      style={{
                        background: isSavedItem('school', itemKey(s.name)) ? '#EAF8EE' : '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: isSavedItem('school', itemKey(s.name)) ? '#16A34A' : '#059669',
                        padding: '4px 8px',
                        borderRadius: '5px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        cursor: isSavedItem('school', itemKey(s.name)) ? 'default' : 'pointer',
                      }}
                    >
                      {isSavedItem('school', itemKey(s.name)) ? 'Saved' : 'Save'}
                    </button>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#059669',
                        padding: '4px 8px',
                        borderRadius: '5px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textDecoration: 'none',
                      }}
                    >
                      Portal ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE TOOL MODAL: COURSE FINDER */}
      {courseFinderOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              padding: '20px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                  JAMB Course &amp; Cut-Off Benchmark Finder
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCourseFinderOpen(false)}
                style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <input
              type="text"
              value={courseFilterQuery}
              onChange={(e) => setCourseFilterQuery(e.target.value)}
              placeholder="Search course name or faculty (e.g. Medicine, Law, Science)..."
              style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '12px' }}
            />

            <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gap: '8px' }}>
              {filteredCourses.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{c.name}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          saveDashboardItem({
                            type: 'course',
                            key: itemKey(c.name),
                            name: c.name,
                            detail: `Cut-off: ${c.cutOff} • ${c.utme}`,
                            location: c.faculty,
                          })
                        }
                        disabled={isSavedItem('course', itemKey(c.name))}
                        style={{
                          background: isSavedItem('course', itemKey(c.name)) ? '#EAF8EE' : '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: isSavedItem('course', itemKey(c.name)) ? '#16A34A' : '#059669',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 900,
                          cursor: isSavedItem('course', itemKey(c.name)) ? 'default' : 'pointer',
                        }}
                      >
                        {isSavedItem('course', itemKey(c.name)) ? 'Saved' : 'Save'}
                      </button>
                      <span style={{ fontSize: '10px', fontWeight: 900, background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: '4px' }}>
                        Cut-off: {c.cutOff}+
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569', marginBottom: '2px' }}>
                    <b>Faculty:</b> {c.faculty}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569', marginBottom: '2px' }}>
                    <b>UTME Subjects:</b> {c.utme}
                  </div>
                  <small style={{ fontSize: '9.5px', color: '#64748b' }}>
                    <b>O'Level:</b> {c.olevel}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. SECURITY & SESSION MANAGEMENT MODAL */}
      {securityOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '26px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                    Account Security &amp; Devices
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Password, active sessions &amp; optional MFA
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSecurityOpen(false)}
                style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* TAB 1: CHANGE PASSWORD */}
            <form onSubmit={handlePasswordChange} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                Change Password
              </h4>

              {passwordMessage && (
                <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>
                  {passwordMessage}
                </div>
              )}
              {passwordError && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>
                  {passwordError}
                </div>
              )}

              <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      minLength={8}
                      required
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      minLength={8}
                      required
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordBusy}
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {passwordBusy ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            {/* TAB 2: SESSION & DEVICE MANAGEMENT */}
            <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                Active Sessions &amp; Devices
              </h4>

              {sessionRevoked && (
                <div style={{ background: '#ecfdf5', color: '#047857', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>
                  All other devices have been logged out.
                </div>
              )}

              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Laptop size={18} color="#059669" />
                    <div>
                      <strong style={{ fontSize: '12px', display: 'block', color: '#0f172a' }}>
                        Current Web Session • Chrome / Windows
                      </strong>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                        Lagos, Nigeria • Active Now
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                    THIS DEVICE
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Smartphone size={18} color="#64748b" />
                    <div>
                      <strong style={{ fontSize: '12px', display: 'block', color: '#0f172a' }}>
                        Mobile Portal • Android Browser
                      </strong>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                        Last active: 2 hours ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOutOtherDevices}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                Sign Out from All Other Devices
              </button>
            </div>

            {/* TAB 3: OPTIONAL MFA LATER */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Two-Factor Authentication (MFA)
                  </h4>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                    Add extra security using an authenticator app (Google Authenticator / Authy).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleMfaToggle}
                  style={{
                    background: mfaEnabled ? '#059669' : '#e2e8f0',
                    color: mfaEnabled ? '#ffffff' : '#64748b',
                    border: 0,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {mfaEnabled ? 'Enabled' : 'Enable MFA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. WALLET TOPUP MODAL */}
      <WalletModal
        isOpen={walletOpen}
        onClose={() => setWalletOpen(false)}
        userEmail={email}
        onSuccess={(amount) => {
          setWallet((current) => ({
            balance: (current?.balance || 0) + amount,
            currency: current?.currency || 'NGN',
          }));
          addLocalNotification(`Wallet credited with ₦${amount.toLocaleString()}.`, 'wallet');
          if (!isLocalMode && userId) {
            void createNotification(userId, {
              title: `Wallet credited with ₦${amount.toLocaleString()}`,
              type: 'wallet',
            });
          }
        }}
      />
    </div>
  );
}
