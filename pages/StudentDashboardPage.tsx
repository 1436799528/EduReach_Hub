import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../src/lib/supabase';

type Profile = {
  full_name: string;
  school: string;
  department: string;
  level: string;
  matric_number: string | null;
  role: string;
};

type ServiceRow = { id: string; service_key: string; title: string };
type RequestRow = { id: string; status: string; form_data: Record<string, unknown>; created_at: string; service_id: string };
type Wallet = { balance: number; currency: string };

const demoProfile: Profile = {
  full_name: 'Emmanuel Okon',
  school: 'University of Calabar (UNICAL)',
  department: 'Computer Science',
  level: '300L',
  matric_number: '202610928472GA',
  role: 'student',
};

const demoRequests: RequestRow[] = [
  { id: 'demo-1', status: 'processing', service_id: 'nelfund', created_at: '2026-09-14T10:00:00Z', form_data: { reference: 'ER-2026-X892', title: 'NELFUND Student Loan Verification' } },
];

const demoServices: ServiceRow[] = [
  { id: 'demo-s1', service_key: 'nelfund-loan', title: 'NELFUND Loan Application' },
  { id: 'demo-s2', service_key: 'results', title: 'WAEC / NECO Result Checking' },
  { id: 'demo-s3', service_key: 'scratch-cards', title: 'WAEC / NECO Scratch Cards' },
  { id: 'demo-s4', service_key: 'jamb-slip', title: 'JAMB Exam Slip Printing' },
  { id: 'demo-s5', service_key: 'admission-letters', title: 'Admission Deferment & Supplementary Letters' },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function StudentDashboardPage() {
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [services, setServices] = useState<ServiceRow[]>(demoServices);
  const [requests, setRequests] = useState<RequestRow[]>(demoRequests);
  const [wallet, setWallet] = useState<Wallet>({ balance: 4500, currency: 'NGN' });
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState(2000);
  const [walletMessage, setWalletMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const demo = sessionStorage.getItem('edureach_demo_mode') === 'true';
      setDemoMode(demo);
      if (demo) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }
      if (!alive) return;
      setUserEmail(user.email ?? '');

      const [{ data: p }, { data: s }, { data: r }, { data: w }] = await Promise.all([
        supabase.from('profiles').select('full_name,school,department,level,matric_number,role').eq('id', user.id).maybeSingle(),
        supabase.from('service_catalog').select('id,service_key,title').eq('active', true).order('title'),
        supabase.from('service_requests').select('id,status,form_data,created_at,service_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
        supabase.from('student_wallets').select('balance,currency').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!alive) return;
      if (p) setProfile({ ...demoProfile, ...p });
      if (s?.length) setServices(s);
      if (r?.length) setRequests(r as RequestRow[]);
      if (w) setWallet({ balance: Number(w.balance), currency: w.currency });
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, []);

  const serviceById = useMemo(() => Object.fromEntries(services.map((service) => [service.id, service])), [services]);
  const targetPercent = Math.min(100, Math.round((242 / 280) * 100));

  async function logout() {
    sessionStorage.removeItem('edureach_demo_mode');
    await supabase.auth.signOut();
    setLoggedOut(true);
    window.location.href = '/';
  }

  function copyReg() {
    if (!profile.matric_number) return;
    navigator.clipboard?.writeText(profile.matric_number);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function createTopup(event: FormEvent) {
    event.preventDefault();
    setWalletMessage('');
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount < 500) {
      setWalletMessage('Minimum top-up is ₦500.');
      return;
    }
    const reference = `WAL-${Date.now()}`;

    if (demoMode) {
      setWallet((current) => ({ ...current, balance: current.balance + amount }));
      setWalletMessage('Demo wallet funded. Live Paystack verification will be connected to the payment webhook.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      amount,
      reference,
      status: 'pending',
      provider: 'paystack',
      metadata: { source: 'student_dashboard' },
    });
    if (error) {
      setWalletMessage(error.message);
      return;
    }
    setWalletMessage(`Payment request ${reference} is pending verification.`);
  }

  if (loggedOut) return null;

  return (
    <div className="student-portal">
      <header className="student-portal-header">
        <div className="student-portal-bar">
          <a href="/" className="student-brand"><span>ER</span> EduReach<span className="student-brand-suffix">.ng</span></a>
          <div className="student-search"><span>⌕</span><input placeholder="Search services, news or academic tools..." /></div>
          <div className="student-header-actions">
            <button type="button" className="wallet-mini" onClick={() => setTopupOpen(true)}>₦{wallet.balance.toLocaleString()} <b>+</b></button>
            <a href="/services" className="student-header-link">Services</a>
            <button className="student-profile-menu" onClick={logout}>{initials(profile.full_name)} <span>⌄</span></button>
          </div>
        </div>
        <div className="student-trust-strip">EduReach.ng Account • Instant CBT Access &amp; Service Tracking</div>
      </header>

      <main className="student-portal-main">
        {loading ? <div className="student-loading">Loading student workspace…</div> : (
          <div className="student-grid">
            <aside className="student-sidebar">
              <section className="student-card identity-card">
                <div className="identity-top"><div className="avatar-wrap"><div className="student-avatar">{initials(profile.full_name)}</div><span className="online-dot" /></div><div><h2>{profile.full_name}</h2><p>{profile.school}</p></div></div>
                <div className="identity-meta">
                  <div className="identity-line"><span>Department</span><strong>{profile.department || 'Not set'}</strong></div>
                  <div className="identity-line"><span>Level</span><strong>{profile.level || 'Not set'}</strong></div>
                  <div className="identity-line"><span>JAMB / Matric</span><button type="button" onClick={copyReg}>{profile.matric_number || 'Not set'} {copied ? '✓' : '⧉'}</button></div>
                </div>
                <div className="target-block"><div><span>CBT Target Score</span><b>242 / 280</b></div><div className="target-track"><span style={{ width: `${targetPercent}%` }} /></div></div>
              </section>

              <section className="student-card wallet-card"><div className="card-title-row"><h3>Virtual Wallet</h3><span>NGN</span></div><div className="wallet-balance">₦{wallet.balance.toLocaleString()}</div><p>Use your wallet for supported student services and CBT products.</p><button type="button" className="student-btn student-btn-green" onClick={() => setTopupOpen(true)}>＋ Top Up</button></section>

              <section className="student-card"><div className="card-title-row"><h3>Recent PIN Vault</h3><span>1 PIN</span></div><div className="pin-vault"><div className="pin-vault-label">WAEC Result Pin <small>2026</small></div><div className="pin-code"><span>••••-••••-2281</span><button type="button" onClick={() => navigator.clipboard?.writeText('4812-9901-2281')}>Copy</button></div></div></section>

              <section className="student-card"><div className="card-title-row"><h3>Active Services</h3><span>LIVE</span></div><div className="service-mini-list">{requests.length ? requests.slice(0, 3).map((request) => <div key={request.id}><span className={`status-dot status-${request.status}`} /><strong>{String((request.form_data as any)?.title || serviceById[request.service_id]?.title || 'Service Request')}</strong><small>{request.status}</small></div>) : <p className="empty-copy">No active requests yet.</p>}</div></section>
            </aside>

            <section className="student-workspace">
              <div className="student-card action-card"><div className="card-title-row"><div><h3>Quick Actions</h3><p>Jump straight into the work students use most.</p></div><span>{demoMode ? 'DEMO' : 'STUDENT'}</span></div><div className="quick-actions-grid">
                <a href="/cbt" className="quick-action quick-blue"><small>ENGINE</small><b>CBT Practice Center</b><span>Start Full Mock →</span></a>
                <a href="/services/nelfund-loan" className="quick-action quick-green"><small>PORTAL</small><b>NELFUND Assistance</b><span>Apply / Track →</span></a>
                <a href="/services/scratch-cards" className="quick-action quick-amber"><small>INSTANT</small><b>Result PIN Store</b><span>Buy WAEC / NECO →</span></a>
                <a href="/services" className="quick-action quick-slate"><small>STATUS</small><b>Order Tracker</b><span>Check Progress →</span></a>
              </div></div>

              <div className="student-card analytics-card"><div className="card-title-row"><div><h3>CBT Performance &amp; Diagnostics</h3><p>Recent practice signals from your student workspace.</p></div><a href="/cbt/history">View History →</a></div><div className="metric-strip"><div><span>Average</span><b>81%</b></div><div><span>Avg. time / question</span><b>34s</b></div><div><span>Target</span><b>280</b></div><div><span>Tests</span><b>12</b></div></div><div className="weak-alert"><strong>Weak Subject Alert</strong><span>Use of English — 65% accuracy in the last test. Review errors before your next attempt.</span><a href="/cbt/review">Review Errors →</a></div><div className="student-table-wrap"><table className="student-table"><thead><tr><th>Date</th><th>Subject</th><th>Score</th><th>Time</th><th /></tr></thead><tbody><tr><td>14 Sep 2026</td><td><strong>Chemistry</strong><small>2026 Model</small></td><td className="score-good">38/40 (95%)</td><td>18m 20s</td><td><a href="/cbt/review">Review</a></td></tr><tr><td>13 Sep 2026</td><td><strong>Use of English</strong><small>Full Mock</small></td><td className="score-warn">26/40 (65%)</td><td>24m 10s</td><td><a href="/cbt/review">Review</a></td></tr><tr><td>11 Sep 2026</td><td><strong>Biology</strong><small>Subject Drill</small></td><td className="score-good">34/40 (85%)</td><td>20m 04s</td><td><a href="/cbt/review">Review</a></td></tr></tbody></table></div></div>

              <div className="student-card"><div className="card-title-row"><div><h3>Active Service Processing</h3><p>Track service requests without opening another page.</p></div><a href="/services">Open Services →</a></div><div className="order-stream">{requests.length ? requests.map((request) => { const title = String((request.form_data as any)?.title || serviceById[request.service_id]?.title || 'Student Service'); const reference = String((request.form_data as any)?.reference || `ER-${request.id.slice(0, 8).toUpperCase()}`); return <div className="order-item" key={request.id}><div className="order-heading"><div><strong>{title}</strong><small>Ref: {reference} • {formatDate(request.created_at)}</small></div><span className={`request-badge badge-${request.status}`}>{request.status}</span></div><div className="pipeline"><span className="done">1. Request</span><span className={request.status === 'processing' ? 'active' : 'pending'}>2. Verification</span><span className="pending">3. Completion</span></div><a href="https://wa.me/2340000000000" target="_blank" rel="noreferrer" className="support-link">Get Help on WhatsApp →</a></div>; }) : <p className="empty-copy">No service requests yet. Choose a service to start.</p>}</div></div>
            </section>

            <aside className="student-intel">
              <section className="student-card portal-status-card"><div className="card-title-row"><h3>Portal Status</h3><span>LIVE</span></div><div className="portal-status-list"><div><strong>JAMB CAPS</strong><span className="status-pill online">Online</span></div><div><strong>NELFUND Portal</strong><span className="status-pill online">Online</span></div><div><strong>UNICAL Portal</strong><span className="status-pill traffic">High Traffic</span></div></div><p>Shown as platform-held status indicators. Live uptime integration can be connected to the verification service.</p></section>
              <section className="student-card campus-feed"><div className="card-title-row"><h3>Verified Campus Intelligence</h3><a href="/blog">View All →</a></div><article><span>UNICAL • NOTICE</span><h4>Post-UTME, result and admission updates appear here.</h4><p>Connect verified EduReach announcements to keep this feed current.</p><button type="button">Share to WhatsApp ↗</button></article><article><span>JAMB • UPDATE</span><h4>Service-specific JAMB notices can be surfaced here.</h4><p>Each bulletin can carry source and verification status.</p><button type="button">Share to WhatsApp ↗</button></article></section>
              <section className="student-card trust-card"><b>High-trust workspace</b><p>Your service requests are tied to your authenticated account. Never enter passwords, OTPs, card PINs or banking credentials into service forms.</p></section>
            </aside>
          </div>
        )}
      </main>

      {topupOpen && <div className="wallet-modal-backdrop" role="dialog" aria-modal="true"><div className="wallet-modal"><div className="wallet-modal-head"><div><small>EduReach Wallet</small><h3>Top Up Balance</h3></div><button type="button" onClick={() => { setTopupOpen(false); setWalletMessage(''); }}>×</button></div><form onSubmit={createTopup}><label>Preset Amount</label><div className="preset-grid">{[1000,2000,5000,10000].map((amount) => <button key={amount} type="button" onClick={() => setTopupAmount(amount)} className={topupAmount === amount ? 'selected' : ''}>₦{amount.toLocaleString()}</button>)}</div><label>Custom Amount</label><input type="number" min={500} value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value))} /><div className="wallet-security">✓ Payments can be processed through Paystack. Live wallet credit must be verified server-side before it changes the balance.</div><button className="student-btn student-btn-green" type="submit">Continue to Paystack</button>{walletMessage && <div className="wallet-message">{walletMessage}</div>}</form></div></div>}
    </div>
  );
}
