import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, GraduationCap, Lock, Mail, School, Sparkles, User, X } from 'lucide-react';
import { UserProfile, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { getCurrentUserProfile, signInWithPassword, signUpStudent } from '../lib/auth';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: UserProfile) => void;
  onLogin?: (user: UserProfile) => void;
  onGuestLogin?: () => void;
  initialMode?: 'login' | 'register' | 'signup';
  mode?: 'login' | 'register' | 'signup';
  redirectMessage?: string;
  onSwitchMode?: (mode: 'login' | 'signup') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen = true,
  onClose,
  onLoginSuccess,
  onLogin,
  onGuestLogin,
  initialMode = 'login',
  mode: modeProp,
  redirectMessage,
  onSwitchMode,
}) => {
  const resolveMode = (value?: string): 'login' | 'register' => value === 'signup' || value === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(resolveMode(modeProp || initialMode));
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institutionId, setInstitutionId] = useState<InstitutionId>('UNICAL');
  const [department, setDepartment] = useState('Computer Science');
  const [level, setLevel] = useState('300L');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    setMode(resolveMode(modeProp || initialMode));
    setError('');
    setConfirmationSent(false);
  }, [modeProp, initialMode, isOpen]);

  if (!isOpen) return null;

  const notifyLogin = (profile: UserProfile) => {
    if (onLoginSuccess) onLoginSuccess(profile);
    else onLogin?.(profile);
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError('');
    setConfirmationSent(false);
    onSwitchMode?.(next === 'register' ? 'signup' : 'login');
  };

  const handleGuestPreview = () => {
    if (busy || !onGuestLogin) return;
    setError('');
    onGuestLogin();
    onClose();
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data, error: authError } = await signInWithPassword(loginEmail, loginPassword);
      if (authError) throw authError;
      if (!data.session) throw new Error('Your email needs to be confirmed before you can sign in. Check your inbox.');
      const profile = await getCurrentUserProfile();
      if (!profile) throw new Error('Your account is authenticated, but your student profile could not be loaded. Please try again.');
      notifyLogin(profile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const institution = INSTITUTIONS.find((item) => item.id === institutionId);
      const result = await signUpStudent({
        fullName: name,
        school: institution?.name || institutionId,
        faculty: '',
        department,
        level,
        institutionId,
      }, email, password);
      if (result.error) throw result.error;

      if (result.data.session) {
        const profile = await getCurrentUserProfile();
        if (!profile) throw new Error('Account created, but your student profile could not be loaded. Please sign in again.');
        notifyLogin(profile);
        onClose();
      } else {
        setConfirmationSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="er-card relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="relative border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white sm:p-6">
          <div className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="er-glow flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg"><GraduationCap className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-black tracking-tight sm:text-base">EDUREACH <span className="text-orange-400">STUDENT GATE</span></div>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Access the student hub</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white" title="Close"><X className="h-5 w-5" /></button>
          </div>

          {onGuestLogin && (
            <button
              type="button"
              onClick={handleGuestPreview}
              disabled={busy}
              className="er-cta mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-left shadow-[0_0_25px_rgba(34,211,238,0.12)] transition hover:bg-cyan-400/15 disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-slate-950"><Eye className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-black text-white sm:text-sm">Guest Preview</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-cyan-100/75 sm:text-xs">Explore the full student interface with mock data. No account required.</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-cyan-200" />
            </button>
          )}
        </div>

        {redirectMessage && (
          <div className="flex items-center gap-2 border-b border-orange-100 bg-orange-50 px-5 py-2.5 text-xs font-semibold text-orange-800">
            <Sparkles className="h-4 w-4 shrink-0 text-orange-600" />
            <span>{redirectMessage}</span>
          </div>
        )}

        <div className="border-b border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold">
            <button type="button" onClick={() => switchMode('login')} className={`rounded-lg py-2.5 transition ${mode === 'login' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>Sign In</button>
            <button type="button" onClick={() => switchMode('register')} className={`rounded-lg py-2.5 transition ${mode === 'register' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>Register</button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {confirmationSent ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-7 w-7 text-emerald-600" /></div>
              <h3 className="mt-4 text-base font-black text-slate-900">Check your email</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-600">Your account has been created. Confirm your email, then return to sign in.</p>
              <button type="button" onClick={() => { switchMode('login'); setConfirmationSent(false); }} className="er-cta mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white">Go to Sign In</button>
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <label className="block text-[11px] font-bold text-slate-700">Student Email
                <div className="relative mt-1.5"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" required autoComplete="email" value={loginEmail} onChange={(event) => { setLoginEmail(event.target.value); setError(''); }} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 bg-white p-3 pl-9 text-xs outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10" /></div>
              </label>
              <label className="block text-[11px] font-bold text-slate-700">Password
                <div className="relative mt-1.5"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={loginPassword} onChange={(event) => { setLoginPassword(event.target.value); setError(''); }} placeholder="Enter your password" className="w-full rounded-xl border border-slate-300 bg-white p-3 pl-9 pr-10 text-xs outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Toggle password visibility">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              </label>
              <button type="submit" disabled={busy} className="er-cta flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Signing In…' : 'Sign In to Student Portal'}<ArrowRight className="h-4 w-4" /></button>
              <p className="text-center text-[10px] text-slate-400">Guest Preview is available above and works without creating an account.</p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-700">Full Name<input required value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="e.g. Chukwuebuka Obi" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-orange-500" /></label>
              <label className="block text-[11px] font-bold text-slate-700">Student Email<input type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-orange-500" /></label>
              <div className="grid gap-2 sm:grid-cols-[1.6fr_.8fr]">
                <label className="block text-[11px] font-bold text-slate-700">University Campus
                  <div className="relative mt-1.5"><School className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select value={institutionId} onChange={(event) => setInstitutionId(event.target.value as InstitutionId)} className="w-full rounded-xl border border-slate-300 bg-white p-2.5 pl-9 text-xs outline-none focus:border-orange-500">{INSTITUTIONS.filter((item) => item.id !== 'ALL').map((item) => <option key={item.id} value={item.id}>{item.shortName} - {item.state}</option>)}</select></div>
                </label>
                <label className="block text-[11px] font-bold text-slate-700">Level<select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-orange-500"><option>100L</option><option>200L</option><option>300L</option><option>400L</option><option>500L</option><option>PGD/MSc</option></select></label>
              </div>
              <label className="block text-[11px] font-bold text-slate-700">Department<input required value={department} onChange={(event) => { setDepartment(event.target.value); setError(''); }} placeholder="e.g. Computer Science, Law, Nursing" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-orange-500" /></label>
              <label className="block text-[11px] font-bold text-slate-700">Create Password<input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder="Minimum 6 characters" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-orange-500" /></label>
              <button type="submit" disabled={busy} className="er-cta mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-xs font-black text-white disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />{busy ? 'Creating Account…' : 'Create Student Account'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
