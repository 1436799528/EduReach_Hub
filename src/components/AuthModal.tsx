import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthModal({ mode, onClose }: { mode: 'signin' | 'signup'; onClose: () => void }) {
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
      if (currentMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hub-auth-overlay" role="dialog" aria-modal="true">
      <div className="hub-auth-modal">
        <button className="hub-auth-close" onClick={onClose} aria-label="Close">×</button>
        <div className="hub-auth-brand">EduReach<span>.ng</span></div>
        <h2>{currentMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
        <p>{currentMode === 'signup' ? 'Create an EduReach account to submit service requests and track them.' : 'Sign in to continue with your student services.'}</p>
        <form onSubmit={submit}>
          {currentMode === 'signup' && <input className="hub-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />}
          <input className="hub-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required />
          <input className="hub-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={6} />
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
