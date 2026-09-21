import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { notifyAuthChanged } from '../src/lib/auth';
import { bootstrapAdmin } from '../src/lib/api';
import BrandLogo from '../src/components/BrandLogo';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify';

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function AuthPageV2({ mode = 'signin' }: { mode?: Mode }) {
  const [currentMode, setCurrentMode] = useState<Mode>(mode);

  // Registration session fields (Only what user specified!)
  // 1. First Name
  const [firstName, setFirstName] = useState('');
  // 2. Last Name
  const [lastName, setLastName] = useState('');
  // 3. Email Address
  const [email, setEmail] = useState('');
  // 4. Phone Number
  const [phone, setPhone] = useState('');
  // 5. Password
  const [password, setPassword] = useState('');
  // 6. Confirm Password
  const [confirmPassword, setConfirmPassword] = useState('');
  // 7. Account Type — Student / Parent / Teacher
  const [accountType, setAccountType] = useState<'student' | 'parent' | 'teacher'>('student');
  // 8. Terms & Privacy agreement
  const [termsAgreed, setTermsAgreed] = useState(false);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyEmailSent, setVerifyEmailSent] = useState('');

  const modePaths: Record<Mode, string> = {
    signin: '/login',
    signup: '/register',
    forgot: '/forgot-password',
    reset: '/reset-password',
    verify: '/verify-email',
  };

  // Keep the address bar on the canonical route for the visible mode,
  // preserving query/hash tokens (password recovery links) and ?next=.
  useEffect(() => {
    const canonical = modePaths[currentMode] + window.location.search + window.location.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (current !== canonical) window.history.replaceState({}, '', canonical);
  }, [currentMode]);

  async function resendVerification() {
    const target = (verifyEmailSent || email).trim();
    if (!target) {
      setError('Enter your email address first.');
      return;
    }
    if (!isSupabaseConfigured) {
      setMessage('Email service is not configured yet — your verification link will send once it is.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      setMessage('');
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: target });
      if (resendError) throw resendError;
      setMessage('A new verification email has been sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to resend the verification email.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
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
    setError('');

    try {
      // 1. FORGOT PASSWORD
      if (currentMode === 'forgot') {
        if (!email.trim() || !email.includes('@')) {
          throw new Error('Please enter a valid email address.');
        }
        try {
          await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/reset-password`,
          });
        } catch {
          // graceful fallback
        }
        setMessage('If an account exists for this email, you will receive password reset instructions.');
        setBusy(false);
        return;
      }

      // 2. RESET PASSWORD
      if (currentMode === 'reset') {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const { error: resetErr } = await supabase.auth.updateUser({ password });
        if (resetErr) throw resetErr;
        setMessage('Password updated successfully. You can now sign in.');
        setCurrentMode('signin');
        setPassword('');
        setConfirmPassword('');
        setBusy(false);
        return;
      }

      // 3. REGISTRATION (SIGNUP)
      if (currentMode === 'signup') {
        if (!firstName.trim()) throw new Error('First Name is required.');
        if (!lastName.trim()) throw new Error('Last Name is required.');
        if (!email.trim() || !email.includes('@')) throw new Error('A valid Email Address is required.');
        if (!phone.trim() || phone.length < 10) throw new Error('A valid Nigerian phone number is required.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!termsAgreed) throw new Error('You must agree to the Terms of Service and Privacy Policy.');

        const fullName = `${firstName.trim()} ${lastName.trim()}`;

        // Attempt Supabase sign up when credentials are configured.
        if (isSupabaseConfigured) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                full_name: fullName,
                phone: phone.trim(),
                account_type: accountType,
                terms_agreed: true,
              },
            },
          });
          if (signUpError) throw signUpError;
        }

        // Local profile cache for unconfigured preview/offline sessions only.
        if (!isSupabaseConfigured) {
          localStorage.setItem(
            'edureach-student-profile',
            JSON.stringify({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: fullName,
              email: email.trim(),
              phone: phone.trim(),
              account_type: accountType,
            })
          );
        }
        if (!isSupabaseConfigured) {
          localStorage.setItem('edureach-local-user-email', email.trim());
          notifyAuthChanged();
        }
        setVerifyEmailSent(email.trim());
        setCurrentMode('verify');
        setBusy(false);
        return;
      }

      // 4. SIGN IN (LOGIN)
      if (currentMode === 'signin') {
        if (!email.trim() || !password) {
          throw new Error('Email address and password are required.');
        }

        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError) throw signInError;

          const {
            data: { session: signedInSession },
          } = await supabase.auth.getSession();

          if (signedInSession?.access_token) {
            // The configured bootstrap account can become the first super administrator.
            try { await bootstrapAdmin(); } catch { /* already bootstrapped or not the designated account */ }
            const adminCheck = await fetch('/api/admin/session', {
              headers: { Authorization: `Bearer ${signedInSession.access_token}` },
            });
            window.sessionStorage.removeItem('edureach-admin-student-view');
            notifyAuthChanged();
            navigateInApp(adminCheck.ok ? '/admin' : getSafeNextPath());
            return;
          }
        } catch (signInErr) {
          if (isSupabaseConfigured) throw signInErr;
        }

        if (!isSupabaseConfigured) {
          localStorage.setItem('edureach-local-user-email', email.trim());
          notifyAuthChanged();
          navigateInApp(getSafeNextPath());
          return;
        }

        throw new Error('Unable to confirm your EduReach session. Please try signing in again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication.');
    } finally {
      setBusy(false);
    }
  }

  const pageTitle =
    currentMode === 'signin'
      ? 'Sign in to EduReach'
      : currentMode === 'signup'
      ? 'Create Your EduReach Account'
      : currentMode === 'verify'
      ? 'Verify Your Email'
      : currentMode === 'reset'
      ? 'Set New Password'
      : 'Reset Your Password';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#0f172a',
      }}
    >
      {/* BRAND LOGO BAR */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: '#0f172a',
            fontSize: '22px',
            fontWeight: 900,
            letterSpacing: '-0.02em',
          }}
        >
          <BrandLogo height={36} />
          <span>
            EduReach<span style={{ color: '#D9381E' }}>.ng</span>
          </span>
        </a>
      </div>

      {/* AUTH CARD */}
      <div
        style={{
          width: '100%',
          maxWidth: currentMode === 'signup' ? '540px' : '440px',
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#D9381E',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {currentMode === 'signup'
              ? 'NEW REGISTRATION'
              : currentMode === 'verify'
              ? 'EMAIL VERIFICATION'
              : 'ACADEMIC PORTAL ACCESS'}
          </span>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '4px 0 6px' }}>
            {pageTitle}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            {currentMode === 'signup'
              ? 'Quick registration for students, parents, and teachers.'
              : currentMode === 'verify'
              ? 'Check your inbox to confirm your email ownership.'
              : 'Access CBT classroom, scratch cards, and student services.'}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #a7f3d0',
              color: '#047857',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{message}</span>
          </div>
        )}

        {/* MODE: EMAIL VERIFICATION */}
        {currentMode === 'verify' ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#D9381E',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Mail size={26} />
            </div>
            <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, marginBottom: '20px' }}>
              We sent a verification link to <strong>{verifyEmailSent || email}</strong>. Please check your inbox or spam folder to confirm your email.
            </p>

            <div style={{ display: 'grid', gap: '10px' }}>
              <a
                href="/profile"
                className="hub-primary-btn"
                style={{
                  textDecoration: 'none',
                  background: '#D9381E',
                  textAlign: 'center',
                  padding: '12px',
                  borderRadius: '9px',
                }}
              >
                Proceed to Profile Completion →
              </a>

              <button
                type="button"
                onClick={() => void resendVerification()}
                className="hub-outline-btn"
                style={{ padding: '10px', fontSize: '12px' }}
              >
                Resend Verification Email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: '14px' }}>
            {/* REGISTRATION FORM (SIGNUP) */}
            {currentMode === 'signup' && (
              <>
                {/* 1. FIRST NAME & 2. LAST NAME */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. First name"
                      required
                      autoComplete="given-name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Last name"
                      required
                      autoComplete="family-name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                  </div>
                </div>

                {/* 3. EMAIL ADDRESS */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      required
                      autoComplete="email"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  </div>
                </div>

                {/* 4. PHONE NUMBER */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Phone Number *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08012345678"
                      required
                      autoComplete="tel"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                    <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  </div>
                </div>

                {/* 7. ACCOUNT TYPE — Student / Parent / Teacher */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Account Type *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {(['student', 'parent', 'teacher'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAccountType(type)}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: accountType === type ? '#D9381E' : '#cbd5e1',
                          background: accountType === type ? '#FFF0E6' : '#ffffff',
                          color: accountType === type ? '#D9381E' : '#475569',
                          fontWeight: 800,
                          fontSize: '12px',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. PASSWORD & 6. CONFIRM PASSWORD */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                      Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 chars"
                        minLength={8}
                        required
                        autoComplete="new-password"
                        style={{
                          width: '100%',
                          padding: '10px 30px 10px 12px',
                          fontSize: '13px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          outline: 'none',
                          color: '#0f172a',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '8px', top: '10px', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                      Confirm Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type password"
                        minLength={8}
                        required
                        autoComplete="new-password"
                        style={{
                          width: '100%',
                          padding: '10px 30px 10px 12px',
                          fontSize: '13px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          outline: 'none',
                          color: '#0f172a',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '8px', top: '10px', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 8. TERMS & PRIVACY AGREEMENT */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#475569',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    required
                    style={{ width: '16px', height: '16px', accentColor: '#D9381E', marginTop: '2px' }}
                  />
                  <span>
                    I agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>. No sensitive PII (NIN, BVN, banking passwords) will be requested during registration.
                  </span>
                </label>
              </>
            )}

            {/* SIGNIN FORM */}
            {currentMode === 'signin' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      required
                      autoComplete="email"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentMode('forgot');
                        setMessage('');
                        setError('');
                      }}
                      style={{ background: 'none', border: 0, color: '#D9381E', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      required
                      autoComplete="current-password"
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 36px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                    <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '10px', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

              </>
            )}

            {/* FORGOT PASSWORD FORM */}
            {currentMode === 'forgot' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                  Enter Account Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  />
                  <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                </div>
              </div>
            )}

            {/* RESET PASSWORD FORM */}
            {currentMode === 'reset' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      minLength={8}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 12px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '10px', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      minLength={8}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 12px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '10px', background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={busy}
              style={{
                background: '#D9381E',
                color: '#ffffff',
                border: 0,
                borderRadius: '9px',
                padding: '12px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px',
                boxShadow: '0 2px 8px rgba(217, 56, 30, 0.25)',
              }}
            >
              {busy
                ? 'Processing…'
                : currentMode === 'signup'
                ? 'Register & Continue'
                : currentMode === 'forgot'
                ? 'Send Reset Link'
                : currentMode === 'reset'
                ? 'Save New Password'
                : 'Sign In to Portal'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* SWITCH MODES */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '12.5px',
          }}
        >
          {currentMode !== 'signin' && (
            <button
              type="button"
              onClick={() => {
                setCurrentMode('signin');
                setMessage('');
                setError('');
              }}
              style={{ background: 'none', border: 0, color: '#D9381E', fontWeight: 800, cursor: 'pointer' }}
            >
              Already have an account? Sign in
            </button>
          )}

          {currentMode !== 'signup' && (
            <button
              type="button"
              onClick={() => {
                setCurrentMode('signup');
                setMessage('');
                setError('');
              }}
              style={{ background: 'none', border: 0, color: '#D9381E', fontWeight: 800, cursor: 'pointer' }}
            >
              Need an account? Register
            </button>
          )}
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
          <a href="/" style={{ fontSize: '12.5px', fontWeight: 800, color: '#64748b', textDecoration: 'none' }}>
            ← Back to portal
          </a>
        </div>

      </div>
    </div>
  );
}
