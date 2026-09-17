import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, UserCheck } from 'lucide-react';
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
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      if (currentMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/forgot-password`,
        });
        if (error) throw error;
        setMessage('Password reset instructions have been sent to your email. Open the link to choose a new password.');
      } else if (currentMode === 'reset') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword('');
        setConfirmPassword('');
        setCurrentMode('signin');
        setMessage('Password updated successfully. Sign in with your new password.');
      } else if (currentMode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!fullName.trim() || !phone.trim()) throw new Error('Full name and phone number are required.');
        const selectedInstitution = institutions.find((item) => item.label === institution);
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              institution,
              institution_acronym: selectedInstitution?.acronym || null,
              jamb_registration_number: jambReg.trim() || null,
              target_exam: targetExam,
            },
          },
        });
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  const title = currentMode === 'signin'
    ? 'Welcome back.'
    : currentMode === 'signup'
      ? 'Create your student account.'
      : currentMode === 'reset'
        ? 'Set a new password.'
        : 'Reset your password.';

  const cardTitle = currentMode === 'signin'
    ? 'Sign in'
    : currentMode === 'signup'
      ? 'Register'
      : currentMode === 'reset'
        ? 'New password'
        : 'Reset password';

  return <div className="auth-page-v2">
    <div className="auth-page-brand"><a href="/"><span>ER</span> EduReach<b>.ng</b></a><small>Student services, CBT practice and academic support</small></div>
    <div className="auth-page-layout">
      <div className="auth-page-copy">
        <span className="auth-eyebrow">EDUREACH STUDENT ACCOUNT</span>
        <h1>{title}</h1>
        <p>Use one account for service requests, your student workspace, CBT access and personalised academic support.</p>
        <div className="auth-benefits">
          <div><ShieldCheck size={18}/><span>Verified-first student workflows</span></div>
          <div><UserCheck size={18}/><span>Profile details stay tied to your account</span></div>
          <div><Lock size={18}/><span>Authentication handled by Supabase Auth</span></div>
        </div>
      </div>
      <div className="auth-page-card">
        <div className="auth-card-head"><div><h2>{cardTitle}</h2><p>{currentMode === 'signin' ? 'Open your dashboard.' : currentMode === 'signup' ? 'Register your real student profile.' : currentMode === 'reset' ? 'Choose a strong password you have not used elsewhere.' : 'We will send a secure reset link.'}</p></div></div>
        {message && <div className="auth-v2-message">{message}</div>}
        <form onSubmit={submit} className="auth-v2-form">
          {currentMode === 'signup' && <>
            <label>Full Name<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Emmanuel Okon" required/></label>
            <div className="auth-v2-two">
              <label>Phone / WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" placeholder="080..." required/></label>
              <label>JAMB Reg. No.<input value={jambReg} onChange={e=>setJambReg(e.target.value)} placeholder="Optional"/></label>
            </div>
            <div className="auth-v2-two">
              <label>Institution<select value={institution} onChange={e=>setInstitution(e.target.value)}>{institutions.map(x=><option key={x.label}>{x.label}</option>)}</select></label>
              <label>Target Exam<select value={targetExam} onChange={e=>setTargetExam(e.target.value)}>{targets.map(x=><option key={x}>{x}</option>)}</select></label>
            </div>
          </>}

          <label>Email Address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="student@example.com" required/></label>

          {(currentMode === 'signin' || currentMode === 'signup') && <div className="auth-v2-two">
            <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" minLength={8} required/></label>
            {currentMode === 'signup' && <label>Confirm Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} type="password" placeholder="Repeat password" minLength={8} required/></label>}
          </div>}

          {currentMode === 'reset' && <div className="auth-v2-two">
            <label>New Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" minLength={8} required/></label>
            <label>Confirm Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} type="password" placeholder="Repeat password" minLength={8} required/></label>
          </div>}

          <button type="submit" className="auth-v2-submit" disabled={busy}>
            {busy ? 'Processing…' : currentMode === 'signin' ? 'Sign In to Dashboard' : currentMode === 'signup' ? 'Register Real Account' : currentMode === 'reset' ? 'Update Password' : 'Send Reset Link'}
            <ArrowRight size={16}/>
          </button>
        </form>

        <div className="auth-v2-switch">
          {currentMode !== 'signin' && currentMode !== 'reset' && <button onClick={()=>{setCurrentMode('signin');setMessage('')}}>Sign in</button>}
          {currentMode !== 'signup' && currentMode !== 'reset' && <button onClick={()=>{setCurrentMode('signup');setMessage('')}}>Create account</button>}
          {currentMode !== 'forgot' && currentMode !== 'reset' && <button onClick={()=>{setCurrentMode('forgot');setMessage('')}}>Forgot password?</button>}
        </div>
      </div>
    </div>
  </div>;
}
