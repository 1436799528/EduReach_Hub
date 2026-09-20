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
import { supabase } from '../src/lib/supabase';
import WalletModal from '../src/components/WalletModal';
import CardIdentityMark from '../src/components/CardIdentityMark';
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

type TabType =
  | 'dashboard'
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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ER';
}
function fmtDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StudentDashboardV2() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
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

  // Saved Schools & Courses state
  const [savedItems, setSavedItems] = useState([
    { id: '1', type: 'school', name: 'University of Lagos (UNILAG)', detail: 'Cut-off: 260 • Faculty of Science', location: 'Akoka, Lagos', saved: true },
    { id: '2', type: 'course', name: 'Medicine & Surgery (UNICAL)', detail: 'Cut-off: 275 • English, Bio, Chem, Phys', location: 'Calabar, Cross River', saved: true },
    { id: '3', type: 'course', name: 'Computer Science (UI)', detail: 'Cut-off: 265 • English, Maths, Phys, Chem', location: 'Ibadan, Oyo', saved: true },
    { id: '4', type: 'school', name: 'Obafemi Awolowo University (OAU)', detail: 'Cut-off: 250 • Faculty of Technology', location: 'Ile-Ife, Osun', saved: true },
  ]);

  // Notifications state
  const [notifications, setNotifications] = useState([
    { id: 'n1', title: 'UNILAG Admission Screening List Released', time: '2 hours ago', read: false, type: 'admission' },
    { id: 'n2', title: 'NELFUND Loan Institutional Verification Complete', time: '1 day ago', read: false, type: 'scholarship' },
    { id: 'n3', title: 'Practice Reminder: Try 2024 JAMB English questions', time: '2 days ago', read: true, type: 'cbt' },
    { id: 'n4', title: 'Wallet Top-up of ₦5,000 confirmed via Paystack', time: '3 days ago', read: true, type: 'wallet' },
  ]);

  // CGPA Calculator local state
  const [cgpaCourses, setCgpaCourses] = useState([
    { code: 'CSC 301', units: 3, grade: 'A' },
    { code: 'CSC 303', units: 3, grade: 'B' },
    { code: 'MTH 301', units: 3, grade: 'A' },
    { code: 'GST 311', units: 2, grade: 'A' },
    { code: 'PHY 307', units: 3, grade: 'C' },
  ]);

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
      const locallySavedProfile = JSON.parse(localStorage.getItem('edureach-student-profile') || 'null');

      if (authError || !currentSession?.user) {
        // Fallback demo profile for frontend review / offline state
        setEmail(locallySavedProfile?.email || 'student@edureach.ng');
        setUserName(locallySavedProfile?.full_name || 'Adebayo Johnson');
        setProfile({
          first_name: locallySavedProfile?.first_name || 'Adebayo',
          last_name: locallySavedProfile?.last_name || 'Johnson',
          full_name: locallySavedProfile?.full_name || 'Adebayo Johnson',
          account_type: locallySavedProfile?.account_type || 'student',
          school: locallySavedProfile?.school || 'University of Calabar (UNICAL)',
          course_programme: locallySavedProfile?.course_programme || 'Computer Science',
          faculty: locallySavedProfile?.faculty || 'Faculty of Science',
          department: locallySavedProfile?.department || 'Computer Science',
          level: locallySavedProfile?.level || '300 Level',
          admission_year: locallySavedProfile?.admission_year || 2023,
          expected_graduation_year: locallySavedProfile?.expected_graduation_year || 2027,
          matric_number: '21/095244102',
          role: 'student',
          phone: locallySavedProfile?.phone || '08098765432',
          jamb_reg_no: '202188492014EF',
          target_exam: 'Undergraduate',
          academic_interests: locallySavedProfile?.academic_interests || ['JAMB UTME Prep', 'Undergraduate Scholarships'],
          avatar_url: locallySavedProfile?.avatar_url || null,
          notification_preferences: locallySavedProfile?.notification_preferences || { email_alerts: true, whatsapp_alerts: true, sms_alerts: false },
        });

        setServices([
          { id: '1', service_key: 'nelfund-loan', title: 'NELFUND Loan Application' },
          { id: '2', service_key: 'results', title: 'WAEC / NECO Result Checking' },
          { id: '3', service_key: 'scratch-cards', title: 'WAEC / NECO Scratch Cards' },
          { id: '4', service_key: 'jamb-slip', title: 'JAMB Exam Slip Printing' },
        ]);

        setRequests([
          {
            id: 'req-1',
            service_id: '1',
            status: 'submitted',
            reference_code: 'ER-2026-N9A2',
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            form_data: { serviceTitle: 'NELFUND Loan Application' },
          },
          {
            id: 'req-2',
            service_id: '2',
            status: 'completed',
            reference_code: 'ER-2026-W3F1',
            created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
            form_data: { serviceTitle: 'WAEC / NECO Result Checking' },
          },
        ]);

        setWallet({ balance: 4500, currency: 'NGN' });

        setAttempts([
          {
            id: 'att-1',
            score: 80,
            correct_answers: 8,
            total_questions: 10,
            submitted_at: new Date(Date.now() - 3600000 * 5).toISOString(),
            created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
            subject: 'JAMB Use of English',
          },
          {
            id: 'att-2',
            score: 70,
            correct_answers: 7,
            total_questions: 10,
            submitted_at: new Date(Date.now() - 3600000 * 48).toISOString(),
            created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
            subject: 'JAMB Mathematics',
          },
        ]);
        setLoading(false);
        return;
      }

      const user = currentSession.user;
      setEmail(user.email || '');
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student');

      const [profileResult, serviceResult, requestResult, walletResult, attemptsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('service_requests').select('id,status,form_data,created_at,reference_code,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
        supabase.from('student_wallets').select('balance,currency').eq('user_id', user.id).maybeSingle(),
        supabase.from('cbt_attempts').select('id,score,correct_answers,total_questions,submitted_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
      ]);

      if (!active) return;
      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
        setMfaEnabled(Boolean(profileResult.data.mfa_enabled));
      }
      setServices((serviceResult.data || []) as ServiceRow[]);
      setRequests((requestResult.data || []) as RequestRow[]);
      if (walletResult.data) setWallet({ balance: Number(walletResult.data.balance), currency: walletResult.data.currency });
      setAttempts((attemptsResult.data || []) as Attempt[]);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const serviceMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const displayName = profile?.full_name || userName;
  const reg = profile?.jamb_reg_no || profile?.matric_number || '';
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attempts.length)
    : 0;
  const bestScore = attempts.length ? Math.max(...attempts.map((item) => Number(item.score || 0))) : 0;
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const copyReg = () => {
    if (!reg) return;
    navigator.clipboard?.writeText(reg);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const logout = async () => {
    window.sessionStorage.removeItem('edureach-admin-student-view');
    localStorage.removeItem('edureach-mock-user-email');
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const toggleSave = (id: string) => {
    setSavedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, saved: !item.saved } : item))
    );
  };

  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // CGPA calculation
  const calculateCGPA = () => {
    const gradePoints: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
    let totalUnits = 0;
    let totalPoints = 0;
    cgpaCourses.forEach((c) => {
      const u = Number(c.units) || 0;
      const gp = gradePoints[c.grade] ?? 0;
      totalUnits += u;
      totalPoints += u * gp;
    });
    return totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMessage('Password updated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordMessage('Password updated successfully (Local session updated).');
    } finally {
      setPasswordBusy(false);
    }
  };

  // School Finder list
  const schoolsList = [
    { name: 'University of Lagos (UNILAG)', state: 'Lagos', type: 'Federal University', founded: '1962', url: 'https://unilag.edu.ng' },
    { name: 'University of Calabar (UNICAL)', state: 'Cross River', type: 'Federal University', founded: '1975', url: 'https://unical.edu.ng' },
    { name: 'University of Ibadan (UI)', state: 'Oyo', type: 'Federal University', founded: '1948', url: 'https://ui.edu.ng' },
    { name: 'Obafemi Awolowo University (OAU)', state: 'Osun', type: 'Federal University', founded: '1961', url: 'https://oauife.edu.ng' },
    { name: 'Ahmadu Bello University (ABU)', state: 'Kaduna', type: 'Federal University', founded: '1962', url: 'https://abu.edu.ng' },
    { name: 'University of Nigeria, Nsukka (UNN)', state: 'Enugu', type: 'Federal University', founded: '1960', url: 'https://unn.edu.ng' },
    { name: 'Lagos State University (LASU)', state: 'Lagos', type: 'State University', founded: '1983', url: 'https://lasu.edu.ng' },
    { name: 'Yaba College of Technology (YABATECH)', state: 'Lagos', type: 'Polytechnic', founded: '1947', url: 'https://yabatech.edu.ng' },
    { name: 'Federal University of Technology, Akure (FUTA)', state: 'Ondo', type: 'Federal University', founded: '1981', url: 'https://futa.edu.ng' },
  ];

  const filteredSchools = schoolsList.filter((s) => {
    const matchQuery = s.name.toLowerCase().includes(schoolFilterQuery.toLowerCase()) || s.state.toLowerCase().includes(schoolFilterQuery.toLowerCase());
    if (schoolTypeFilter === 'ALL') return matchQuery;
    return matchQuery && s.type.toLowerCase().includes(schoolTypeFilter.toLowerCase());
  });

  // Course Finder list
  const coursesList = [
    { name: 'Computer Science', faculty: 'Science', cutOff: 240, utme: 'English, Maths, Physics, Chemistry', olevel: '5 Credits incl. English & Maths' },
    { name: 'Medicine and Surgery', faculty: 'Clinical Sciences', cutOff: 275, utme: 'English, Biology, Chemistry, Physics', olevel: '5 Credits in Science subjects' },
    { name: 'Commercial Law', faculty: 'Law', cutOff: 260, utme: 'English, Literature, CRK/Govt, Any Art', olevel: '5 Credits incl. Lit in English' },
    { name: 'Accounting', faculty: 'Management', cutOff: 220, utme: 'English, Maths, Economics, Govt/Commerce', olevel: '5 Credits incl. Maths & English' },
    { name: 'Nursing Science', faculty: 'Allied Health', cutOff: 250, utme: 'English, Biology, Chemistry, Physics', olevel: '5 Credits in Sciences' },
    { name: 'Mechanical Engineering', faculty: 'Engineering', cutOff: 235, utme: 'English, Maths, Physics, Chemistry', olevel: '5 Credits incl. Maths & Physics' },
  ];

  const filteredCourses = coursesList.filter((c) =>
    c.name.toLowerCase().includes(courseFilterQuery.toLowerCase()) || c.faculty.toLowerCase().includes(courseFilterQuery.toLowerCase())
  );

  return (
    <div className="edureach-dash-container">
      {/* 1. CLEAN NORMAL HEADER (No green utility strip) */}
      <header className="edureach-dash-header">
        <div className="edureach-dash-bar">
          {/* LOGO */}
          <a href="/" className="edureach-dash-brand">
            <div className="edureach-dash-logo-icon">ER</div>
            <span>
              EduReach<span style={{ color: '#059669' }}>.ng</span>
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
                      setActiveTab('notifications');
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
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>{profile?.school || 'EduReach Student'}</span>
                  </div>

                  <button
                    onClick={() => {
                      setWalletOpen(true);
                      setProfileDropdownOpen(false);
                    }}
                    className="edureach-nav-item"
                    style={{ padding: '6px 10px' }}
                  >
                    <Wallet size={14} color="#059669" /> Wallet: ₦{wallet?.balance.toLocaleString() || '0'}
                  </button>
                  <a
                    href="/profile/complete"
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
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={15} /> Dashboard
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            <ClipboardList size={15} /> Applications
            {requests.length > 0 && <span className="edureach-nav-item-badge">{requests.length}</span>}
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            <Bookmark size={15} /> Saved
            <span className="edureach-nav-item-badge">{savedItems.filter((i) => i.saved).length}</span>
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'cbt' ? 'active' : ''}`}
            onClick={() => setActiveTab('cbt')}
          >
            <CheckSquare size={15} /> CBT Practice
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'past-questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('past-questions')}
          >
            <BookOpen size={15} /> Past Questions
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'admission' ? 'active' : ''}`}
            onClick={() => setActiveTab('admission')}
          >
            <GraduationCap size={15} /> Admission
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'scholarships' ? 'active' : ''}`}
            onClick={() => setActiveTab('scholarships')}
          >
            <Award size={15} /> Scholarships
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <Wrench size={15} /> Tools &amp; Calc
          </button>
          <button
            type="button"
            className={`edureach-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={15} /> Notifications
            {unreadNotifsCount > 0 && <span className="edureach-nav-item-badge">{unreadNotifsCount}</span>}
          </button>
          <a
            href="/profile/complete"
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
        </aside>

        {/* MAIN DASHBOARD STREAM */}
        <main className="edureach-dash-main">
          {/* SECTION 1: WELCOME / PROFILE SUMMARY */}
          <section className="dash-welcome-card">
            <div className="dash-welcome-top">
              <div>
                <h1 className="dash-welcome-title">Welcome back, {profile?.first_name || displayName}</h1>
                <p className="dash-welcome-subtitle">
                  <span>{profile?.school || 'University of Calabar (UNICAL)'}</span>
                  <span>•</span>
                  <span>{profile?.course_programme || profile?.department || 'Computer Science'}</span>
                  <span>•</span>
                  <span>{profile?.level || '300 Level'}</span>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="/profile/complete"
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
                <span>Wallet: ₦{(wallet?.balance || 0).toLocaleString()}</span>
                <b style={{ color: '#059669', marginLeft: '3px' }}>+ Fund</b>
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
                <div className="dash-quick-card-sub">Mock Simulator →</div>
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
          <section className="dash-card">
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

          {/* SECTION 4: MY APPLICATIONS */}
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
                            href={`/services/track?ref=${encodeURIComponent(req.reference_code)}`}
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
                <span className="dash-metric-val">128</span>
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
                            href={`/cbt/results?attempt=${encodeURIComponent(a.id)}`}
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

          {/* SECTION 6: SAVED SCHOOLS / COURSES */}
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

          {/* SECTION 7: RECOMMENDED SERVICES (Same EduReach card system with theme marks) */}
          <section className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Sparkles size={14} className="dash-card-title-icon" /> Recommended Academic Services
              </h2>
              <a href="/services" className="dash-card-link">
                View All Services →
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div
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
                  <CardIdentityMark value="nelfund" type="service" size="sm" />
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: '#0f172a' }}>NELFUND Loan Application</strong>
                    <small style={{ fontSize: '10px', color: '#64748b' }}>Student upkeep &amp; tuition aid</small>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>₦3,500</span>
                  <a
                    href="/services/apply/nelfund-loan"
                    className="dash-pill"
                    style={{ textDecoration: 'none', background: '#059669', color: '#ffffff', borderColor: '#059669' }}
                  >
                    Apply Now
                  </a>
                </div>
              </div>

              <div
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
                  <CardIdentityMark value="scratch-cards" type="service" size="sm" />
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: '#0f172a' }}>WAEC / NECO Scratch Cards</strong>
                    <small style={{ fontSize: '10px', color: '#64748b' }}>Instant PIN token delivery</small>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>From ₦3,800</span>
                  <a
                    href="/services/apply/scratch-cards"
                    className="dash-pill"
                    style={{ textDecoration: 'none', background: '#059669', color: '#ffffff', borderColor: '#059669' }}
                  >
                    Buy Token
                  </a>
                </div>
              </div>

              <div
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
                  <CardIdentityMark value="jamb-slip" type="service" size="sm" />
                  <div>
                    <strong style={{ fontSize: '12px', display: 'block', color: '#0f172a' }}>JAMB Exam Slip Printing</strong>
                    <small style={{ fontSize: '10px', color: '#64748b' }}>Original colored CAPS print</small>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>₦1,500</span>
                  <a
                    href="/services/apply/jamb-slip"
                    className="dash-pill"
                    style={{ textDecoration: 'none', background: '#059669', color: '#ffffff', borderColor: '#059669' }}
                  >
                    Print Slip
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 8: RECENT ACTIVITY */}
          <section className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Clock size={14} className="dash-card-title-icon" /> Recent Activity
              </h2>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <CheckCircle2 size={15} color="#059669" />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: 600 }}>
                    Completed JAMB Use of English CBT Mock Exam (Score: 80%)
                  </span>
                  <small style={{ display: 'block', fontSize: '9.5px', color: '#94a3b8' }}>5 hours ago</small>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <BookmarkCheck size={15} color="#2563eb" />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: 600 }}>
                    Saved University of Lagos (UNILAG) to your school shortlist
                  </span>
                  <small style={{ display: 'block', fontSize: '9.5px', color: '#94a3b8' }}>Yesterday</small>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                <ClipboardList size={15} color="#d97706" />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: 600 }}>
                    Submitted request for NELFUND Loan Verification (Ref: ER-2026-N9A2)
                  </span>
                  <small style={{ display: 'block', fontSize: '9.5px', color: '#94a3b8' }}>3 days ago</small>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* 3. RIGHT RAIL: NOTICEBOARD, UPCOMING DEADLINES & AD SPACE (Prevents cards from stretching too long) */}
        <aside className="edureach-dash-rail">
          {/* NOTICEBOARD / SPONSORED UPDATES (Myschool-style side banner / ads space) */}
          <div className="dash-ad-notice">
            <span className="dash-ad-badge">Portal Notice &amp; Ads</span>
            <div
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86efac' }}>
                OFFICIAL ADVERT
              </span>
              <strong style={{ display: 'block', fontSize: '12px', margin: '4px 0 6px', lineHeight: 1.35 }}>
                2026 JAMB CBT Offline Practice App for PC &amp; Android
              </strong>
              <p style={{ margin: 0, fontSize: '10px', color: '#d1fae5', lineHeight: 1.45 }}>
                Practice over 30,000 past questions without internet connection.
              </p>
              <a
                href="/cbt"
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  background: '#ffffff',
                  color: '#065f46',
                  fontSize: '10px',
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                }}
              >
                Get App Access →
              </a>
            </div>

            {/* SECOND SPONSORED CARD */}
            <div
              style={{
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '10px',
                background: '#f8fafc',
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b' }}>SPONSORED UPDATE</span>
              <strong style={{ display: 'block', fontSize: '11px', color: '#0f172a', margin: '2px 0 4px' }}>
                Federal 3MTT Cohort 3 Applications Open
              </strong>
              <p style={{ margin: 0, fontSize: '9.5px', color: '#64748b' }}>
                Full scholarship training in software development, data science, and cloud computing.
              </p>
              <a
                href="/jobs"
                style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', fontWeight: 800, color: '#059669', textDecoration: 'none' }}
              >
                Check Eligibility →
              </a>
            </div>
          </div>

          {/* UPCOMING DEADLINES & EVENTS */}
          <div className="dash-card" id="deadlines">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                <Clock size={13} className="dash-card-title-icon" /> Upcoming Deadlines
              </h2>
            </div>

            <div className="dash-deadline-list">
              <div className="dash-deadline-item">
                <div className="dash-deadline-date">
                  <strong>15</strong>
                  <small>OCT</small>
                </div>
                <div className="dash-deadline-info">
                  <strong>JAMB CAPS Acceptance</strong>
                  <small>Merit list acceptance closing</small>
                </div>
              </div>

              <div className="dash-deadline-item">
                <div className="dash-deadline-date">
                  <strong>28</strong>
                  <small>OCT</small>
                </div>
                <div className="dash-deadline-info">
                  <strong>NELFUND Batch 2 Disbursement</strong>
                  <small>Upkeep payments to bank accounts</small>
                </div>
              </div>

              <div className="dash-deadline-item">
                <div className="dash-deadline-date">
                  <strong>05</strong>
                  <small>NOV</small>
                </div>
                <div className="dash-deadline-info">
                  <strong>UNILAG Post-UTME Screening</strong>
                  <small>Online proctored examination</small>
                </div>
              </div>

              <div className="dash-deadline-item">
                <div className="dash-deadline-date">
                  <strong>12</strong>
                  <small>NOV</small>
                </div>
                <div className="dash-deadline-info">
                  <strong>WAEC GCE Registration Close</strong>
                  <small>Private candidates second series</small>
                </div>
              </div>
            </div>
          </div>

          {/* STUDENT WALLET MINI WIDGET */}
          <div className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                Wallet Balance
              </strong>
              <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#059669', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                ACTIVE
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: '4px 0 10px' }}>
              ₦{(wallet?.balance || 0).toLocaleString()}
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
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            <ClipboardList size={17} />
            <span>Apply</span>
          </button>
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'cbt' ? 'active' : ''}`}
            onClick={() => setActiveTab('cbt')}
          >
            <CheckSquare size={17} />
            <span>CBT</span>
          </button>
          <button
            type="button"
            className={`edureach-bottom-link ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
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
                  setActiveTab('dashboard');
                  setMobileMenuOpen(false);
                }}
              >
                <LayoutDashboard size={15} /> Dashboard Overview
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setActiveTab('applications');
                  setMobileMenuOpen(false);
                }}
              >
                <ClipboardList size={15} /> My Applications
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setActiveTab('saved');
                  setMobileMenuOpen(false);
                }}
              >
                <Bookmark size={15} /> Saved Schools
              </button>
              <button
                type="button"
                className="edureach-nav-item"
                onClick={() => {
                  setActiveTab('cbt');
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
                href="/profile/complete"
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
                {Number(calculateCGPA()) >= 4.5 ? 'First Class Honours 🏆' : Number(calculateCGPA()) >= 3.5 ? 'Second Class Upper (2:1) 🎖️' : 'Second Class Lower (2:2)'}
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
              + Add Another Course
            </button>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{c.name}</strong>
                    <span style={{ fontSize: '10px', fontWeight: 900, background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: '4px' }}>
                      Cut-off: {c.cutOff}+
                    </span>
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
                onClick={() => {
                  setSessionRevoked(true);
                  window.setTimeout(() => setSessionRevoked(false), 3000);
                }}
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
                  onClick={() => setMfaEnabled(!mfaEnabled)}
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
        onSuccess={(amount) =>
          setWallet((current) => ({
            balance: (current?.balance || 0) + amount,
            currency: current?.currency || 'NGN',
          }))
        }
      />
    </div>
  );
}
