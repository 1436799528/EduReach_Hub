import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthMode = 'signin' | 'signup';

export default function AuthModal({ mode, onClose }: { mode: AuthMode; onClose: () => void }) {
  const [activeMode, setActiveMode] = useState<AuthMode>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (activeMode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        setMessage(data.session ? 'Account created successfully.' : 'Account created. Check your email if confirmation is required.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setMessage('Signed in successfully.');
        window.setTimeout(onClose, 500);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <div className="auth-brand">EduReach Hub</div>
        <h2 id="auth-title">{activeMode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="auth-intro">{activeMode === 'signin' ? 'Sign in to continue with EduReach.' : 'Create your EduReach account and get started.'}</p>

        <form onSubmit={submit}>
          {activeMode === 'signup' && (
            <input className="form-control auth-field" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full Name" required />
          )}
          <input className="form-control auth-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email Address" autoComplete="email" required />
          <input className="form-control auth-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete={activeMode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required />
          {error && <div className="auth-message auth-error">{error}</div>}
          {message && <div className="auth-message auth-success">{message}</div>}
          <button className="btn_one auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : activeMode === 'signin' ? 'Sign In' : 'Sign Up'}</button>
        </form>

        <div className="auth-switch">
          {activeMode === 'signin' ? (
            <>New to EduReach? <button type="button" onClick={() => { setActiveMode('signup'); setMessage(''); setError(''); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => { setActiveMode('signin'); setMessage(''); setError(''); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
