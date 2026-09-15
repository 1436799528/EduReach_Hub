import { FormEvent, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import HubLayout from '../src/components/HubLayout';

export default function AuthPage({ mode = 'signin' }: { mode?: 'signin' | 'signup' | 'forgot' }) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <HubLayout>
      <section className="hub-page">
        <div className="hub-container hub-narrow">
          <div className="hub-page-title">
            <span className="hub-eyebrow">ACCOUNT</span>
            <h1>{currentMode === 'forgot' ? 'Reset your password' : currentMode === 'signup' ? 'Create your EduReach account' : 'Welcome back'}</h1>
            <p>{currentMode === 'signin' ? 'Sign in to submit services, track requests and use the student workspace.' : 'Use your EduReach account to keep your student requests and activity connected.'}</p>
          </div>

          <div className="hub-panel hub-auth-page-panel">
            {currentMode !== 'forgot' && (
              <div className="hub-demo-box">
                <div>
                  <span className="hub-eyebrow">DEMO ACCESS</span>
                  <strong>See the student workspace instantly</strong>
                  <p>Demo mode uses sample data only. It does not create or modify a real student account.</p>
                </div>
                <button className="hub-outline-btn" type="button" onClick={() => { sessionStorage.setItem('edureach_demo_mode', 'true'); window.location.href = '/dashboard'; }}>
                  Enter Demo Account
                </button>
              </div>
            )}

            <form className="hub-auth-form" onSubmit={submit}>
              {currentMode === 'signup' && <label>Full Name<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required /></label>}
              <label>Email Address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
              {currentMode !== 'forgot' && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} required /></label>}
              <button className="hub-primary-btn hub-full-btn" disabled={busy}>{busy ? 'Please wait…' : currentMode === 'forgot' ? 'Send Reset Link' : currentMode === 'signup' ? 'Create Account' : 'Sign In'}</button>
              {message && <div className="hub-auth-message">{message}</div>}
            </form>

            <div className="hub-auth-links">
              {currentMode !== 'signin' && <button onClick={() => { setCurrentMode('signin'); setMessage(''); }}>Sign in</button>}
              {currentMode !== 'signup' && <button onClick={() => { setCurrentMode('signup'); setMessage(''); }}>Create account</button>}
              {currentMode !== 'forgot' && <button onClick={() => { setCurrentMode('forgot'); setMessage(''); }}>Forgot password?</button>}
            </div>
          </div>
        </div>
      </section>
    </HubLayout>
  );
}
