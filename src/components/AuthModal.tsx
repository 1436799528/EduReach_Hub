import React, { useEffect, useState } from 'react';
import { X, GraduationCap, Lock, Mail, User, School, ArrowRight, CheckCircle2, ShieldCheck, Eye, EyeOff, Sparkles, AlertCircle, Eye as GuestEye } from 'lucide-react';
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
  const getResolvedMode = (m?: string): 'login' | 'register' => {
    if (m === 'signup' || m === 'register') return 'register';
    return 'login';
  };

  const [mode, setMode] = useState<'login' | 'register'>(getResolvedMode(modeProp || initialMode));
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
    const targetMode = getResolvedMode(modeProp || initialMode);
    setMode(targetMode);
    setError('');
    setConfirmationSent(false);
  }, [modeProp, initialMode, isOpen]);

  if (isOpen === false) return null;

  const handleNotifyLogin = (profile: UserProfile) => {
    if (onLoginSuccess) onLoginSuccess(profile);
    else if (onLogin) onLogin(profile);
  };

  const handleModeChange = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    resetError();
    setConfirmationSent(false);
    onSwitchMode?.(nextMode === 'register' ? 'signup' : 'login');
  };

  const resetError = () => { if (error) setError(''); };

  const handleGuestLogin = () => {
    if (busy || !onGuestLogin) return;
    setError('');
    onGuestLogin();
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setBusy(true);
    try {
      const { data, error: authError } = await signInWithPassword(loginEmail, loginPassword);
      if (authError) throw authError;
      if (!data.session) throw new Error('Your email needs to be confirmed before you can sign in. Check your inbox.');
      const profile = await getCurrentUserProfile();
      if (!profile) throw new Error('Your account is authenticated, but your student profile could not be loaded. Please try again.');
      handleNotifyLogin(profile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const institution = INSTITUTIONS.find(item => item.id === institutionId);
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
        handleNotifyLogin(profile);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600"><GraduationCap className="w-5 h-5" /></div>
            <div>
              <div className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">EDUREACH <span className="text-orange-600">STUDENT GATE</span></div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Access Campus Materials & Services</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer" title="Close"><X className="w-5 h-5" /></button>
        </div>

        {redirectMessage && <div className="bg-orange-50 px-5 py-2.5 border-b border-orange-100 flex items-center gap-2 text-xs font-semibold text-orange-800"><Sparkles className="w-4 h-4 text-orange-600 shrink-0" /><span>{redirectMessage}</span></div>}

        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-slate-200 text-xs font-bold">
            <button onClick={() => handleModeChange('login')} className={`py-2 rounded-lg transition-all text-center cursor-pointer ${mode === 'login' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>Sign In to Account</button>
            <button onClick={() => handleModeChange('register')} className={`py-2 rounded-lg transition-all text-center cursor-pointer ${mode === 'register' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>Register New Student</button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2 text-xs font-semibold text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}

          {confirmationSent ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-600" /></div>
              <div><h3 className="text-base font-extrabold text-slate-900">Check your email</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">Your account has been created. Confirm your email address, then return here to sign in.</p></div>
              <button type="button" onClick={() => { handleModeChange('login'); setConfirmationSent(false); }} className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700">Go to Sign In</button>
            </div>
          ) : mode === 'login' ? (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Student Email</label>
                  <div className="relative"><input type="email" required autoComplete="email" placeholder="you@example.com" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); resetError(); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 pl-9 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none" /><Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Password</label>
                  <div className="relative"><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" value={loginPassword} onChange={e => { setLoginPassword(e.target.value); resetError(); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 pl-9 pr-10 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none" /><Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                </div>
                <button type="submit" disabled={busy} className="er-cta w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"><span>{busy ? 'Signing In…' : 'Sign In to Student Portal'}</span><ArrowRight className="w-4 h-4" /></button>
              </form>

              {onGuestLogin && (
                <div className="pt-1">
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-wider font-bold"><span className="h-px flex-1 bg-slate-200" /><span>Preview</span><span className="h-px flex-1 bg-slate-200" /></div>
                  <button type="button" onClick={handleGuestLogin} disabled={busy} className="er-cta w-full mt-3 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"><GuestEye className="w-4 h-4 text-cyan-300" /><span>Continue as Guest</span></button>
                  <p className="text-[10px] text-slate-400 text-center mt-2">Preview the student interface with mock data. No account is created.</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div><label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name</label><div className="relative"><input type="text" required autoComplete="name" placeholder="e.g. Chukwuebuka Obi" value={name} onChange={e => { setName(e.target.value); resetError(); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 pl-9 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none" /><User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /></div></div>
              <div><label className="block text-[11px] font-bold text-slate-700 mb-1">Student Email</label><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); resetError(); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="block text-[11px] font-bold text-slate-700 mb-1">University Campus</label><div className="relative"><select value={institutionId} onChange={e => setInstitutionId(e.target.value as InstitutionId)} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 pl-9 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer">{INSTITUTIONS.filter(inst => inst.id !== 'ALL').map(inst => <option key={inst.id} value={inst.id}>{inst.shortName} - {inst.state}</option>)}</select><School className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div>
                <div><label className="block text-[11px] font-bold text-slate-700 mb-1">Level</label><select value={level} onChange={e => setLevel(e.target.value)} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"><option>100L</option><option>200L</option><option>300L</option><option>400L</option><option>500L</option><option>PGD/MSc</option></select></div>
              </div>
              <div><label className="block text-[11px] font-bold text-slate-700 mb-1">Department</label><input type="text" required placeholder="e.g. Computer Science, Law, Nursing" value={department} onChange={e => { setDepartment(e.target.value); resetError(); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none" /></div>
              <div><label className="block text-[11px] font-bold text-slate-700 mb-1">Create Password</label><input type="password" required minLength={6} autoComplete="new-password" placeholder="Minimum 6 characters" value={password} onChange={e => { setPassword(e.target.value); resetError(); }} className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none" /></div>
              <button type="submit" disabled={busy} className="er-cta w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"><CheckCircle2 className="w-4 h-4" /><span>{busy ? 'Creating Account…' : 'Create Free Scholar Account'}</span></button>
            </form>
          )}
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /><span>Student Data Privacy • Secure Authentication</span></div>
      </div>
    </div>
  );
};
