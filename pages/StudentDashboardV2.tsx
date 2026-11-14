import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  Bookmark,
  ClipboardList,
  Edit,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import BrandLogo from '../src/components/BrandLogo';
import VerifiedBadge from '../src/components/VerifiedBadge';
import NotificationCenter from '../src/components/NotificationCenter';
import { useToast } from '../src/components/ui/Toast';
import { SkeletonRows } from '../src/components/Skeleton';
import { InlineNotice } from '../src/components/AsyncState';
import CgpaCalculatorCard from '../src/components/dashboard/CgpaCalculatorCard';
import { ChangeChip, DistributionChart, SubjectBars, TrendChart } from '../src/components/dashboard/ProgressCharts';
import { apiUrl } from '../src/lib/apiBase';
import { deleteCbtAttempt, trackEvent } from '../src/lib/api';
import { userFacingError } from '../lib/errors';
import SchoolFinderCard, { type Institution } from '../src/components/dashboard/SchoolFinderCard';
import SecurityModal from '../src/components/dashboard/SecurityModal';
import SkipLink from '../src/components/a11y/SkipLink';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { localStorageKey, readLocalPreviewValue } from '../src/lib/localPreview';
import { useAuth } from '../src/lib/auth';
import { navigateInApp } from '../src/lib/navigation';
import { pageTitleFor } from '../src/lib/pageMeta';
import { needsStudentAction, serviceStatusMeaning } from '../src/lib/serviceLifecycle';
import { useModalDialog } from '../src/lib/useModalDialog';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import SiteSearch from '../src/components/LazySiteSearch';
import { commonInstitutions, institutionCourseContexts } from '../src/data/studentOptions';
import { cbtAttemptState, dashboardPriorities, summarizeCbtAttempts } from '../src/lib/dashboardPriority';
import { cbtModeLabel, isScoredSubmission, practiceSuggestion, singleSubjectProgress, submittedSubjectCounts } from '../src/lib/dashboardCbtStats';
import { summarizePerformance } from '../src/lib/dashboardAnalytics';
import {
  deleteSavedItem,
  fetchCgpaSnapshots,
  fetchLatestCgpaSnapshot,
  fetchNotifications,
  markNotificationsRead,
  pageSlice,
  type DashboardNotification,
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
type Attempt = { id: string; score: number | null; correct_answers: number; total_questions: number; submitted_at: string | null; created_at: string; subject?: string; exam_id?: string; status?: string; mode?: string | null; selected_subjects?: string[] | null; subject_plan?: unknown; expires_at?: string | null; current_question?: number };

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

function localStarterInstitutions(): Institution[] {
  return commonInstitutions.filter((name) => !name.startsWith('Other')).map((name, index) => {
    const match = name.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
    return { id: `starter-school-${index + 1}`, school_name: match?.[1] || name, acronym: match?.[2] || null, institution_type: 'University', course_context: institutionCourseContexts[match?.[2] || ''] || null };
  });
}

function readLocalServiceRequests(): RequestRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localStorageKey('service-requests')) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: {
        id?: unknown;
        service_id?: unknown;
        status?: unknown;
        reference_code?: unknown;
        created_at?: unknown;
        service_title?: unknown;
        service_catalog?: { title?: unknown } | null;
        form_data?: { serviceSlug?: unknown; serviceTitle?: unknown; [key: string]: unknown } | null;
      }) => ({
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
        score: typeof stored.attempt.score === 'number' ? stored.attempt.score : null,
        correct_answers: Number(stored.attempt.correct_answers || 0),
        total_questions: Number(stored.attempt.total_questions || stored.questions?.length || 0),
        submitted_at: stored.attempt.submitted_at || null,
        // Keep the real start time when the scorecard recorded one: replacing it
        // with submitted_at made every local paper look like it took 0 minutes.
        created_at: stored.attempt.created_at || stored.attempt.started_at || stored.attempt.submitted_at || new Date().toISOString(),
        subject: stored.exam?.title || stored.exam?.subject || stored.attempt.exam_id || 'CBT Practice',
        exam_id: stored.attempt.exam_id || undefined,
        status: 'submitted',
        mode: stored.attempt.mode || null,
      });
    }
    return attempts.sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()).slice(0, 50);
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

