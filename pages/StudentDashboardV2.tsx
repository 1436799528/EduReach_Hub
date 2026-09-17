import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Copy, Plus, Search, ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '../src/lib/supabase';
import WalletModal from '../src/components/WalletModal';

type Profile = { full_name: string; school: string; department: string; level: string; matric_number: string | null; role: string; phone?: string | null; jamb_reg_no?: string | null; target_exam?: string | null };
type ServiceRow = { id: string; service_key: string; title: string };
type RequestRow = { id: string; status: string; form_data: Record<string, unknown>; created_at: string; reference_code: string; service_id: string };
type WalletState = { balance: number; currency: string };
type Attempt = { id: string; score: number | null; correct_answers: number; total_questions: number; submitted_at: string | null; created_at: string };

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'ER'; }
function fmtDate(value: string) { return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
function statusLabel(status: string) { return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default function StudentDashboardV2() {
  const [profile, setProfile] = useState<Profile>({ full_name: 'Student', school: '', department: '', level: '', matric_number: null, role: 'student' });
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [wallet, setWallet] = useState<WalletState>({ balance: 0, currency: 'NGN' });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { window.location.href = '/login?next=/dashboard'; return; }

      setEmail(user.email || '');
      const [profileResult, serviceResult, requestResult, walletResult, attemptsResult] = await Promise.all([
        supabase.from('profiles').select('full_name,school,department,level,matric_number,role,phone,jamb_reg_no,target_exam').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('service_requests').select('id,status,form_data,created_at,reference_code,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
        supabase.from('student_wallets').select('balance,currency').eq('user_id', user.id).maybeSingle(),
        supabase.from('cbt_attempts').select('id,score,correct_answers,total_questions,submitted_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
      ]);

      if (!active) return;
      const firstError = profileResult.error || serviceResult.error || requestResult.error || walletResult.error || attemptsResult.error;
      if (firstError) setError(firstError.message);
      if (profileResult.data) setProfile(profileResult.data as Profile);
      setServices((serviceResult.data || []) as ServiceRow[]);
      setRequests((requestResult.data || []) as RequestRow[]);
      if (walletResult.data) setWallet({ balance: Number(walletResult.data.balance), currency: walletResult.data.currency });
      setAttempts((attemptsResult.data || []) as Attempt[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const serviceMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s])), [services]);
  const reg = profile.jamb_reg_no || profile.matric_number || 'Not set';
  const averageScore = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attempts.length) : 0;
  const bestScore = attempts.length ? Math.max(...attempts.map(item => Number(item.score || 0))) : 0;
  const copyReg = () => { if (reg === 'Not set') return; navigator.clipboard?.writeText(reg); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  return <div className="student-portal">
    <header className="student-portal-header"><div className="student-portal-bar">
      <a href="/" className="student-brand"><span>ER</span> EduReach<span className="student-brand-suffix">.ng</span></a>
      <div className="student-search"><Search size={16}/><input placeholder="Search services, news or academic tools..." aria-label="Search student content"/></div>
      <div className="student-header-actions"><button className="wallet-mini" onClick={() => setWalletOpen(true)}><Wallet size={14}/> ₦{wallet.balance.toLocaleString()} <b>+</b></button><a className="student-header-link" href="/services">Services</a><button className="student-profile-menu" onClick={logout} aria-label="Sign out">{initials(profile.full_name)} <span>⌄</span></button></div>
    </div><div className="student-trust-strip"><ShieldCheck size={13}/> EduReach.ng Account • Secure student workspace • Authenticated session</div></header>

    <main className="student-portal-main">{loading ? <div className="student-loading">Loading student workspace…</div> : <div className="student-grid">
      <aside className="student-sidebar">
        <section className="student-card identity-card"><div className="identity-top"><div className="avatar-wrap"><div className="student-avatar">{initials(profile.full_name)}</div><span className="online-dot"/></div><div><h2>{profile.full_name}</h2><p>{profile.school || 'Institution not set'}</p></div></div><div className="identity-meta"><div className="identity-line"><span>Department</span><strong>{profile.department || 'Not set'}</strong></div><div className="identity-line"><span>Level</span><strong>{profile.level || 'Not set'}</strong></div><div className="identity-line"><span>JAMB / Matric</span><button onClick={copyReg}>{reg} {copied ? <Check size={12}/> : <Copy size={12}/>}</button></div><div className="identity-line"><span>Target</span><strong>{profile.target_exam || 'Not set'}</strong></div></div><div className="target-block"><div><span>Best CBT Score</span><b>{bestScore ? `${bestScore}%` : 'No attempts'}</b></div><div className="target-track"><span style={{ width: `${Math.min(100, bestScore)}%` }}/></div></div></section>
        <section className="student-card wallet-card"><div className="card-title-row"><h3>Virtual Wallet</h3><span>{wallet.currency}</span></div><div className="wallet-balance">₦{wallet.balance.toLocaleString()}</div><p>Verified wallet balance for supported student products.</p><button className="student-btn student-btn-green" onClick={() => setWalletOpen(true)}><Plus size={15}/> Top Up</button></section>
        <section className="student-card"><div className="card-title-row"><h3>Service Requests</h3><span>{requests.length}</span></div><div className="service-mini-list">{requests.slice(0, 3).map(req => <div key={req.id}><span className={`status-dot status-${req.status}`}/><strong>{String(req.form_data?.serviceTitle || serviceMap[req.service_id]?.title || 'Service request')}</strong><small>{statusLabel(req.status)}</small></div>)}{!requests.length && <p className="empty-copy">No service requests yet.</p>}</div></section>
      </aside>

      <section className="student-workspace">
        <section className="student-card action-card"><div className="card-title-row"><div><h3>Quick Actions</h3><p>Common student tasks in one place.</p></div><span>LIVE</span></div><div className="quick-actions-grid"><a href="/cbt" className="quick-action quick-blue"><small>ENGINE</small><b>CBT Practice Center</b><span>Start Test <ChevronRight size={13}/></span></a><a href="/services/nelfund-loan" className="quick-action quick-green"><small>PORTAL</small><b>NELFUND Assistance</b><span>Apply / Track <ChevronRight size={13}/></span></a><a href="/services/scratch-cards" className="quick-action quick-amber"><small>RESULTS</small><b>WAEC / NECO</b><span>Request Support <ChevronRight size={13}/></span></a><a href="/services/track" className="quick-action quick-slate"><small>STATUS</small><b>Request Tracker</b><span>Check Progress <ChevronRight size={13}/></span></a></div></section>

        <section className="student-card analytics-card"><div className="card-title-row"><div><h3>CBT Performance</h3><p>Calculated from your recorded practice attempts.</p></div><a href="/cbt">Open CBT →</a></div><div className="metric-strip"><div><span>Average</span><b>{attempts.length ? `${averageScore}%` : '—'}</b></div><div><span>Best</span><b>{attempts.length ? `${bestScore}%` : '—'}</b></div><div><span>Attempts</span><b>{attempts.length}</b></div><div><span>Latest</span><b>{attempts[0]?.score != null ? `${Number(attempts[0].score).toFixed(0)}%` : '—'}</b></div></div>{attempts.length ? <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Date</th><th>Score</th><th>Correct</th><th>Review</th></tr></thead><tbody>{attempts.slice(0, 5).map((attempt) => <tr key={attempt.id}><td>{fmtDate(attempt.submitted_at || attempt.created_at)}</td><td className={Number(attempt.score || 0) >= 70 ? 'score-good' : 'score-warn'}>{Number(attempt.score || 0).toFixed(0)}%</td><td>{attempt.correct_answers}/{attempt.total_questions}</td><td><a href={`/cbt/results?attempt=${encodeURIComponent(attempt.id)}`}>Open</a></td></tr>)}</tbody></table></div> : <div className="empty-copy">No CBT attempts recorded yet. Start a practice session to build your history.</div>}</section>

        <section className="student-card"><div className="card-title-row"><div><h3>Active Service Processing</h3><p>Track requests without leaving the workspace.</p></div><a href="/services">Open Services →</a></div><div className="order-stream">{requests.map(req => { const title = String(req.form_data?.serviceTitle || serviceMap[req.service_id]?.title || 'Student Service'); return <div className="order-item" key={req.id}><div className="order-heading"><div><strong>{title}</strong><small>Ref: {req.reference_code} • {fmtDate(req.created_at)}</small></div><span className={`request-badge badge-${req.status}`}>{statusLabel(req.status)}</span></div><div className="pipeline"><span className="done">1. Request</span><span className={req.status === 'reviewing' || req.status === 'processing' || req.status === 'completed' ? 'active' : 'pending'}>2. Verification</span><span className={req.status === 'completed' ? 'done' : 'pending'}>3. Completion</span></div><a href={`/services/track?ref=${encodeURIComponent(req.reference_code)}`} className="support-link">Open tracker →</a></div>; })}{!requests.length && <p className="empty-copy">No service requests yet. Choose a service to start.</p>}</div></section>
      </section>

      <aside className="student-intel"><section className="student-card portal-status-card"><div className="card-title-row"><h3>Workspace Status</h3><span>LIVE</span></div><div className="portal-status-list"><div><strong>Service requests</strong><span className="status-pill online">Connected</span></div><div><strong>CBT scoring</strong><span className="status-pill online">Server-side</span></div><div><strong>News feed</strong><span className="status-pill online">Verified</span></div></div><p>Your student data is loaded from the authenticated account and protected by database policies.</p></section><section className="student-card campus-feed"><div className="card-title-row"><h3>Student Information</h3><a href="/news">Open News →</a></div><article><span>VERIFIED NEWS</span><h4>Open the EduReach news desk for verified academic announcements.</h4><p>Official sources and verification status are shown with published updates.</p><a href="/news">Browse updates <ArrowUpRight size={15}/></a></article><article><span>SERVICE SUPPORT</span><h4>Your request reference is the key to tracking processing.</h4><p>Keep your reference code safe and never share passwords or OTPs.</p><a href="/services/track">Track a request <ArrowUpRight size={15}/></a></article></section><section className="student-card trust-card"><b>High-trust workspace</b><p>EduReach will never ask you to place passwords, OTPs, card PINs or banking credentials in a service form.</p></section></aside>
    </div>}</main>
    {error && <div className="student-error-banner">Some live data could not be loaded: {error}</div>}
    <WalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} userEmail={email} onSuccess={(amount) => setWallet(current => ({ ...current, balance: current.balance + amount }))}/>
  </div>;
}
