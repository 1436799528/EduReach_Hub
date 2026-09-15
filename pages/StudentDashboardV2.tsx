import { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, BookOpen, Check, ChevronRight, Copy, CreditCard, Plus, Search, ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '../src/lib/supabase';
import WalletModal from '../src/components/WalletModal';

type Profile = { full_name: string; school: string; department: string; level: string; matric_number: string | null; role: string; phone?: string | null; jamb_reg_no?: string | null; target_exam?: string | null };
type ServiceRow = { id: string; service_key: string; title: string };
type RequestRow = { id: string; status: string; form_data: Record<string, unknown>; created_at: string; service_id: string };
type Wallet = { balance: number; currency: string };

const demoProfile: Profile = { full_name: 'Emmanuel Okon', school: 'University of Calabar (UNICAL)', department: 'Computer Science', level: '300L', matric_number: '202610928472GA', role: 'student' };
const demoRequests: RequestRow[] = [{ id: 'demo-1', status: 'processing', service_id: 'demo-s1', created_at: '2026-09-14T10:00:00Z', form_data: { reference: 'ER-2026-X892', title: 'NELFUND Student Loan Verification' } }];
const demoServices: ServiceRow[] = [
  { id: 'demo-s1', service_key: 'nelfund-loan', title: 'NELFUND Loan Application' },
  { id: 'demo-s2', service_key: 'results', title: 'WAEC / NECO Result Checking' },
  { id: 'demo-s3', service_key: 'scratch-cards', title: 'WAEC / NECO Scratch Cards' },
  { id: 'demo-s4', service_key: 'jamb-slip', title: 'JAMB Exam Slip Printing' },
  { id: 'demo-s5', service_key: 'admission-letters', title: 'Admission Deferment & Supplementary Letters' },
];
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
function fmtDate(value: string) { return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }

export default function StudentDashboardV2() {
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [services, setServices] = useState<ServiceRow[]>(demoServices);
  const [requests, setRequests] = useState<RequestRow[]>(demoRequests);
  const [wallet, setWallet] = useState<Wallet>({ balance: 4500, currency: 'NGN' });
  const [email, setEmail] = useState('emmanuel@student.unical.edu.ng');
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const isDemo = sessionStorage.getItem('edureach_demo_mode') === 'true';
      setDemoMode(isDemo);
      if (isDemo) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      setEmail(user.email || '');
      const [{ data: p }, { data: s }, { data: r }, { data: w }] = await Promise.all([
        supabase.from('profiles').select('full_name,school,department,level,matric_number,role,phone,jamb_reg_no,target_exam').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('service_requests').select('id,status,form_data,created_at,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
        supabase.from('student_wallets').select('balance,currency').eq('user_id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (p) setProfile(prev => ({ ...prev, ...p }));
      if (s?.length) setServices(s);
      if (r) setRequests(r as RequestRow[]);
      if (w) setWallet({ balance: Number(w.balance), currency: w.currency });
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const serviceMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s])), [services]);
  const reg = profile.jamb_reg_no || profile.matric_number || 'Not set';
  const targetPercent = Math.min(100, Math.round((242 / 280) * 100));
  const copyReg = () => { if (!reg || reg === 'Not set') return; navigator.clipboard?.writeText(reg); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const logout = async () => { sessionStorage.removeItem('edureach_demo_mode'); await supabase.auth.signOut(); window.location.href = '/'; };

  return <div className="student-portal">
    <header className="student-portal-header"><div className="student-portal-bar">
      <a href="/" className="student-brand"><span>ER</span> EduReach<span className="student-brand-suffix">.ng</span></a>
      <div className="student-search"><Search size={16}/><input placeholder="Search services, news or academic tools..."/></div>
      <div className="student-header-actions"><button className="wallet-mini" onClick={() => setWalletOpen(true)}><Wallet size={14}/> ₦{wallet.balance.toLocaleString()} <b>+</b></button><a className="student-header-link" href="/services">Services</a><button className="student-profile-menu" onClick={logout}>{initials(profile.full_name)} <span>⌄</span></button></div>
    </div><div className="student-trust-strip"><ShieldCheck size={13}/> EduReach.ng Account • Secure student workspace • {demoMode ? 'Demo mode' : 'Authenticated session'}</div></header>

    <main className="student-portal-main">{loading ? <div className="student-loading">Loading student workspace…</div> : <div className="student-grid">
      <aside className="student-sidebar">
        <section className="student-card identity-card"><div className="identity-top"><div className="avatar-wrap"><div className="student-avatar">{initials(profile.full_name)}</div><span className="online-dot"/></div><div><h2>{profile.full_name}</h2><p>{profile.school}</p></div></div><div className="identity-meta"><div className="identity-line"><span>Department</span><strong>{profile.department || 'Not set'}</strong></div><div className="identity-line"><span>Level</span><strong>{profile.level || 'Not set'}</strong></div><div className="identity-line"><span>JAMB / Matric</span><button onClick={copyReg}>{reg} {copied ? <Check size={12}/> : <Copy size={12}/>}</button></div><div className="identity-line"><span>Target</span><strong>{profile.target_exam || 'JAMB (UTME)'}</strong></div></div><div className="target-block"><div><span>CBT Target Score</span><b>242 / 280</b></div><div className="target-track"><span style={{ width: `${targetPercent}%` }}/></div></div></section>
        <section className="student-card wallet-card"><div className="card-title-row"><h3>Virtual Wallet</h3><span>{wallet.currency}</span></div><div className="wallet-balance">₦{wallet.balance.toLocaleString()}</div><p>Use verified wallet credit for supported student products and services.</p><button className="student-btn student-btn-green" onClick={() => setWalletOpen(true)}><Plus size={15}/> Top Up</button></section>
        <section className="student-card"><div className="card-title-row"><h3>Active Services</h3><span>{requests.length}</span></div><div className="service-mini-list">{requests.slice(0, 3).map(req => <div key={req.id}><span className={`status-dot status-${req.status}`}/><strong>{String(req.form_data?.title || serviceMap[req.service_id]?.title || 'Service request')}</strong><small>{req.status}</small></div>)}{!requests.length && <p className="empty-copy">No active requests yet.</p>}</div></section>
      </aside>

      <section className="student-workspace">
        <section className="student-card action-card"><div className="card-title-row"><div><h3>Quick Actions</h3><p>High-priority student tasks in one place.</p></div><span>{demoMode ? 'DEMO' : 'LIVE'}</span></div><div className="quick-actions-grid"><a href="/cbt" className="quick-action quick-blue"><small>ENGINE</small><b>CBT Practice Center</b><span>Start Test <ChevronRight size={13}/></span></a><a href="/services/nelfund-loan" className="quick-action quick-green"><small>PORTAL</small><b>NELFUND Assistance</b><span>Apply / Track <ChevronRight size={13}/></span></a><a href="/services/scratch-cards" className="quick-action quick-amber"><small>INSTANT</small><b>Result PIN Store</b><span>Buy WAEC / NECO <ChevronRight size={13}/></span></a><a href="/services/track" className="quick-action quick-slate"><small>STATUS</small><b>Order Tracker</b><span>Check Progress <ChevronRight size={13}/></span></a></div></section>

        <section className="student-card analytics-card"><div className="card-title-row"><div><h3>CBT Performance &amp; Diagnostics</h3><p>Action-oriented signals from recent practice.</p></div><a href="/cbt">Open CBT →</a></div><div className="metric-strip"><div><span>Average</span><b>81%</b></div><div><span>Avg. time</span><b>34s</b></div><div><span>Target</span><b>280</b></div><div><span>Tests</span><b>12</b></div></div><div className="weak-alert"><strong>Weak Subject Alert</strong><span>Use of English — 65% accuracy in the latest attempt.</span><a href="/cbt">Practice Again →</a></div><div className="student-table-wrap"><table className="student-table"><thead><tr><th>Date</th><th>Subject</th><th>Score</th><th>Time</th><th/></tr></thead><tbody><tr><td>14 Sep 2026</td><td><strong>Chemistry</strong><small>2026 Model</small></td><td className="score-good">38/40 (95%)</td><td>18m 20s</td><td><a href="/cbt">Review</a></td></tr><tr><td>13 Sep 2026</td><td><strong>Use of English</strong><small>Full Mock</small></td><td className="score-warn">26/40 (65%)</td><td>24m 10s</td><td><a href="/cbt">Review</a></td></tr><tr><td>11 Sep 2026</td><td><strong>Biology</strong><small>Subject Drill</small></td><td className="score-good">34/40 (85%)</td><td>20m 04s</td><td><a href="/cbt">Review</a></td></tr></tbody></table></div></section>

        <section className="student-card"><div className="card-title-row"><div><h3>Active Service Processing</h3><p>Track requests without leaving the workspace.</p></div><a href="/services">Open Services →</a></div><div className="order-stream">{requests.map(req => { const title = String(req.form_data?.title || serviceMap[req.service_id]?.title || 'Student Service'); const reference = String(req.form_data?.reference || `ER-${req.id.slice(0, 8).toUpperCase()}`); return <div className="order-item" key={req.id}><div className="order-heading"><div><strong>{title}</strong><small>Ref: {reference} • {fmtDate(req.created_at)}</small></div><span className={`request-badge badge-${req.status}`}>{req.status}</span></div><div className="pipeline"><span className="done">1. Request</span><span className={req.status === 'processing' ? 'active' : 'pending'}>2. Verification</span><span className="pending">3. Completion</span></div><a href="/services/track" className="support-link">Open tracker →</a></div>; })}{!requests.length && <p className="empty-copy">No service requests yet. Choose a service to start.</p>}</div></section>
      </section>

      <aside className="student-intel"><section className="student-card portal-status-card"><div className="card-title-row"><h3>Portal Status</h3><span>INDICATOR</span></div><div className="portal-status-list"><div><strong>JAMB CAPS</strong><span className="status-pill online">Available</span></div><div><strong>NELFUND Portal</strong><span className="status-pill online">Available</span></div><div><strong>UNICAL Portal</strong><span className="status-pill traffic">Monitor</span></div></div><p>Statuses are EduReach indicators until a live uptime connector is enabled.</p></section><section className="student-card campus-feed"><div className="card-title-row"><h3>Verified Campus Intelligence</h3><a href="/news">View All →</a></div><article><span>UNICAL • NOTICE</span><h4>Latest student announcements are shown in the EduReach news desk.</h4><p>Only verified or clearly labelled guidance should be treated as official.</p><button onClick={() => navigator.share?.({ title: 'EduReach', text: 'Student update from EduReach' })}>Share ↗</button></article><article><span>JAMB • UPDATE</span><h4>Service-specific JAMB notices can appear here.</h4><p>Open the news desk for the full source and verification state.</p><button onClick={() => navigator.share?.({ title: 'EduReach', text: 'JAMB update from EduReach' })}>Share ↗</button></article></section><section className="student-card trust-card"><b>High-trust workspace</b><p>Never submit passwords, OTPs, card PINs or banking credentials to a service form.</p></section></aside>
    </div>}</main>
    <WalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} userEmail={email} onSuccess={(amount) => setWallet(current => ({ ...current, balance: current.balance + amount }))}/>
  </div>;
}
