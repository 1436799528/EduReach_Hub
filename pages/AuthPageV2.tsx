import { FormEvent, useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { supabase } from '../src/lib/supabase';

const institutions = ['University of Calabar (UNICAL)', 'University of Nigeria, Nsukka (UNN)', 'University of Uyo (UNIUYO)', 'University of Lagos (UNILAG)', 'Other Nigerian Institution'];
const targets = ['JAMB (UTME)', 'POST-UTME', 'WAEC / NECO', 'Undergraduate'];

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthPageV2({ mode = 'signin' }: { mode?: Mode }) {
  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('University of Calabar (UNICAL)');
  const [jambReg, setJambReg] = useState('');
  const [targetExam, setTargetExam] = useState('JAMB (UTME)');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (currentMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/forgot-password` });
        if (error) throw error;
        setMessage('Password reset instructions have been sent to your email.');
      } else if (currentMode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!fullName.trim() || !phone.trim()) throw new Error('Full name and phone number are required.');
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim(), phone: phone.trim(), institution, jamb_registration_number: jambReg.trim() || null, target_exam: targetExam } } });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
        setCurrentMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Could not verify the signed-in account.');
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        window.location.href = ['admin', 'super_admin', 'moderator'].includes(profile?.role || '') ? '/admin' : '/dashboard';
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }

  return <div className="auth-page-v2"><div className="auth-page-brand"><a href="/"><span>ER</span> EduReach<b>.ng</b></a><small>Student services, CBT practice and academic support</small></div><div className="auth-page-layout"><div className="auth-page-copy"><span className="auth-eyebrow">EDUREACH STUDENT ACCOUNT</span><h1>{currentMode === 'signin' ? 'Welcome back.' : currentMode === 'signup' ? 'Create your student account.' : 'Reset your password.'}</h1><p>Use one account for service requests, your student workspace, CBT access and personalised academic support.</p><div className="auth-benefits"><div><ShieldCheck size={18}/><span>Verified-first student workflows</span></div><div><UserCheck size={18}/><span>Profile details stay tied to your account</span></div><div><Lock size={18}/><span>Authentication handled by Supabase Auth</span></div></div></div><div className="auth-page-card"><div className="auth-card-head"><div><h2>{currentMode === 'signin' ? 'Sign in' : currentMode === 'signup' ? 'Register' : 'Reset password'}</h2><p>{currentMode === 'signin' ? 'Open your dashboard.' : currentMode === 'signup' ? 'Register your real student profile.' : 'We will send a secure reset link.'}</p></div></div>{message && <div className="auth-v2-message">{message}</div>}<form onSubmit={submit} className="auth-v2-form">
    {currentMode === 'signup' && <><label>Full Name<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Emmanuel Okon" required/></label><div className="auth-v2-two"><label>Phone / WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" placeholder="080..." required/></label><label>JAMB Reg. No.<input value={jambReg} onChange={e=>setJambReg(e.target.value)} placeholder="Optional"/></label></div><div className="auth-v2-two"><label>Institution<select value={institution} onChange={e=>setInstitution(e.target.value)}>{institutions.map(x=><option key={x}>{x}</option>)}</select></label><label>Target Exam<select value={targetExam} onChange={e=>setTargetExam(e.target.value)}>{targets.map(x=><option key={x}>{x}</option>)}</select></label></div></>}
    <label>Email Address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="student@example.com" required/></label>{currentMode !== 'forgot' && <div className="auth-v2-two"><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" minLength={8} required/></label>{currentMode === 'signup' && <label>Confirm Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} type="password" placeholder="Repeat password" minLength={8} required/></label>}</div>}
    <button type="submit" className="auth-v2-submit" disabled={busy}>{busy ? 'Processing…' : currentMode === 'signin' ? 'Sign In to Dashboard' : currentMode === 'signup' ? 'Register Real Account' : 'Send Reset Link'}<ArrowRight size={16}/></button>
  </form><div className="auth-v2-switch">{currentMode !== 'signin' && <button onClick={()=>{setCurrentMode('signin');setMessage('')}}>Sign in</button>}{currentMode !== 'signup' && <button onClick={()=>{setCurrentMode('signup');setMessage('')}}>Create account</button>}{currentMode !== 'forgot' && <button onClick={()=>{setCurrentMode('forgot');setMessage('')}}>Forgot password?</button>}</div></div></div></div>;
}
