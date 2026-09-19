import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../src/lib/supabase';

const institutions = [
  { label: 'University of Calabar (UNICAL)', acronym: 'UNICAL' },
  { label: 'University of Nigeria, Nsukka (UNN)', acronym: 'UNN' },
  { label: 'University of Uyo (UNIUYO)', acronym: 'UNIUYO' },
  { label: 'University of Lagos (UNILAG)', acronym: 'UNILAG' },
  { label: 'Other Nigerian Institution', acronym: '' },
];
const targets = ['JAMB (UTME)', 'POST-UTME', 'WAEC / NECO', 'Undergraduate'];
type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export default function AuthPageV2({ mode = 'signin' }: { mode?: Mode }) {
  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState(institutions[0].label);
  const [jambReg, setJambReg] = useState('');
  const [targetExam, setTargetExam] = useState(targets[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCurrentMode('reset');
        setMessage('Choose a new password for your EduReach account.');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (currentMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/forgot-password` });
        if (error) throw error;
        setMessage('Password reset instructions sent to your email.');
      } else if (currentMode === 'reset') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword(''); setConfirmPassword(''); setCurrentMode('signin'); setMessage('Password updated. Sign in again.');
      } else if (currentMode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!fullName.trim() || !phone.trim()) throw new Error('Full name and phone number are required.');
        const selectedInstitution = institutions.find((item) => item.label === institution);
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim(), phone: phone.trim(), institution, institution_acronym: selectedInstitution?.acronym || null, jamb_registration_number: jambReg.trim() || null, target_exam: targetExam } } });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled.'); setCurrentMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: { session: signedInSession } } = await supabase.auth.getSession();
        if (!signedInSession?.access_token) throw new Error('Could not verify the signed-in account.');
        const adminCheck = await fetch('/api/admin/session', { headers: { Authorization: `Bearer ${signedInSession.access_token}` } });
        window.sessionStorage.removeItem('edureach-admin-student-view');
        window.location.href = adminCheck.ok ? '/admin' : getSafeNextPath();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }

  const title = currentMode === 'signin' ? 'Sign in' : currentMode === 'signup' ? 'Create account' : currentMode === 'reset' ? 'Set password' : 'Reset password';

  return <div className="auth-page-v2">
    <div className="auth-page-brand"><a href="/"><span>ER</span> EduReach<b>.ng</b></a></div>
    <div className="auth-page-layout">
      <div className="auth-page-copy compact-auth-copy"><span className="auth-eyebrow">STUDENT ACCOUNT</span><h1>{title}</h1><p>Use your EduReach account for services, CBT and your student workspace.</p></div>
      <div className="auth-page-card">
        <div className="auth-card-head"><div><h2>{currentMode === 'signin' ? 'Sign in' : currentMode === 'signup' ? 'Register' : currentMode === 'reset' ? 'New password' : 'Reset password'}</h2></div></div>
        {message && <div className="auth-v2-message">{message}</div>}
        <form onSubmit={submit} className="auth-v2-form">
          {currentMode === 'signup' && <>
            <label>Full Name<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full name" required/></label>
            <div className="auth-v2-two"><label>Phone / WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" placeholder="080..." required/></label><label>JAMB Reg. No.<input value={jambReg} onChange={e=>setJambReg(e.target.value)} placeholder="Optional"/></label></div>
            <div className="auth-v2-two"><label>Institution<select value={institution} onChange={e=>setInstitution(e.target.value)}>{institutions.map(x=><option key={x.label}>{x.label}</option>)}</select></label><label>Target Exam<select value={targetExam} onChange={e=>setTargetExam(e.target.value)}>{targets.map(x=><option key={x}>{x}</option>)}</select></label></div>
          </>}
          <label>Email Address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="student@example.com" required/></label>
          {(currentMode === 'signin' || currentMode === 'signup') && <div className="auth-v2-two"><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" minLength={8} required/></label>{currentMode === 'signup' && <label>Confirm Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} type="password" placeholder="Repeat password" minLength={8} required/></label>}</div>}
          {currentMode === 'reset' && <div className="auth-v2-two"><label>New Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" minLength={8} required/></label><label>Confirm Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} type="password" placeholder="Repeat password" minLength={8} required/></label></div>}
          <button type="submit" className="auth-v2-submit" disabled={busy}>{busy ? 'Processing…' : title}<ArrowRight size={16}/></button>
        </form>
        <div className="auth-v2-switch">{currentMode !== 'signin' && currentMode !== 'reset' && <button onClick={()=>{setCurrentMode('signin');setMessage('')}}>Sign in</button>}{currentMode !== 'signup' && currentMode !== 'reset' && <button onClick={()=>{setCurrentMode('signup');setMessage('')}}>Create account</button>}{currentMode !== 'forgot' && currentMode !== 'reset' && <button onClick={()=>{setCurrentMode('forgot');setMessage('')}}>Forgot password?</button>}</div>
      </div>
    </div>
  </div>;
}
