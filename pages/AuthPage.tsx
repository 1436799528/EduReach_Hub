import { FormEvent, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import HubLayout from '../src/components/HubLayout';

const institutions = ['University of Calabar (UNICAL)', 'University of Nigeria, Nsukka (UNN)', 'University of Uyo (UNIUYO)', 'University of Lagos (UNILAG)', 'Other Nigerian Institution'];
const targets = ['JAMB (UTME)', 'POST-UTME', 'WAEC / NECO', 'Undergraduate'];

export default function AuthPage({ mode = 'signin' }: { mode?: 'signin' | 'signup' | 'forgot' }) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [jambReg, setJambReg] = useState('');
  const [targetExam, setTargetExam] = useState('JAMB (UTME)');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (currentMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/dashboard/profile` });
        if (error) throw error;
        setMessage('Password reset instructions have been sent to your email.');
      } else if (currentMode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!phone.trim()) throw new Error('WhatsApp / phone number is required.');
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone: phone.trim(), institution, jamb_registration_number: jambReg.trim() || null, target_exam: targetExam } } });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        sessionStorage.removeItem('edureach_demo_mode');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally { setBusy(false); }
  }

  return <HubLayout>
    <section className="hub-page"><div className="hub-container hub-narrow">
      <div className="hub-page-title"><span className="hub-eyebrow">ACCOUNT</span><h1>{currentMode === 'forgot' ? 'Reset your password' : currentMode === 'signup' ? 'Create your student account' : 'Welcome back'}</h1><p>{currentMode === 'signin' ? 'Sign in to submit services, track requests and use the student workspace.' : 'EduReach Account • Instant CBT Access & Service Tracking'}</p></div>
      <div className="hub-panel hub-auth-page-panel">
        {currentMode !== 'forgot' && <div className="hub-demo-box"><div><span className="hub-eyebrow">DEMO ACCESS</span><strong>See the student workspace instantly</strong><p>Demo mode uses sample data only. It does not create or modify a real student account.</p></div><button className="hub-outline-btn" type="button" onClick={() => { sessionStorage.setItem('edureach_demo_mode', 'true'); window.location.href = '/dashboard'; }}>Enter Demo Account</button></div>}
        <form className="hub-auth-form" onSubmit={submit}>
          {currentMode === 'signup' && <><label>Full Name<input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></label><label>WhatsApp / Phone Number<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="080..." required /></label><label>Institution / University<select value={institution} onChange={e => setInstitution(e.target.value)} required><option value="">Select institution</option>{institutions.map(item => <option key={item}>{item}</option>)}</select></label><label>JAMB Registration Number <span>(optional)</span><input value={jambReg} onChange={e => setJambReg(e.target.value)} placeholder="Optional" /></label><div className="auth-radio-grid">{targets.map(target => <label key={target}><input type="radio" name="target_exam" value={target} checked={targetExam === target} onChange={() => setTargetExam(target)} /> <span>{target}</span></label>)}</div></>}
          <label>Email Address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
          {currentMode !== 'forgot' && <div className="auth-two-col"><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" minLength={8} required /></label>{currentMode === 'signup' && <label>Confirm Password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" minLength={8} required /></label>}</div>}
          {currentMode === 'signin' && <button type="button" className="hub-otp-btn" onClick={() => setMessage('WhatsApp OTP requires a WhatsApp messaging provider and server-side verification. Email/password remains active now.')}>Login via WhatsApp OTP</button>}
          <button className="hub-primary-btn hub-full-btn" disabled={busy}>{busy ? 'Please wait…' : currentMode === 'forgot' ? 'Send Reset Link' : currentMode === 'signup' ? 'Create Account' : 'Sign In'}</button>
          {message && <div className="hub-auth-message">{message}</div>}
        </form>
        <div className="hub-auth-links">{currentMode !== 'signin' && <button onClick={() => setCurrentMode('signin')}>Sign in</button>}{currentMode !== 'signup' && <button onClick={() => setCurrentMode('signup')}>Create account</button>}{currentMode !== 'forgot' && <button onClick={() => setCurrentMode('forgot')}>Forgot password?</button>}</div>
      </div>
    </div></section>
  </HubLayout>;
}
