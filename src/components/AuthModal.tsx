import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

const institutions = ['University of Calabar (UNICAL)', 'University of Nigeria, Nsukka (UNN)', 'University of Uyo (UNIUYO)', 'University of Lagos (UNILAG)', 'Other Nigerian Institution'];
const targets = ['JAMB (UTME)', 'POST-UTME', 'WAEC / NECO', 'Undergraduate'];

export default function AuthModal({ mode, onClose }: { mode: 'signin' | 'signup'; onClose: () => void }) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [identifier, setIdentifier] = useState('');
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
      if (currentMode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!phone.trim()) throw new Error('Phone / WhatsApp number is required.');
        const { error } = await supabase.auth.signUp({
          email: identifier.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              institution: institution.trim(),
              jamb_registration_number: jambReg.trim() || null,
              target_exam: targetExam,
            },
          },
        });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      } else {
        if (!identifier.includes('@')) {
          throw new Error('Phone-number login needs the SMS/WhatsApp provider connection. Use your email for password login for now.');
        }
        const { error } = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });
        if (error) throw error;
        sessionStorage.removeItem('edureach_demo_mode');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  function enterDemo() {
    sessionStorage.setItem('edureach_demo_mode', 'true');
    onClose();
    window.location.href = '/dashboard';
  }

  return (
    <div className="hub-auth-overlay" role="dialog" aria-modal="true">
      <div className="hub-auth-modal hub-auth-dense">
        <button className="hub-auth-close" onClick={onClose} aria-label="Close">×</button>
        <div className="hub-auth-brand">EduReach<span>.ng</span></div>
        <div className="hub-auth-trust">EduReach.ng Account • Instant CBT Access &amp; Service Tracking</div>
        <h2>{currentMode === 'signup' ? 'Create your student account' : 'Sign in to EduReach'}</h2>
        <p>{currentMode === 'signup' ? 'One compact profile powers service tracking, campus updates and student tools.' : 'Use your email and password to open your student workspace.'}</p>

        <div className="hub-demo-auth-box">
          <div><span className="hub-demo-label">DEMO ACCOUNT</span><strong>Preview the full student workspace</strong><small>Sample data only — no real payment or student record is used.</small></div>
          <button type="button" className="hub-outline-btn" onClick={enterDemo}>Enter Demo</button>
        </div>

        <form onSubmit={submit}>
          {currentMode === 'signup' ? (
            <>
              <input className="hub-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
              <input className="hub-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp / phone number" required />
              <input className="hub-field" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email address" required />
              <select className="hub-field" value={institution} onChange={(e) => setInstitution(e.target.value)} required><option value="">Institution / University</option>{institutions.map((item) => <option key={item}>{item}</option>)}</select>
              <input className="hub-field" value={jambReg} onChange={(e) => setJambReg(e.target.value)} placeholder="JAMB Registration Number (optional)" />
              <div className="auth-radio-grid">{targets.map((target) => <label key={target}><input type="radio" name="target_exam" value={target} checked={targetExam === target} onChange={() => setTargetExam(target)} /> <span>{target}</span></label>)}</div>
              <div className="auth-two-col"><input className="hub-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ chars)" minLength={8} required /><input className="hub-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" minLength={8} required /></div>
            </>
          ) : (
            <>
              <input className="hub-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email address" required />
              <input className="hub-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
              <button type="button" className="hub-otp-btn" onClick={() => setMessage('WhatsApp OTP requires a WhatsApp messaging provider and server-side verification. The button is reserved for that integration.')}>Login via WhatsApp OTP</button>
            </>
          )}
          {message && <div className="hub-auth-message">{message}</div>}
          <button className="hub-primary-btn hub-full-btn" disabled={busy}>{busy ? 'Please wait…' : currentMode === 'signup' ? 'Create Account' : 'Sign In'}</button>
        </form>
        <button className="hub-auth-switch" onClick={() => { setCurrentMode(currentMode === 'signup' ? 'signin' : 'signup'); setMessage(''); }}>
          {currentMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}