function readStoredProfile(): (Partial<Profile> & { email?: string }) | null {
  try {
    return JSON.parse(readLocalPreviewValue('profile') || 'null') as Partial<Profile> & { email?: string };
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
  // SERVICE-1: one description of the status machine, shared with the apply page.
  return serviceStatusMeaning(status).label;
}
function statusClass(status: string) {
  if (status === 'completed' || status === 'closed') return 'dash-status-pill dash-status-completed';
  if (status === 'rejected' || status === 'cancelled') return 'dash-status-pill dash-status-rejected';
  if (status === 'processing' || status === 'reviewing' || status === 'awaiting_information') return 'dash-status-pill dash-status-processing';
  return 'dash-status-pill dash-status-submitted';
}
/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StudentDashboardV2({ initialTab = 'dashboard', openSettings = false }: { initialTab?: DashboardTab; openSettings?: boolean }) {
  const { user: authUser, signOut: authSignOut } = useAuth();
  const { push: pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState(false);
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
  const [requestsUnavailable, setRequestsUnavailable] = useState(false);
  const [attemptsUnavailable, setAttemptsUnavailable] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  // Phase 6: results are reviewable, deletable and paged on this screen. The
  // confirmation is inline, not a second modal - the dashboard already has one
  // dialog (security settings) and two overlays competing for focus is a bug.
  const [attemptPage, setAttemptPage] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [confirmSavedId, setConfirmSavedId] = useState('');
  const [removingSavedId, setRemovingSavedId] = useState('');
  const [attemptNotice, setAttemptNotice] = useState('');
  const [savedItems, setSavedItems] = useState<DashboardSavedItem[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [cgpaCourses, setCgpaCourses] = useState<CgpaCourseInput[]>([]);
  const [latestCgpaSnapshot, setLatestCgpaSnapshot] = useState<CgpaSnapshot | null>(null);
  const [cgpaSnapshots, setCgpaSnapshots] = useState<CgpaSnapshot[]>([]);

  const [securityOpen, setSecurityOpen] = useState(openSettings);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  // A11Y-1: the account sheet is a dialog, so it behaves like one.
  const accountSheetRef = useModalDialog<HTMLDivElement>(accountSheetOpen, () => setAccountSheetOpen(false));
  const focusedRequestReference = new URLSearchParams(window.location.search).get('ref') || '';

  /* ---------------- data ---------------- */
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadFailure(false);
      setError('');
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (!isSupabaseConfigured || authError || !session?.user) {
        if (isSupabaseConfigured && !authUser?.isLocal) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState({}, '', `/login?next=${encodeURIComponent(next)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }
        // Local preview session: only real locally-entered data, empty states elsewhere.
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
        setInstitutions(localStarterInstitutions());
        setRequests(readLocalServiceRequests());
        setRequestsUnavailable(false);
        setAttempts(readLocalCbtAttempts());
        setSavedItems(readLocalSavedItems());
        setNotifications([]);
        setLoading(false);
        return;
      }

      const user = session.user;
      setEmailVerified(Boolean(user.email_confirmed_at));
      const [profileResult, serviceResult, institutionResult, requestResult, attemptsResult, savedResult, cgpaSnapshot, cgpaHistory, notificationResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('institutions').select('id,school_name,acronym,state,institution_type,website_url').order('school_name').limit(400),
        supabase.from('service_requests').select('id,status,form_data,created_at,reference_code,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('cbt_attempts').select('id,exam_id,status,mode,selected_subjects,subject_plan,score,correct_answers,total_questions,submitted_at,created_at,expires_at,current_question').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        fetchSavedItems(user.id),
        fetchLatestCgpaSnapshot(user.id),
        fetchCgpaSnapshots(user.id),
        fetchNotifications(user.id),
      ]);
      if (!active) return;

      let adminSession = false;
      try {
        const adminResponse = await fetch(apiUrl('/api/admin/session'), { headers: { Authorization: `Bearer ${session.access_token}` } });
        adminSession = adminResponse.ok;
      } catch {
        adminSession = false;
      }
      // `user_metadata` is writable by the account holder, so it must never be
      // read for a role - not even for this label. `app_metadata` is written only
      // by the auth admin API and the console shell (pages/AdminLayout.tsx)
      // already limits its fallback to that; the profile row is the source the
      // API itself authorizes from, so it wins. Nothing is granted here: every
      // admin call is authorized server-side.
      const metadataRole = String(user.app_metadata?.role || '').toLowerCase();
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
        // A display name may come from user_metadata; the role may not.
        setProfile({ full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student', role: profileRole || 'student' });
      }
      if (profileResult.error) setError('We could not load your profile. Please refresh or update your academic profile.');
      setServices((serviceResult.data || []) as ServiceRow[]);
      setInstitutions((institutionResult.data || []) as Institution[]);
      setRequests((Array.isArray(requestResult.data) && !requestResult.error ? requestResult.data : []) as RequestRow[]);
      setRequestsUnavailable(Boolean(requestResult.error) || !Array.isArray(requestResult.data));
      setAttemptsUnavailable(Boolean(attemptsResult.error) || !Array.isArray(attemptsResult.data));
      setAttempts((attemptsResult.data || []) as Attempt[]);
      setSavedItems(savedResult);
      setLatestCgpaSnapshot(cgpaSnapshot);
      setCgpaSnapshots(cgpaHistory);
      setNotifications(notificationResult);
      if (cgpaSnapshot?.courses?.length) setCgpaCourses(cgpaSnapshot.courses);
      setLoading(false);
    }
    void load().catch(() => {
      if (!active) return;
      setLoadFailure(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadNotifications = notifications.filter((item) => !item.read).length;

  async function markAllNotificationsRead() {
    if (!unreadNotifications || notificationsBusy || !userId) return;
    setNotificationsBusy(true);
    setNotice('');
    try {
      await markNotificationsRead(userId);
      // Mark by the same predicate the list uses, so the badge and the rows agree.
      setNotifications((current) => current.map((item) => (item.read ? item : { ...item, read: true })));
    } catch {
      setNotice('We could not update your notifications. Please try again.');
    } finally {
      setNotificationsBusy(false);
    }
  }

  /* ---------------- tabs & URL ---------------- */
  const openTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setAccountSheetOpen(false);
    setProfileMenuOpen(false);
    const route = TAB_ROUTES[tab];
    if (`${window.location.pathname}` !== route) {
      window.history.pushState({}, '', route);
      document.title = `${pageTitleFor(route)} | EduReach`;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab !== 'services' || !focusedRequestReference || !requests.length) return;
    window.requestAnimationFrame(() => {
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const target = document.getElementById(`request-${focusedRequestReference}${mobile ? '-mobile' : ''}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('dash-request-focused');
      window.setTimeout(() => target?.classList.remove('dash-request-focused'), 1800);
    });
  }, [activeTab, focusedRequestReference, requests.length]);

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
  const requiredProfileValues = [profile?.school, profile?.course_programme, profile?.department, profile?.faculty, profile?.level, profile?.session];
  const profileComplete = requiredProfileValues.every((value) => Boolean(String(value || '').trim()));
  const profileCompletionPercent = Math.round((requiredProfileValues.filter((value) => Boolean(String(value || '').trim())).length / requiredProfileValues.length) * 100);
  const cgpaHistory = [...cgpaSnapshots].reverse();
  const cgpaScaleMax = latestCgpaSnapshot?.scale === 4 ? 4 : 5;
  const requestTitle = (row: RequestRow) => String(row.form_data?.serviceTitle || row.form_data?.title || serviceMap[row.service_id]?.title || 'EduReach Request');
  const requestCategory = (row: RequestRow) => String(row.form_data?.requestCategory || row.form_data?.requestType || requestTitle(row));
  const requestDescription = (row: RequestRow) => String(row.form_data?.requestDescription || row.form_data?.notes || row.form_data?.requestDetails || 'Request submitted to EduReach support.');
  const requestWhatsAppHref = (row: RequestRow) => `https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent(`Hello EduReach, I am following up on request ${row.reference_code}. Request: ${requestTitle(row)}.`)}`;
  const openRequests = requests.filter((r) => !['completed', 'closed', 'rejected', 'cancelled'].includes(r.status)).length;
  const activeSaved = savedItems.filter((item) => item.saved);
  // DASH-1: the server expires an attempt when its own clock runs out. The page
  // reads the same rule, so it never offers "Resume" for a test the server will
  // refuse - and never counts an expired attempt as one still in progress.
  const isActiveCbtAttempt = (attempt: Attempt) => cbtAttemptState(attempt) === 'active';
  const attemptSummary = summarizeCbtAttempts(attempts);
  const submittedAttempts = attempts.filter((attempt) => attempt.status === 'submitted');
  const completedAttempts = attempts.filter(isScoredSubmission);
  const expiredAttempts = attemptSummary.expiredAttempts;
  const profileMissing = [
    ['Institution', profile?.school],
    ['Course / programme', profile?.course_programme],
    ['Department', profile?.department],
    ['Faculty', profile?.faculty],
    ['Level', profile?.level],
    ['Session', profile?.session],
  ].filter(([, value]) => !String(value || '').trim()).map(([label]) => label as string);
  const priorities = dashboardPriorities({
    profileComplete,
    profileMissing,
    attempts,
    requests,
    unreadNotifications,
    savedCount: activeSaved.length,
    attemptCount: attemptsUnavailable ? 1 : attempts.length,
  });
  // A score only exists once a paper has been sat. With none, the card says so
  // instead of reporting a 0% average, which reads as a measurement.
  const scoreSummary = summarizeCbtAttempts(completedAttempts);
  const averageScore = scoreSummary.averageScore;
  const bestScore = scoreSummary.bestScore;
  const hasScores = averageScore !== null;
  const questionsInCompletedTests = attemptSummary.questionsInCompletedTests;
  const latestScores = [...completedAttempts].sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()).slice(0, 2);
  // UX-3: MyCBT's summary uses the same real attempt rows as the table. No
  // metric is invented when a row lacks the fields it needs.
  const latestAttempt = latestScores[0] || null;
  const accuracyOf = (row: Attempt): number | null => {
    const total = Number(row.total_questions);
    const correct = Number(row.correct_answers);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(correct) || correct < 0) return null;
    return Math.round((Math.min(correct, total) / total) * 100);
  };
  const latestAccuracy = latestAttempt ? accuracyOf(latestAttempt) : null;
  const scoredQuestions = completedAttempts.reduce((total, row) => total + (Number.isFinite(Number(row.total_questions)) ? Number(row.total_questions) : 0), 0);
  const scoredCorrect = completedAttempts.reduce((total, row) => total + (Number.isFinite(Number(row.correct_answers)) ? Number(row.correct_answers) : 0), 0);
  const overallAccuracy = scoredQuestions > 0 ? Math.round((Math.min(scoredCorrect, scoredQuestions) / scoredQuestions) * 100) : null;
  const latestDurationMinutes = latestAttempt?.submitted_at
    ? Math.round((new Date(latestAttempt.submitted_at).getTime() - new Date(latestAttempt.created_at).getTime()) / 60_000)
    : null;
  const scoreChange = latestScores.length === 2 ? Math.round(Number(latestScores[0].score) - Number(latestScores[1].score)) : null;
  const subjectCounts = submittedSubjectCounts(attempts);
  const subjectProgress = singleSubjectProgress(attempts);
  // UI-5: the Overview derives its own honest summary from the same bounded
  // sample; nothing here is a second, incompatible set of numbers.
  const performance = summarizePerformance(attempts);
  const suggestedSubject = practiceSuggestion(subjectProgress);
  const attemptTitle = (row: Attempt) => row.subject || (row.selected_subjects?.length ? row.selected_subjects.join(', ') : 'CBT');

  const ATTEMPTS_PER_PAGE = 8;
  const attemptPageView = pageSlice(attempts, attemptPage, ATTEMPTS_PER_PAGE);
  const pageCount = attemptPageView.pageCount;
  const safePage = attemptPageView.page;
  const visibleAttempts = attemptPageView.items;

  const removeAttempt = async (row: Attempt) => {
    if (deletingId) return; // one delete at a time: a double click must not send two
    setDeletingId(row.id);
    setAttemptNotice('');
    try {
      await deleteCbtAttempt(row.id);
      setAttempts((current) => current.filter((attempt) => attempt.id !== row.id));
      setConfirmDeleteId('');
      setAttemptNotice('Result deleted. It is no longer on your account. Start a new practice test from the CBT Centre.');
      // The row that held focus is gone; put focus back on the section heading
      // so a keyboard user is not dropped at the top of the document.
      window.requestAnimationFrame(() => document.getElementById('dash-cbt-heading')?.focus());
    } catch (error) {
      // The row stays, the confirmation closes, and the reason is announced.
      setAttemptNotice(userFacingError(error, 'That result could not be deleted. Check your connection and try again.'));
      setConfirmDeleteId('');
    } finally {
      setDeletingId('');
    }
  };

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
      pushToast({ tone: 'success', title: 'Saved to dashboard', detail: `${input.name} is in Tools & Saved.` });
      return;
    }
    const persisted = await upsertSavedItem(userId, input);
    if (persisted) {
      setSavedItems((prev) => prev.map((item) => (item.id === optimistic.id ? persisted : item)));
      pushToast({ tone: 'success', title: 'Saved to dashboard', detail: `${input.name} is in Tools & Saved.` });
    } else {
      setSavedItems((prev) => prev.filter((item) => item.id !== optimistic.id));
      setNotice('We could not save that item online. Please try again.');
      pushToast({ tone: 'danger', title: 'Not saved', detail: 'We could not reach your saved items. Try again.' });
    }
  };

  const removeSaved = async (id: string) => {
    if (removingSavedId) return; // one removal at a time, like result deletion
    const index = savedItems.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const item = savedItems[index];
    const next = savedItems.filter((entry) => entry.id !== id);
    setRemovingSavedId(id);
    setSavedItems(next);
    if (isLocalMode || !userId || id.startsWith('local-')) {
      writeLocalSavedItems(next);
      setConfirmSavedId('');
      setRemovingSavedId('');
      pushToast({ tone: 'info', title: 'Removed from saved', detail: `${item.name} is no longer in Tools & Saved.` });
      return;
    }
    try {
      await deleteSavedItem(id);
      setConfirmSavedId('');
      pushToast({ tone: 'info', title: 'Removed from saved', detail: `${item.name} is no longer in Tools & Saved.` });
    } catch {
      // Put it back where it was, not at the top: a failed delete must not look
      // like a successful re-add.
      setSavedItems((prev) => {
        const restored = [...prev];
        restored.splice(Math.min(index, restored.length), 0, item);
        return restored;
      });
      setNotice('Unable to remove saved item. Please check your connection and try again.');
      setConfirmSavedId('');
      pushToast({ tone: 'danger', title: 'Could not remove item', detail: 'It is back in your saved list. Check your connection and try again.' });
    } finally {
      setRemovingSavedId('');
    }
  };

  /* ---------------- loading ---------------- */
  if (loading) {
    return (
      <div className="edureach-dash-container" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ margin: '0 auto 12px', display: 'flex', justifyContent: 'center' }}><BrandLogo height={48} radius="50%" /></div>
          <h1 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0f172a' }}>Loading your dashboard…</h1>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#5e6c82' }}>Checking your session and syncing your records.</p>
          <SkeletonRows rows={3} label="Loading dashboard records" />
        </div>
      </div>
    );
  }

  if (loadFailure) {
    return <main id="main-content" className="edureach-dash-container" style={{ display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div className="dash-card" role="alert">
        <h1 className="dash-page-title">Dashboard unavailable</h1>
        <p>We could not load your dashboard. Please check your connection and try again.</p>
        <button type="button" className="dash-btn dash-btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </main>;
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

  const requestLoadFailure = (
    <InlineNotice tone="danger" title="Requests unavailable" retryLabel="Refresh page" onRetry={() => window.location.reload()}>
      We could not load your requests. Check your connection and try again to see your service request status.
    </InlineNotice>
  );

  const requestsTable = (rows: RequestRow[]) => (
    <>
      <div className="dash-table-wrap dash-desktop-only">
        <table className="dash-table">
          <thead><tr><th scope="col">Reference</th><th scope="col">Request</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col" /></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} id={`request-${row.reference_code}`}>
              <td className="dash-mono">{row.reference_code}</td>
              <td><strong>{requestTitle(row)}</strong><small className="dash-table-description">{requestDescription(row)}</small></td>
              <td>{requestCategory(row)}</td>
              <td><span className={statusClass(row.status)}>{statusLabel(row.status)}</span><small className="dash-table-description">{serviceStatusMeaning(row.status).meaning}</small></td>
              <td>{fmtDate(row.created_at)}</td>
              <td><div className="dash-request-actions"><a className="dash-card-link" href={`/dashboard/services?ref=${encodeURIComponent(row.reference_code)}`}>View</a><a className="dash-card-link" href={requestWhatsAppHref(row)} target="_blank" rel="noopener noreferrer">WhatsApp</a></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <ul className="dash-rows dash-mobile-only">{rows.map((row) => (
        <li key={row.id} id={`request-${row.reference_code}-mobile`} className="dash-row">
          <div className="dash-row-top"><span className="dash-mono">{row.reference_code}</span><span className={statusClass(row.status)}>{statusLabel(row.status)}</span></div>
          <strong className="dash-row-title">{requestTitle(row)}</strong>
          <span className="dash-request-category">{requestCategory(row)}</span>
          <p className="dash-request-description">{requestDescription(row)}</p>
          <p className={`dash-request-status-meaning${needsStudentAction(row.status) ? ' is-action' : ''}`}>
            {serviceStatusMeaning(row.status).meaning}
          </p>
          <div className="dash-row-meta"><span>{fmtDate(row.created_at)}</span><span className="dash-request-actions"><a className="dash-card-link" href={`/dashboard/services?ref=${encodeURIComponent(row.reference_code)}`}>View</a><a className="dash-card-link" href={requestWhatsAppHref(row)} target="_blank" rel="noopener noreferrer">WhatsApp</a></span></div>
        </li>
      ))}</ul>
    </>
  );

  const attemptsTable = (rows: Attempt[]) => (
    <>
      <div className="dash-table-wrap dash-desktop-only">
        <table className="dash-table">
          <thead><tr><th scope="col">Test</th><th scope="col">Status</th><th scope="col">Score</th><th scope="col">Date</th><th scope="col" /></tr></thead>
          <tbody>{rows.map((row) => {
            const state = cbtAttemptState(row);
            const label = state === 'active' ? 'In progress' : state === 'expired' ? 'Time ran out' : row.status === 'submitted' ? isScoredSubmission(row) ? 'Submitted' : 'Submitted · score unavailable' : row.status === 'cancelled' ? 'Cancelled' : 'Unavailable';
            return <tr key={row.id}>
              <td>{attemptTitle(row)} <small className="dash-table-description">{cbtModeLabel(row.mode)}{state === 'active' ? ' · Unfinished attempt' : ''}</small></td>
              <td><span className={`dash-status-pill ${state === 'active' ? 'dash-status-processing' : row.status === 'submitted' ? 'dash-status-completed' : 'dash-status-rejected'}`}>{label}</span></td>
              <td><strong>{isScoredSubmission(row) ? `${Math.round(Number(row.score))}%` : row.status === 'submitted' ? 'Result unavailable' : '—'}</strong></td>
              <td>{fmtDate(row.submitted_at || row.created_at)}</td>
              <td>
                <span className="dash-row-actions">
                  {state === 'active' && <a className="dash-card-link" href={`/cbt/session/${encodeURIComponent(row.id)}`}>Resume</a>}
                  {state === 'expired' && <a className="dash-card-link" href="/cbt">Start a new test</a>}
                  {row.status === 'submitted' && <a className="dash-card-link" href={`/dashboard/cbt/results/${encodeURIComponent(row.id)}`}>Review</a>}
                  {state !== 'active' && (confirmDeleteId === row.id ? (
                    <span className="dash-inline-confirm" role="group" aria-label={`Delete ${row.subject || 'this result'}`}>
                      <span>Delete this result?</span>
                      <button type="button" className="dash-card-link" onClick={() => setConfirmDeleteId('')} disabled={deletingId === row.id}>Keep</button>
                      <button
                        type="button"
                        className="dash-btn dash-btn-small dash-btn-danger"
                        onClick={() => void removeAttempt(row)}
                        disabled={deletingId === row.id}
                        aria-busy={deletingId === row.id}
                      >
                        {deletingId === row.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="dash-icon-btn"
                      aria-label="Delete"
                      title="Delete this result"
                      onClick={() => { setAttemptNotice(''); setConfirmDeleteId(row.id); }}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  ))}
                </span>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <ul className="dash-rows dash-mobile-only">{rows.map((row) => {
        const state = cbtAttemptState(row);
        const label = state === 'active' ? 'In progress' : state === 'expired' ? 'Time ran out' : isScoredSubmission(row) ? `${Math.round(Number(row.score))}%` : row.status === 'submitted' ? 'Submitted · score unavailable' : row.status === 'cancelled' ? 'Cancelled' : 'Unavailable';
        return <li key={row.id} className={`dash-row${state === 'active' ? ' dash-cbt-active-row' : ''}`}>
          <div className="dash-row-top"><strong className="dash-row-title">{attemptTitle(row)} · {cbtModeLabel(row.mode)}</strong><span className="dash-row-score">{label}</span></div>
          <div className="dash-row-meta">
            <span>{isScoredSubmission(row) ? `${row.correct_answers}/${row.total_questions} correct` : state === 'expired' ? 'Time ran out' : state === 'active' ? 'Unfinished attempt' : label} • {fmtDate(row.submitted_at || row.created_at)}</span>
            {state === 'active' && <a className="dash-card-link" href={`/cbt/session/${encodeURIComponent(row.id)}`}>Resume →</a>}
            {state === 'expired' && <a className="dash-card-link" href="/cbt">Start a new test →</a>}
            {row.status === 'submitted' && <a className="dash-card-link" href={`/dashboard/cbt/results/${encodeURIComponent(row.id)}`}>Review →</a>}
            {state !== 'active' && (confirmDeleteId === row.id ? (
              <span className="dash-inline-confirm" role="group" aria-label={`Delete ${row.subject || 'this result'}`}>
                <span>Delete this result?</span>
                <button type="button" className="dash-card-link" onClick={() => setConfirmDeleteId('')} disabled={deletingId === row.id}>Keep</button>
                <button type="button" className="dash-card-link dash-delete-link" onClick={() => void removeAttempt(row)} disabled={deletingId === row.id} aria-busy={deletingId === row.id}>
                  {deletingId === row.id ? 'Deleting…' : 'Delete'}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="dash-icon-btn"
                aria-label="Delete"
                title="Delete this result"
                onClick={() => { setAttemptNotice(''); setConfirmDeleteId(row.id); }}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </li>;
      })}</ul>
    </>
  );

  const overview = (
    <>
      <header className="dash-overview-head">
        <div>
          <span className="dash-overview-role">Student · Overview</span>
          <div className="dash-overview-name">
            <h1>{displayName}</h1>
            {emailVerified && <VerifiedBadge />}
          </div>
          <p>Your learning overview</p>
        </div>
        <div className="dash-overview-actions">
          <span className={`dash-profile-state${profileComplete ? ' is-complete' : ''}`}>
            {profileComplete ? <ShieldCheck size={14} aria-hidden="true" /> : <User size={14} aria-hidden="true" />}
            {profileComplete ? 'Profile complete' : `${profileCompletionPercent}% complete`}
          </span>
          <a href="/profile" className="dash-btn dash-btn-secondary">
            <Edit size={13} aria-hidden="true" /> {profileComplete ? 'Edit profile' : 'Complete profile'}
          </a>
        </div>
      </header>

      {priorities.length > 0 && (
        <section className="dash-attention" aria-labelledby="dash-priority-heading">
          <div className="dash-attention-head">
            <h2 id="dash-priority-heading">Needs attention</h2>
            <span className="dash-attention-count">{priorities.length}</span>
          </div>
          <ul className="dash-priority-list">
            {priorities.map((item) => (
              <li key={item.id} className={`dash-priority-item is-${item.tone}`}>
                <span className="dash-priority-icon" aria-hidden="true">
                  {item.tone === 'urgent' ? <AlarmClock size={15} /> : item.id === 'request-needs-info' ? <ClipboardList size={15} /> : item.id === 'profile-incomplete' ? <User size={15} /> : <Bell size={15} />}
                </span>
                <div className="dash-priority-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <a className="dash-card-link" href={item.href}>{item.cta} →</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dash-kpi-grid" aria-label="Learning summary">
        <article className="dash-kpi">
          <p className="dash-kpi-label">Average score</p>
          <strong className="dash-kpi-value">{performance.averageScore !== null ? `${performance.averageScore}%` : '—'}</strong>
          <p className="dash-kpi-meta">{performance.scoredCount ? `Across ${performance.scoredCount} scored ${performance.scoredCount === 1 ? 'paper' : 'papers'}` : 'No scored paper yet'}</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi-label">Latest score</p>
          <div className="dash-kpi-inline">
            <strong className="dash-kpi-value">{performance.latest ? `${performance.latest.score}%` : '—'}</strong>
            {performance.latest?.change !== null && performance.latest?.change !== undefined && <ChangeChip change={performance.latest.change} />}
          </div>
          <p className="dash-kpi-meta">{performance.latest ? performance.latest.subject : 'Take a practice paper to begin'}</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi-label">Papers scored</p>
          <strong className="dash-kpi-value">{performance.scoredCount.toLocaleString()}</strong>
                  </article>
        <article className="dash-kpi">
          <p className="dash-kpi-label">Open requests</p>
          <strong className="dash-kpi-value">{openRequests.toLocaleString()}</strong>
          <p className="dash-kpi-meta">{requests.length ? `${requests.length} in your history` : 'No service requests yet'}</p>
        </article>
      </section>

      {performance.scoredCount ? (
        <>
          <section className="dash-analytics" aria-labelledby="dash-analytics-heading">
            <div className="dash-analytics-head">
              <div>
                <h2 id="dash-analytics-heading">Performance</h2>
                <p>Scored papers only.</p>
              </div>
              <button type="button" className="dash-card-link" onClick={() => openTab('cbt')}>All results</button>
            </div>
            <div className="dash-analytics-grid">
              <article className="dash-chart-panel dash-chart-panel--wide">
                <h3>Score trend</h3>
                <TrendChart points={performance.trend} />
              </article>

              <article className="dash-chart-panel">
                <h3>Subject averages</h3>
                {performance.subjects.length ? (
                  <SubjectBars rows={performance.subjects} />
                ) : (
                  <p className="dash-chart-empty">Needs a single-subject paper.</p>
                )}
              </article>

              <article className="dash-chart-panel dash-latest-panel">
                <h3>Latest result</h3>
                {performance.latest ? (
                  <>
                    <div className="dash-latest-score">
                      <strong>{performance.latest.score}%</strong>
                      {performance.latest.change !== null && <ChangeChip change={performance.latest.change} />}
                    </div>
                    <p className="dash-latest-subject">{performance.latest.subject}</p>
                    {performance.latest.id && (
                      <a className="dash-card-link" href={`/dashboard/cbt/results/${encodeURIComponent(performance.latest.id)}`}>View result →</a>
                    )}
                  </>
                ) : (
                  <p className="dash-chart-empty">No scored paper yet.</p>
                )}
              </article>

              <article className="dash-chart-panel">
                <h3>Score distribution</h3>
                <DistributionChart buckets={performance.distribution} total={performance.distributionTotal} />
              </article>

              {latestCgpaSnapshot ? (
                <article className="dash-chart-panel dash-cgpa-trend">
                  <h3>CGPA trend</h3>
                  <ol>
                    {cgpaHistory.slice(-6).map((snapshot) => (
                      <li key={`${snapshot.termLabel}-${snapshot.gpa}`}>
                        <span className="dash-cgpa-trend-value">{snapshot.gpa}</span>
                        <span className="dash-cgpa-trend-bar" aria-hidden="true"><i style={{ height: `${Math.max((Number(snapshot.gpa) / cgpaScaleMax) * 100, 4)}%` }} /></span>
                        <span className="dash-cgpa-trend-label">{snapshot.termLabel}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ) : null}
            </div>
          </section>

          <section className="dash-insights" aria-label="Performance summary">
            <article className="dash-insight">
              <h3>Strengths</h3>
              {performance.highlights.strengths.length ? (
                <ul>
                  {performance.highlights.strengths.map((row) => (
                    <li key={row.subject}><strong>{row.subject}</strong><span>{row.average}% average</span></li>
                  ))}
                </ul>
              ) : (
                <p>No subject average is above 70% yet.</p>
              )}
            </article>
            <article className="dash-insight">
              <h3>Needs practice</h3>
              {performance.highlights.needsPractice.length ? (
                <ul>
                  {performance.highlights.needsPractice.map((row) => (
                    <li key={row.subject}><strong>{row.subject}</strong><span>{row.average}% average</span></li>
                  ))}
                </ul>
              ) : (
                <p>No subject average is below 70% in this sample.</p>
              )}
            </article>
            <article className="dash-insight is-next">
              <h3>Next step</h3>
              {performance.recommendation ? (
                <>
                  <p>{performance.recommendation.detail}</p>
                  <a className="dash-card-link" href={performance.recommendation.href}>{performance.recommendation.cta} →</a>
                </>
              ) : (
                <p>Complete one more scored paper for a specific recommendation.</p>
              )}
            </article>
          </section>
        </>
      ) : (
        <section className="dash-card dash-no-data">
          <div>
            <h2>Not enough activity yet</h2>
            <p>Your first scored paper unlocks the score trend, subject averages and recommendations.</p>
          </div>
          <a className="dash-btn dash-btn-primary" href="/cbt">Start a practice paper</a>
        </section>
      )}

      <section className="dash-card" id="dashboard-notifications">
        <div className="dash-card-header">
          <h2 className="dash-card-title"><Bell size={14} className="dash-card-title-icon" /> Notifications</h2>
          {unreadNotifications > 0 && (
            <button type="button" className="dash-card-link" onClick={markAllNotificationsRead} disabled={notificationsBusy}>
              {notificationsBusy ? 'Marking…' : `Mark all as read (${unreadNotifications})`}
            </button>
          )}
        </div>
        {notifications.length ? (
          <ul className="dash-rows">
            {notifications.slice(0, 4).map((item) => (
              <li key={item.id} className={`dash-row ${item.read ? '' : 'dash-notification-unread'}`}>
                <div className="dash-row-top">
                  <strong className="dash-row-title">
                    {!item.read && <span className="dash-notification-dot" aria-label="Unread" />}
                    {item.title}
                  </strong>
                  <span className="dash-row-meta">{item.time}</span>
                </div>
                {item.body && <p className="dash-request-description">{item.body}</p>}
                {item.href && (
                  <a
                    className="dash-card-link"
                    href={item.href}
                    onClick={() => trackEvent('notification_open', { metadata: { status: item.status } })}
                  >
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : emptyState('No notifications yet. When a service request you submitted changes status, it appears here.', '/services', 'Browse services')}
      </section>

      <section className="dash-card dash-recent-activity" aria-labelledby="dash-recent-activity-heading">
        <div className="dash-card-header">
          <h2 className="dash-card-title" id="dash-recent-activity-heading">Recent activity</h2>
        </div>
        {isLocalMode && requests.length > 0 && <p>These local preview records were not submitted to EduReach; they exist only on this device.</p>}
        <div className="dash-recent-activity-group">
          <div className="dash-recent-activity-heading">
            <h3>Service requests</h3>
            {requests.length > 0 && <button type="button" className="dash-card-link" onClick={() => openTab('services')}>View all ({requests.length})</button>}
          </div>
          {requestsUnavailable
            ? requestLoadFailure
            : requests.length
            ? requestsTable(requests.slice(0, 3))
            : emptyState('No service requests yet. When you request NELFUND help, result checking, a JAMB slip or admission support, its live status appears here.', '/services', 'Browse services')}
        </div>
        <div className="dash-recent-activity-group">
          <div className="dash-recent-activity-heading">
            <h3>CBT results</h3>
            {attempts.length > 0 && <button type="button" className="dash-card-link" onClick={() => openTab('cbt')}>View all ({attempts.length})</button>}
          </div>
          {attemptsUnavailable
            ? <p role="status">CBT history could not be loaded. Please refresh to try again.</p>
            : attempts.length
            ? attemptsTable(attempts.slice(0, 3))
            : emptyState('No CBT attempts yet. Take a timed practice test and your scores will be tracked here.', '/cbt', 'Start practice')}
        </div>
      </section>
    </>
  );

  const requestsView = (
    <section className="dash-card">
      <div className="dash-card-header">
        <div>
          <h1 className="dash-page-title">My Requests</h1>
          <p className="dash-page-sub">{requestsUnavailable ? 'Request status is unavailable.' : requests.length ? `${requests.length} request${requests.length === 1 ? '' : 's'} • ${openRequests} in progress` : 'Every service request you submit is tracked here.'}</p>
        </div>
        <a href="/services" className="dash-btn dash-btn-primary">New request</a>
      </div>
      {isLocalMode && requests.length > 0 && <p>These local preview records were not submitted to EduReach; they exist only on this device.</p>}
      {requestsUnavailable ? requestLoadFailure : requests.length
        ? requestsTable(requests)
        : emptyState('No service requests yet. Choose a service to get started: NELFUND loan support, WAEC/NECO result checking, JAMB slips or admission letters.', '/services', 'Browse services')}
    </section>
  );

  const cbtView = (
    <section className="dash-card" aria-labelledby="dash-cbt-heading">
      <div className="dash-card-header">
        <div>
          <h1 className="dash-page-title" id="dash-cbt-heading" tabIndex={-1}>My CBT</h1>
          <p className="dash-page-sub">Timed practice attempts across JAMB, WAEC, NECO and Post-UTME.</p>
        </div>
        <a href="/cbt" className="dash-btn dash-btn-primary">Start practice</a>
      </div>
      {attemptsUnavailable ? <p role="status">CBT history could not be loaded. Please refresh to try again.</p> : <>
      <p className="dash-metric-hint">Statistics below cover the most recent {attempts.length} attempt{attempts.length === 1 ? '' : 's'} loaded (up to 50), not all-time totals.</p>
      <div className="dash-metric-strip">
        <div className="dash-metric-card">
          <span className="dash-metric-label">Scored tests</span>
          <span className="dash-metric-val">{completedAttempts.length}</span>
        </div>
        <div className="dash-metric-card">
          <span className="dash-metric-label">Average score</span>
          <span className={`dash-metric-val${hasScores ? '' : ' is-empty'}`}>{averageScore !== null ? `${averageScore}%` : '—'}</span>
          {!hasScores && <span className="dash-metric-hint">{submittedAttempts.length ? 'When a scored result is available' : 'After your first test'}</span>}
        </div>
        <div className="dash-metric-card">
          <span className="dash-metric-label">Best score</span>
          <span className={`dash-metric-val${hasScores ? '' : ' is-empty'}`}>{bestScore !== null ? `${bestScore}%` : '—'}</span>
          {!hasScores && <span className="dash-metric-hint">{submittedAttempts.length ? 'When a scored result is available' : 'After your first test'}</span>}
        </div>
        <div className="dash-metric-card">
          <span className="dash-metric-label">Latest score</span>
          <span className={`dash-metric-val${performance.latest ? '' : ' is-empty'}`}>{performance.latest ? `${performance.latest.score}%` : '—'}</span>
          <span className="dash-metric-hint">{performance.latest ? performance.latest.subject : 'No scored paper yet'}</span>
        </div>
        <div className="dash-metric-card">
          <span className="dash-metric-label">Accuracy</span>
          <span className={`dash-metric-val${overallAccuracy !== null ? '' : ' is-empty'}`}>{overallAccuracy !== null ? `${overallAccuracy}%` : '—'}</span>
          <span className="dash-metric-hint">{overallAccuracy !== null ? `${scoredCorrect} of ${scoredQuestions} questions` : 'No question counts recorded'}</span>
        </div>
        <div className="dash-metric-card">
          <span className="dash-metric-label">In progress</span>
          <span className="dash-metric-val">{attempts.filter(isActiveCbtAttempt).length}</span>
        </div>
        {submittedAttempts.length > completedAttempts.length && (
          <div className="dash-metric-card">
            <span className="dash-metric-label">Submitted, score unavailable</span>
            <span className="dash-metric-val">{submittedAttempts.length - completedAttempts.length}</span>
          </div>
        )}
        {expiredAttempts.length > 0 && (
          <div className="dash-metric-card">
            <span className="dash-metric-label">Ran out of time</span>
            <span className="dash-metric-val">{expiredAttempts.length}</span>
          </div>
        )}
        <div className="dash-metric-card">
          <span className="dash-metric-label">Questions in completed tests</span>
          <span className="dash-metric-val">{questionsInCompletedTests}</span>
          {questionsInCompletedTests === 0 && <span className="dash-metric-hint">No completed paper yet</span>}
        </div>
      </div>

      <section className="dash-cbt-latest" aria-labelledby="dash-latest-cbt">
        <div className="dash-cbt-latest-head">
          <div>
            <h2 id="dash-latest-cbt" className="dash-card-title">Latest CBT</h2>
            <p className="dash-metric-hint">The most recent submitted paper in this sample. Nothing is inferred for missing fields.</p>
          </div>
          {latestAttempt && <a className="dash-card-link" href={`/dashboard/cbt/results/${encodeURIComponent(latestAttempt.id)}`}>Review result →</a>}
        </div>
        {latestAttempt ? (
          <div className="dash-cbt-latest-grid">
            <div><span>Exam / subjects</span><strong>{attemptTitle(latestAttempt)}</strong></div>
            <div><span>Date</span><strong>{fmtDate(latestAttempt.submitted_at || latestAttempt.created_at)}</strong></div>
            <div><span>Score</span><strong>{isScoredSubmission(latestAttempt) ? `${Math.round(Number(latestAttempt.score))}%` : 'Unavailable'}</strong></div>
            <div><span>Status</span><strong>{latestAttempt.status === 'submitted' ? 'Submitted' : latestAttempt.status || 'Recorded'}</strong></div>
            <div><span>Accuracy</span><strong>{latestAccuracy !== null ? `${latestAccuracy}%` : 'Unavailable'}</strong></div>
            <div><span>Time</span><strong>{latestDurationMinutes !== null && latestDurationMinutes > 0 ? `${latestDurationMinutes} min` : 'Not recorded'}</strong></div>
          </div>
        ) : (
          <p className="dash-chart-empty">No submitted CBT yet. Start a practice paper and your latest result will appear here.</p>
        )}
      </section>

      <section className="dash-cbt-analysis" aria-labelledby="dash-performance-analysis">
        <div className="dash-card-header">
          <div>
            <h2 id="dash-performance-analysis" className="dash-card-title">Performance analysis</h2>
            <p className="dash-metric-hint">Latest, average, best and accuracy come from the scored papers loaded above.</p>
          </div>
        </div>
        <div className="dash-cbt-analysis-grid">
          <div className="dash-chart-panel">
            <h3>Score trend</h3>
            {performance.trend.length >= 2
              ? <><TrendChart points={performance.trend} /><p className="dash-metric-hint">{performance.trendSummary ? `${performance.trendSummary.direction === 'up' ? 'Up' : performance.trendSummary.direction === 'down' ? 'Down' : 'No change'} ${Math.abs(performance.trendSummary.change)} points from the first to the latest scored paper in this sample.` : 'Trend needs two scored papers.'}</p></>
              : <p className="dash-chart-empty">No performance trend yet. Complete two scored papers to compare your scores; one score is a result, not a direction.</p>}
          </div>
          <div className="dash-chart-panel">
            <h3>Subjects</h3>
            {performance.subjects.length ? (
              <>
                <p className="dash-metric-hint">Only single-subject papers with a complete saved plan are compared.</p>
                {performance.highlights.strengths.length > 0 && <p className="dash-cbt-subject-line"><span className="dash-band is-strong">Strongest</span> {performance.highlights.strengths.map((row) => `${row.subject} ${row.average}%`).join(' · ')}</p>}
                {performance.highlights.needsPractice.length > 0 && <p className="dash-cbt-subject-line"><span className="dash-band is-needs-practice">Needs practice</span> {performance.highlights.needsPractice.map((row) => `${row.subject} ${row.average}%`).join(' · ')}</p>}
                {!performance.highlights.strengths.length && !performance.highlights.needsPractice.length && <p className="dash-chart-empty">No strong or weak subject yet; more single-subject papers are needed.</p>}
              </>
            ) : <p className="dash-chart-empty">No subject comparison yet. A single-subject paper with a saved question plan is needed.</p>}
          </div>
        </div>
      </section>

      {subjectCounts.length > 0 && <div aria-labelledby="dash-subject-summary">
        <h2 id="dash-subject-summary" className="dash-card-title">Subjects selected in completed tests</h2>
        <p className="dash-metric-hint">Counts use loaded submissions with recorded subjects, including unscored submissions. A paper with multiple subjects counts once for each subject; these are not subject scores.</p>
        <ul>{subjectCounts.map(({ subject, count }) => <li key={subject}>{subject}: {count} submitted {count === 1 ? 'test' : 'tests'}</li>)}</ul>
      </div>}
      <div className="dash-learning-progress" aria-labelledby="dash-subject-progress">
        <h2 id="dash-subject-progress" className="dash-card-title">Subject progress</h2>
        <p className="dash-metric-hint">From scored papers whose saved question plan contains only one subject. Multi-subject papers and missing or inconsistent plans are excluded. Percentages use correct answers across the included questions, not subject selections.</p>
        {subjectProgress.length ? <ul className="dash-rows">{subjectProgress.map(row => <li className="dash-row" key={row.subject}>
          <div className="dash-row-top"><strong className="dash-row-title">{row.subject}</strong><span className="dash-row-score">{row.average}%</span></div>
          <div className="dash-row-meta">{row.correct} of {row.questions} questions correct across {row.attempts} scored {row.attempts === 1 ? 'paper' : 'papers'}{row.latest !== null ? ` · Latest ${row.latest}%` : ''}{row.previous !== null ? ` · Previous ${row.previous}%` : ''}</div>
        </li>)}</ul> : <p className="dash-metric-hint">No single-subject scored papers with a complete saved question plan in this sample yet.</p>}
        <h3 className="dash-card-title">Practice suggestion</h3>
        {suggestedSubject ? <p className="dash-metric-hint">Consider another {suggestedSubject.subject} practice paper. It has the lowest score among subjects with at least two scored single-subject papers and 20 questions in this sample; this is not a weak-topic diagnosis. <a className="dash-card-link" href="/cbt">Choose practice</a></p> : <p className="dash-metric-hint">A comparison needs at least two subjects with two scored single-subject papers and 20 questions each, with different scores. Review a result or choose a practice paper in the meantime.</p>}
      </div>
      <p className="dash-metric-hint">{scoreChange === null ? 'Complete two scored tests to compare your latest results.' : `Latest score compared with your previous scored test: ${scoreChange > 0 ? '+' : ''}${scoreChange} percentage points. Different papers may not be directly comparable.`} Review completed results to decide what to practise next; subject-level weaknesses are not inferred from overall scores.</p>
      <div className="dash-attempt-notice" role="status" aria-live="polite">{attemptNotice}</div>

      {attempts.length
        ? (
          <>
            {attemptsTable(visibleAttempts)}
            <div className="dash-attempt-pager">
              <p className="dash-metric-hint">
                Showing {attemptPageView.first}–{attemptPageView.last} of {attempts.length}
                {attempts.length >= 50 ? ' (most recent 50)' : ''}
              </p>
              {pageCount > 1 && (
                <div className="dash-pager-actions">
                  <button type="button" className="dash-btn dash-btn-small dash-btn-secondary" onClick={() => setAttemptPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>Previous</button>
                  <span className="dash-metric-hint" aria-live="polite">Page {safePage + 1} of {pageCount}</span>
                  <button type="button" className="dash-btn dash-btn-small dash-btn-secondary" onClick={() => setAttemptPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1}>Next</button>
                </div>
              )}
            </div>
          </>
        )
        : emptyState('No attempts yet. Your scores, best result and question count will build up here after your first practice test.', '/cbt', 'Start practice')}
      </>}
    </section>
  );

  const toolsView = (
    <>
      <div className="dash-page-head">
        <h1 className="dash-page-title">Tools &amp; Saved</h1>
        <p className="dash-page-sub">Your CGPA calculator, the verified school directory and everything you have shortlisted.</p>
      </div>
      <div className="dash-tools-grid">
        <CgpaCalculatorCard
          userId={userId}
          isLocalMode={isLocalMode}
          initialCourses={cgpaCourses}
          latestSnapshot={latestCgpaSnapshot}
          onSnapshotSaved={(snapshot) => {
            setLatestCgpaSnapshot(snapshot);
            setCgpaSnapshots((current) => current.some((entry) => entry.id === snapshot.id) ? current : [snapshot, ...current].slice(0, 8));
          }}
        />
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
                  {confirmSavedId === item.id ? (
                    <span className="dash-inline-confirm" role="group" aria-label={`Remove ${item.name}`}>
                      <span>Remove?</span>
                      <button type="button" className="dash-card-link" onClick={() => setConfirmSavedId('')} disabled={removingSavedId === item.id}>Keep</button>
                      <button
                        type="button"
                        className="dash-btn dash-btn-small dash-btn-danger"
                        onClick={() => void removeSaved(item.id)}
                        disabled={removingSavedId === item.id}
                        aria-busy={removingSavedId === item.id}
                      >
                        {removingSavedId === item.id ? 'Removing…' : 'Remove'}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="dash-icon-btn"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => { setNotice(''); setConfirmSavedId(item.id); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
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
      <SkipLink />
      {adminStudentView && (
        <div className="er-admin-view-banner" role="note">
          <span>Admin preview: you are browsing the student portal as a student.</span>
          <button type="button" onClick={() => { window.sessionStorage.removeItem('edureach-admin-student-view'); navigateInApp('/admin'); }}>← Return to admin</button>
        </div>
      )}

      <header className="edureach-dash-header">
        <div className="edureach-dash-bar">
          <a href="/" className="edureach-dash-brand" aria-label="EduReach home"><BrandLogo height={36} radius="50%" /></a>

          <SiteSearch variant="dashboard" label="Search EduReach" placeholder="Search services, exams or news" submitLabel="Go" />

          <div className="edureach-dash-actions">
            <NotificationCenter variant="dashboard" />
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
          <span className="dash-nav-label">Study</span>
          <a href="/past-questions" className="edureach-nav-item"><BookOpen size={15} /> Past questions</a>
          <a href="/dashboard/cbt/results" className="edureach-nav-item"><BarChart3 size={15} /> Results</a>
          <a href="/services" className="edureach-nav-item"><ClipboardList size={15} /> Services</a>
          <a href="/screening-calculator" className="edureach-nav-item"><Calculator size={15} /> Calculators</a>
          <div className="dash-nav-divider" />
          {accountLinks}
        </aside>

        <main className="edureach-dash-main" id="main-content" tabIndex={-1}>
          {error && (
            <InlineNotice tone="danger" title="Error" onRetry={() => setError('')}>
              {error}
            </InlineNotice>
          )}
          {notice && (
            <InlineNotice tone="danger" onRetry={() => setNotice('')}>
              {notice}
            </InlineNotice>
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
        // Redundant pointer affordance: the Account button toggles the sheet and Escape closes it.
        <div className="dash-sheet-backdrop" role="presentation" onClick={() => setAccountSheetOpen(false)}>
          <div ref={accountSheetRef} tabIndex={-1} className="dash-sheet" role="dialog" aria-modal="true" aria-label="Account" onClick={(e) => e.stopPropagation()}>
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
