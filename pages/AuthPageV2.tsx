import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { userFacingError } from '../lib/errors';
import { commonInstitutions, courseProgrammes, levels } from '../src/data/studentOptions';
import { bootstrapAdmin } from '../src/lib/api';
import { apiUrl } from '../src/lib/apiBase';
import { notifyAuthChanged } from '../src/lib/auth';
import { navigateInApp } from '../src/lib/navigation';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import BrandLogo from '../src/components/BrandLogo';
import '../src/auth-page.css';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify';
type AccountType = 'student' | 'parent' | 'teacher';

const accountTypes: Array<{ value: AccountType; label: string; detail: string }> = [
  { value: 'student', label: 'Student', detail: 'I am studying or preparing for an exam' },
  { value: 'parent', label: 'Parent or guardian', detail: 'I support a student' },
  { value: 'teacher', label: 'Teacher or educator', detail: 'I support learners' },
];

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export default function AuthPageV2({ mode = 'signin' }: { mode?: Mode }) {
  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [school, setSchool] = useState('');
  const [courseProgramme, setCourseProgramme] = useState('');
  const [level, setLevel] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyEmailSent, setVerifyEmailSent] = useState('');
  const requestInFlight = useRef(false);

  const modePaths: Record<Mode, string> = {
    signin: '/login',
    signup: '/register',
    forgot: '/forgot-password',
    reset: '/reset-password',
    verify: '/verify-email',
  };

  useEffect(() => {
    const canonical = modePaths[currentMode] + window.location.search + window.location.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (current !== canonical) window.history.replaceState({}, '', canonical);
  }, [currentMode]);

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

  function changeMode(next: Mode) {
    setCurrentMode(next);
    setMessage('');
    setError('');
  }

  async function resendVerification() {
    if (requestInFlight.current) return;
    const target = (verifyEmailSent || email).trim();
    if (!target) {
      setError('Enter your email address first.');
      return;
    }
    if (!isSupabaseConfigured) {
      setMessage('Email service is not configured yet. Your verification link will send once it is.');
      return;
    }

    requestInFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: target });
      if (resendError) throw resendError;
      setMessage('A new verification email has been sent.');
    } catch (value) {
      setError(userFacingError(value, 'Unable to resend the verification email.'));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setMessage('');
    setError('');

    try {
      if (currentMode === 'forgot') {
        const target = email.trim();
        if (!target || !target.includes('@')) throw new Error('Please enter a valid email address.');
        if (!isSupabaseConfigured) {
          setMessage('Password reset email is unavailable in local preview mode. Connect an EduReach account to reset a password.');
          return;
        }
        try {
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (resetError) throw resetError;
        } catch {
          // Keep the response generic so account existence is not disclosed.
        }
        setMessage('If an account exists for this email, you will receive password reset instructions.');
        return;
      }

      if (currentMode === 'reset') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!isSupabaseConfigured) {
          throw new Error('Password reset is unavailable in local preview mode. Connect an EduReach account to update a password.');
        }
        const { error: resetError } = await supabase.auth.updateUser({ password });
        if (resetError) throw resetError;
        setMessage('Password updated successfully. You can now sign in.');
        setCurrentMode('signin');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      if (currentMode === 'signup') {
        if (!firstName.trim()) throw new Error('First name is required.');
        if (!lastName.trim()) throw new Error('Last name is required.');
        if (!email.trim() || !email.includes('@')) throw new Error('A valid email address is required.');
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 15) throw new Error('Enter a valid phone number.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (!termsAgreed) throw new Error('Please agree to the Terms of Service and Privacy Policy.');
        if (!isSupabaseConfigured) {
          throw new Error('EduReach account registration is not available until the live account service is configured.');
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const studentDetails = accountType === 'student'
          ? {
            school: school.trim(),
            course_programme: courseProgramme.trim(),
            level,
          }
          : {};
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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
              ...studentDetails,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (signUpData.session?.user) {
          notifyAuthChanged();
          navigateInApp(getSafeNextPath());
          return;
        }
        setVerifyEmailSent(email.trim());
        setCurrentMode('verify');
        setMessage('Your account is ready for verification. Check your inbox to activate it.');
        return;
      }

      if (currentMode === 'signin') {
        if (!email.trim() || !password) throw new Error('Email address and password are required.');
        if (!isSupabaseConfigured) {
          throw new Error('EduReach account sign-in is not available until the live account service is configured.');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Unable to confirm your EduReach session. Please try signing in again.');
        }

        try {
          await bootstrapAdmin();
        } catch {
          // The account may already be bootstrapped or may not be the designated admin.
        }
        let isAdmin = false;
        try {
          const response = await fetch(apiUrl('/api/admin/session'), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          isAdmin = response.ok;
        } catch {
          // A backend outage must not block a regular student from signing in.
        }
        window.sessionStorage.removeItem('edureach-admin-student-view');
        notifyAuthChanged();
        navigateInApp(isAdmin ? '/admin' : getSafeNextPath());
      }
    } catch (value) {
      setError(userFacingError(value, 'An error occurred during authentication.'));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    await resendVerification();
  }

  const pageTitle = currentMode === 'signin'
    ? 'Welcome back'
    : currentMode === 'signup'
      ? 'Create your account'
      : currentMode === 'verify'
        ? 'Check your email'
        : currentMode === 'reset'
          ? 'Choose a new password'
          : 'Reset your password';
  const allowModeSwitch = currentMode === 'signin' || currentMode === 'signup';
  const authFormComplete = currentMode === 'signup'
    ? Boolean(firstName.trim() && lastName.trim() && email.includes('@') && phone.replace(/\D/g, '').length >= 10 && password.length >= 8 && password === confirmPassword && termsAgreed)
    : currentMode === 'signin'
      ? Boolean(email.includes('@') && password)
      : currentMode === 'reset'
        ? Boolean(password.length >= 8 && password === confirmPassword)
        : currentMode === 'forgot'
          ? email.includes('@')
          : false;

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <a className="auth-brand" href="/" aria-label="EduReach Hub home">
          <BrandLogo height={42} radius="50%" />
          <span><strong>EduReach</strong><small>Student support, all in one place</small></span>
        </a>

        <div className="auth-columns">
          <aside className="auth-intro" aria-label="About EduReach">
            <span className="auth-eyebrow"><BookOpenCheck size={15} /> YOUR NEXT STEP STARTS HERE</span>
            <h2>Make your student journey a little easier.</h2>
            <p>One account for exam practice, education updates, and guided student services.</p>
            <ul className="auth-benefits">
              <li><span><CheckCircle2 size={17} /></span><div><strong>Prepare with purpose</strong><small>Practice for JAMB, WAEC, NECO, and Post-UTME.</small></div></li>
              <li><span><CheckCircle2 size={17} /></span><div><strong>Keep useful details together</strong><small>Save your profile and return to your services.</small></div></li>
              <li><span><CheckCircle2 size={17} /></span><div><strong>Your information stays yours</strong><small>Share only what helps us make your account useful.</small></div></li>
            </ul>
            <div className="auth-privacy-note"><ShieldCheck size={17} /><span>We never ask for your NIN, BVN, or banking password to create an account.</span></div>
          </aside>

          <section className={`auth-card${currentMode === 'signup' ? ' auth-card--signup' : ''}`} aria-labelledby="auth-title">
            {allowModeSwitch && (
              <div className="auth-tabs" role="tablist" aria-label="Account access">
                <button type="button" role="tab" aria-selected={currentMode === 'signin'} onClick={() => changeMode('signin')}>Sign in</button>
                <button type="button" role="tab" aria-selected={currentMode === 'signup'} onClick={() => changeMode('signup')}>Create account</button>
              </div>
            )}

            <header className="auth-card-heading">
              <span className="auth-card-kicker">
                {currentMode === 'signup' ? 'A GOOD PLACE TO BEGIN' : currentMode === 'signin' ? 'YOUR EDUREACH ACCOUNT' : 'ACCOUNT SUPPORT'}
              </span>
              <h1 id="auth-title">{pageTitle}</h1>
              <p>
                {currentMode === 'signup'
                  ? 'Start with the essentials. You can add or update your academic profile later.'
                  : currentMode === 'signin'
                    ? 'Sign in to continue to your saved services and practice.'
                    : currentMode === 'verify'
                      ? 'We sent a verification link to your inbox.'
                      : currentMode === 'reset'
                        ? 'Use a new password you have not used here before.'
                        : 'Enter your email and we will send reset instructions if an account exists.'}
              </p>
            </header>

            {error && <div role="alert" className="auth-alert auth-alert--error"><span aria-hidden="true">!</span>{error}</div>}
            {message && <div className="auth-alert auth-alert--success" role="status"><CheckCircle2 size={17} />{message}</div>}

            {currentMode === 'verify' ? (
              <div className="auth-verification">
                <div className="auth-verification-icon"><Mail size={24} /></div>
                <p>
                  {isSupabaseConfigured
                    ? <>We sent a verification link to <strong>{verifyEmailSent || email}</strong>. Open it to activate your account.</>
                    : 'Email verification needs the live EduReach account service, which is not configured in this environment.'}
                </p>
                <button className="auth-submit auth-submit--secondary" type="button" disabled={busy} onClick={() => void handleResendVerification()}>
                  Resend verification email
                </button>
                <button className="auth-text-button" type="button" onClick={() => changeMode('signin')}>Back to sign in</button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={submit}>
                {currentMode === 'signup' && (
                  <>
                    <fieldset className="auth-account-types">
                      <legend>How will you use EduReach?</legend>
                      <div className="auth-account-options">
                        {accountTypes.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`auth-account-option${accountType === option.value ? ' is-selected' : ''}`}
                            aria-pressed={accountType === option.value}
                            onClick={() => setAccountType(option.value)}
                          >
                            <span className="auth-account-icon"><UserRound size={17} /></span>
                            <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <div className="auth-field-grid">
                      <div className="auth-field">
                        <label htmlFor="auth-first-name">First name</label>
                        <input id="auth-first-name" name="given-name" type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" maxLength={80} required />
                      </div>
                      <div className="auth-field">
                        <label htmlFor="auth-last-name">Last name</label>
                        <input id="auth-last-name" name="family-name" type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" maxLength={80} required />
                      </div>
                    </div>

                    <div className="auth-field">
                      <label htmlFor="auth-email">Email address</label>
                      <div className="auth-input-wrap"><Mail size={17} aria-hidden="true" /><input id="auth-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></div>
                      <small>We use this for sign-in and account updates.</small>
                    </div>

                    <div className="auth-field">
                      <label htmlFor="auth-phone">Phone number</label>
                      <div className="auth-input-wrap"><Phone size={17} aria-hidden="true" /><input id="auth-phone" name="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" maxLength={20} placeholder="+234 801 234 5678" required /></div>
                      <small>Include your country code if you are outside Nigeria.</small>
                    </div>

                    {accountType === 'student' && (
                      <fieldset className="auth-student-details">
                        <legend><GraduationCap size={17} /> Personalise your student account <span>Optional</span></legend>
                        <p>You can skip these now and complete your profile later.</p>
                        <div className="auth-field">
                          <label htmlFor="auth-school">School or institution</label>
                          <input id="auth-school" name="school" type="text" list="auth-school-options" value={school} onChange={(event) => setSchool(event.target.value)} autoComplete="organization" maxLength={120} placeholder="Start typing your school" />
                          <datalist id="auth-school-options">{commonInstitutions.map((item) => <option key={item} value={item} />)}</datalist>
                        </div>
                        <div className="auth-field-grid">
                          <div className="auth-field">
                            <label htmlFor="auth-level">Current level</label>
                            <select id="auth-level" name="level" value={level} onChange={(event) => setLevel(event.target.value)}>
                              <option value="">Choose if applicable</option>
                              {levels.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                          </div>
                          <div className="auth-field">
                            <label htmlFor="auth-course">Course or programme</label>
                            <input id="auth-course" name="course_programme" type="text" list="auth-course-options" value={courseProgramme} onChange={(event) => setCourseProgramme(event.target.value)} maxLength={120} placeholder="Optional" />
                            <datalist id="auth-course-options">{courseProgrammes.filter((item) => item !== 'Other programme').map((item) => <option key={item} value={item} />)}</datalist>
                          </div>
                        </div>
                      </fieldset>
                    )}
                  </>
                )}

                {(currentMode === 'signin' || currentMode === 'forgot') && (
                  <div className="auth-field">
                    <label htmlFor="auth-email">{currentMode === 'signin' ? 'Email address' : 'Account email'}</label>
                    <div className="auth-input-wrap"><Mail size={17} aria-hidden="true" /><input id="auth-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></div>
                  </div>
                )}

                {currentMode === 'signin' && (
                  <div className="auth-field">
                    <div className="auth-label-row">
                      <label htmlFor="auth-password">Password</label>
                      <button className="auth-text-button" type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>
                    </div>
                    <div className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="auth-password" name="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button className="auth-reveal" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                  </div>
                )}

                {(currentMode === 'signup' || currentMode === 'reset') && (
                  <div className="auth-field-grid">
                    <div className="auth-field">
                      <label htmlFor="auth-password">{currentMode === 'signup' ? 'Create password' : 'New password'}</label>
                      <div className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="auth-password" name={currentMode === 'signup' ? 'new-password' : 'new-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /><button className="auth-reveal" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                      <small>Use at least 8 characters.</small>
                    </div>
                    <div className="auth-field">
                      <label htmlFor="auth-confirm-password">Confirm password</label>
                      <div className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="auth-confirm-password" name="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></div>
                    </div>
                  </div>
                )}

                {currentMode === 'signup' && (
                  <label className="auth-consent">
                    <input type="checkbox" checked={termsAgreed} onChange={(event) => setTermsAgreed(event.target.checked)} required />
                    <span>I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</span>
                  </label>
                )}

                <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy} data-ready={authFormComplete}>
                  {busy ? 'Please wait…' : currentMode === 'signup' ? 'Create my account' : currentMode === 'forgot' ? 'Send reset instructions' : currentMode === 'reset' ? 'Save new password' : 'Sign in'}
                  {!busy && <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </form>
            )}

            {allowModeSwitch && (
              <p className="auth-switch-copy">
                {currentMode === 'signin' ? 'New to EduReach?' : 'Already have an account?'}
                {' '}
                <button className="auth-text-button" type="button" onClick={() => changeMode(currentMode === 'signin' ? 'signup' : 'signin')}>
                  {currentMode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            )}

            {(currentMode === 'forgot' || currentMode === 'reset') && (
              <button className="auth-text-button auth-back-button" type="button" onClick={() => changeMode('signin')}>Back to sign in</button>
            )}
          </section>
        </div>

        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} EduReach Hub</span>
          <span>Secure account access</span>
          <a href="/">Back to home</a>
        </footer>
      </div>
    </main>
  );
}
