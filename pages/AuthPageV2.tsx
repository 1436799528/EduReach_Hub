import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Chrome,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';
import { userFacingError } from '../lib/errors';
import { commonInstitutions, courseProgrammes, levels } from '../src/data/studentOptions';
import { bootstrapAdmin } from '../src/lib/api';
import { apiUrl } from '../src/lib/apiBase';
import { notifyAuthChanged, useAuth } from '../src/lib/auth';
import {
  isValidPhone,
  normalizePhone,
  sendPhoneCode,
  startSocialSignIn,
  verifyPhoneCode,
  type SocialProvider,
} from '../src/lib/authProviders';
import { markPendingTermsAcceptance, readTermsAcceptance, settlePendingTermsAcceptance } from '../src/lib/legalConsent';
import { navigateInApp } from '../src/lib/navigation';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { InlineNotice } from '../src/components/AsyncState';
import BrandLogo from '../src/components/BrandLogo';
import FormFieldError from '../src/components/FormFieldError';
import OtpInput from '../src/components/OtpInput';
import PasswordStrengthMeter from '../src/components/PasswordStrengthMeter';
import SiteFooter from '../src/components/SiteFooter';
import { TabBar } from '../src/components/ui/Tabs';
import '../src/auth-page.css';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';
type ContactMethod = 'email' | 'phone';

const accountTypes = [
  { value: 'student', label: 'Student', detail: 'I am studying or preparing for an exam', available: true },
  { value: 'parent', label: 'Parent or guardian', detail: 'I support a student', available: false },
  { value: 'teacher', label: 'Teacher or educator', detail: 'I support learners', available: false },
] as const;

const socialIcons: Record<SocialProvider, typeof Chrome> = { google: Chrome };

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

function goBack() {
  let sameOriginReferrer = false;
  try {
    sameOriginReferrer = Boolean(document.referrer && new URL(document.referrer).origin === window.location.origin);
  } catch {
    // An unparseable referrer means "not same-origin"; keep the default.
  }

  let appHistory = false;
  try {
    appHistory = window.sessionStorage.getItem('edureach-app-history') === '1';
  } catch {
    // Storage can be blocked; keep the default.
  }

  if ((sameOriginReferrer || appHistory) && window.history.length > 1) window.history.back();
  else navigateInApp('/');
}

export default function AuthPageV2({ mode = 'signin' }: { mode?: Mode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');
  const [accountType, setAccountType] = useState<'student' | 'parent' | 'teacher'>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [school, setSchool] = useState('');
  const [courseProgramme, setCourseProgramme] = useState('');
  const [level, setLevel] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [phoneStage, setPhoneStage] = useState<'idle' | 'sent'>('idle');
  const [phoneSentTo, setPhoneSentTo] = useState('');
  const [otp, setOtp] = useState('');
  const [termsGateFor, setTermsGateFor] = useState('');
  const requestInFlight = useRef(false);
  const settlingReturn = useRef(false);
  const termsRef = useRef<HTMLInputElement>(null);

  const modePaths: Record<Mode, string> = {
    signin: '/login',
    signup: '/register',
    forgot: '/forgot-password',
    reset: '/reset-password',
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

  // An OAuth return lands here with a session but without the checkbox state.
  // Settle any consent recorded before the redirect, then continue. A normal
  // email/phone sign-in also ends here because both set the auth event first.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    // A deliberate visit to /register is not an auth return. Without this guard
    // an existing session redirects to the dashboard before a new email can be
    // submitted, and the dashboard's staff probe then looks like an admin check
    // during signup. The signup form already records terms and navigates when
    // the new account is ready.
    if (currentMode === 'signup') return;
    if (settlingReturn.current) return;
    settlingReturn.current = true;
    let active = true;
    void (async () => {
      const settled = await settlePendingTermsAcceptance(user.id);
      // A new OAuth account can arrive through the Sign in tab, where there was
      // no checkbox to tick. Ask before the dashboard rather than assuming.
      const accepted = settled ? true : await readTermsAcceptance(user.id);
      if (!active) return;
      if (accepted === false) {
        setTermsGateFor(user.id);
        return;
      }
      navigateInApp(getSafeNextPath());
    })().finally(() => { settlingReturn.current = false; });
    return () => { active = false; };
  }, [isAuthenticated, isLoading, user?.id, currentMode]);

  function changeMode(next: Mode) {
    setCurrentMode(next);
    setMessage('');
    setError('');
    setFieldErrors({});
    setPhoneStage('idle');
    setPhoneSentTo('');
    setOtp('');
  }

  function changeContactMethod(next: ContactMethod) {
    setContactMethod(next);
    setPhoneStage('idle');
    setPhoneSentTo('');
    setOtp('');
    setError('');
    setFieldErrors({});
    setMessage('');
  }

  function ensureTerms() {
    if (termsAgreed) return true;
    setError('Please confirm that you have read the Terms of Service and the Privacy Notice before creating an account.');
    termsRef.current?.focus();
    return false;
  }

  function signupMetadata(phoneValue = '') {
    return {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      phone: phoneValue || (isValidPhone(phone) ? normalizePhone(phone) : null),
      account_type: 'student',
      terms_agreed: true,
      ...(school.trim() ? { school: school.trim() } : {}),
      ...(courseProgramme.trim() ? { course_programme: courseProgramme.trim() } : {}),
      ...(level ? { level } : {}),
    };
  }

  async function startSocial(provider: SocialProvider) {
    if (currentMode === 'signup' && !ensureTerms()) return;
    setError('');
    setMessage('');
    setSocialBusy(provider);

    if (currentMode === 'signup' && !markPendingTermsAcceptance()) {
      setSocialBusy(null);
      setError('Your consent could not be recorded because browser storage is unavailable. Use email or phone sign-up instead.');
      return;
    }

    try {
      await startSocialSignIn(provider, getSafeNextPath());
    } catch (value) {
      setSocialBusy(null);
      setError(userFacingError(value, 'Social sign-in could not start. Use email or phone instead.'));
    }
  }

  async function handlePhoneStep() {
    if (requestInFlight.current) return;
    setError('');
    setMessage('');
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (currentMode === 'signup') {
      if (!firstName.trim()) errors.firstName = 'First name is required.';
      if (!lastName.trim()) errors.lastName = 'Last name is required.';
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      if (!ensureTerms()) return;
    }
    if (!isValidPhone(phone)) {
      setFieldErrors({ phone: 'Enter a valid phone number with country code, e.g. +234 801 234 5678.' });
      return;
    }

    requestInFlight.current = true;
    setPhoneBusy(true);
    try {
      if (phoneStage === 'idle') {
        const normalized = await sendPhoneCode(
          phone,
          currentMode === 'signup' ? 'signup' : 'signin',
          currentMode === 'signup' ? signupMetadata(normalizePhone(phone)) : undefined,
        );
        setPhoneSentTo(normalized);
        setPhoneStage('sent');
        setMessage(`We sent a code to ${normalized}. It expires in a few minutes.`);
        return;
      }

      const verified = await verifyPhoneCode(phone, otp);
      if (!verified.session) throw new Error('That code was accepted but no session was created. Request a new code.');

      if (currentMode === 'signup') {
        // The trigger normally receives this metadata at account creation;
        // repeating it here covers providers that create the user on verify.
        await supabase.auth.updateUser({ data: signupMetadata(normalizePhone(phone)) });
      }

      notifyAuthChanged();
      navigateInApp(getSafeNextPath());
    } catch (value) {
      setError(userFacingError(value, 'The code could not be verified. Try again.'));
    } finally {
      requestInFlight.current = false;
      setPhoneBusy(false);
    }
  }

  async function acceptReturningTerms() {
    if (!termsGateFor) return;
    if (!ensureTerms()) return;
    if (!markPendingTermsAcceptance()) {
      setError('Your consent could not be recorded because browser storage is unavailable. Enable browser storage and try again.');
      return;
    }
    setBusy(true);
    setError('');
    const settled = await settlePendingTermsAcceptance(termsGateFor);
    setBusy(false);
    if (!settled) {
      setError('We could not record your acceptance just now. Try again before continuing.');
      return;
    }
    setTermsGateFor('');
    navigateInApp(getSafeNextPath());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;

    if ((currentMode === 'signin' || currentMode === 'signup') && contactMethod === 'phone') {
      await handlePhoneStep();
      return;
    }

    requestInFlight.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    setFieldErrors({});

    try {
      if (currentMode === 'forgot') {
        const target = email.trim();
        if (!target || !target.includes('@')) {
          setFieldErrors({ email: 'Please enter a valid email address.' });
          return;
        }
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
        const errors: Record<string, string> = {};
        if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
        if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          return;
        }
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
        const errors: Record<string, string> = {};
        if (!firstName.trim()) errors.firstName = 'First name is required.';
        if (!lastName.trim()) errors.lastName = 'Last name is required.';
        if (!email.trim() || !email.includes('@')) errors.email = 'A valid email address is required.';
        if (phone.trim() && !isValidPhone(phone)) {
          errors.phone = 'Enter a valid phone number with country code, or leave blank.';
        }
        if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
        if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          return;
        }
        if (!ensureTerms()) return;
        if (!isSupabaseConfigured) {
          throw new Error('EduReach account registration is not available until the live account service is configured.');
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: signupMetadata() },
        });
        if (signUpError) throw signUpError;

        if (signUpData.session?.user) {
          notifyAuthChanged();
          navigateInApp(getSafeNextPath());
          return;
        }
        // Email confirmation is disabled. Supabase auto-confirms new email
        // accounts, so finish sign-up by signing the user in immediately.
        const { error: autoSignInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (autoSignInError) throw new Error('Your account was created, but automatic sign-in failed. Please sign in to continue.');
        notifyAuthChanged();
        navigateInApp(getSafeNextPath());
        return;
      }

      if (currentMode === 'signin') {
        const errors: Record<string, string> = {};
        if (!email.trim() || !email.includes('@')) errors.email = 'Email address is required.';
        if (!password) errors.password = 'Password is required.';
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          return;
        }
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

  const pageTitle = currentMode === 'signin'
    ? 'Welcome back'
    : currentMode === 'signup'
      ? 'Create your account'
      : currentMode === 'reset'
          ? 'Choose a new password'
          : 'Reset your password';
  const allowModeSwitch = currentMode === 'signin' || currentMode === 'signup';
  const phoneMethod = contactMethod === 'phone';
  const signupEmailReady = Boolean(firstName.trim() && lastName.trim() && email.includes('@') && password.length >= 8 && password === confirmPassword && termsAgreed);
  const signupPhoneReady = Boolean(firstName.trim() && lastName.trim() && isValidPhone(phone) && termsAgreed && (phoneStage === 'idle' || otp.replace(/\D/g, '').length >= 4));
  const signinEmailReady = Boolean(email.includes('@') && password);
  const signinPhoneReady = Boolean(isValidPhone(phone) && (phoneStage === 'idle' || otp.replace(/\D/g, '').length >= 4));
  const authFormComplete = currentMode === 'signup'
    ? phoneMethod ? signupPhoneReady : signupEmailReady
    : currentMode === 'signin'
      ? phoneMethod ? signinPhoneReady : signinEmailReady
      : currentMode === 'reset'
        ? Boolean(password.length >= 8 && password === confirmPassword)
        : currentMode === 'forgot'
          ? email.includes('@')
          : false;
  const submitLabel = phoneMethod && allowModeSwitch
    ? phoneStage === 'sent' ? 'Verify code' : 'Send code'
    : currentMode === 'signup'
      ? 'Create my account'
      : currentMode === 'forgot'
        ? 'Send reset instructions'
        : currentMode === 'reset'
          ? 'Save new password'
          : 'Sign in';

  return (
    <div className="auth-shell">
      <main className="auth-page">
        <div className="auth-frame">
          <div className="auth-topbar">
            <button type="button" className="auth-back" onClick={goBack}>
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>

          <div className="auth-brand">
            <BrandLogo height={42} radius="50%" />
            <span><strong>EduReach</strong><small>Student support, all in one place</small></span>
          </div>

          <div className="auth-columns">
            <section className={`auth-card${currentMode === 'signup' ? ' auth-card--signup' : ''}`} aria-labelledby="auth-title">
              {allowModeSwitch && (
                <TabBar
                  className="auth-tabs-bar"
                  label="Account access"
                  idPrefix="auth-mode"
                  variant="segmented"
                  value={currentMode === 'signup' ? 'signup' : 'signin'}
                  onChange={(id) => changeMode(id as Mode)}
                  items={[
                    { id: 'signin', label: 'Sign in' },
                    { id: 'signup', label: 'Create account' },
                  ]}
                />
              )}

              <header className="auth-card-heading">
                <h1 id="auth-title">{pageTitle}</h1>
                {currentMode === 'signup' ? (
                  EMAIL_VERIFICATION_ENABLED ? null : (
                    <p>Test accounts are ready immediately; email confirmation is temporarily off.</p>
                  )
                ) : (
                  <p>
                    {currentMode === 'signin'
                      ? 'Sign in to continue to your saved services and practice.'
                      : currentMode === 'verify'
                        ? 'Open the link in your email, or enter its code.'
                        : currentMode === 'reset'
                          ? 'Use a new password you have not used here before.'
                          : 'Enter your email and we will send reset instructions if an account exists.'}
                  </p>
                )}
              </header>

              {error && <InlineNotice tone="danger">{error}</InlineNotice>}
              {message && <div className="auth-alert auth-alert--success" role="status"><CheckCircle2 size={17} />{message}</div>}

              {termsGateFor ? (
                <div className="auth-consent-gate">
                  <p>Confirm your age and agreement before we open your dashboard.</p>
                  <label className="auth-consent">
                    <input ref={termsRef} type="checkbox" checked={termsAgreed} onChange={(event) => setTermsAgreed(event.target.checked)} required />
                    <span>
                      I am 16 or older, and I agree to the <a className="auth-legal-link" href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a className="auth-legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.
                    </span>
                  </label>
                  <button className="auth-submit" type="button" disabled={busy} aria-busy={busy} onClick={() => void acceptReturningTerms()}>
                    {busy ? 'Recording…' : 'Agree and continue'}
                  </button>
                </div>
              ) : (
                <form className="auth-form" onSubmit={submit}>
                  {allowModeSwitch && (
                    <div className="auth-social">
                      {(['google'] as const).map((provider) => {
                        const Icon = socialIcons[provider];
                        const label = 'Google';
                        return (
                          <button
                            key={provider}
                            type="button"
                            className={`auth-social-btn auth-social-btn--${provider}`}
                            disabled={Boolean(socialBusy) || busy || phoneBusy}
                            aria-busy={socialBusy === provider}
                            onClick={() => void startSocial(provider)}
                          >
                            <Icon size={17} aria-hidden="true" />
                            {socialBusy === provider ? `Opening ${label}…` : currentMode === 'signup' ? `Sign up with ${label}` : `Continue with ${label}`}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {allowModeSwitch && (
                    <>
                      <div className="auth-divider"><span>or use email or phone</span></div>
                      <TabBar
                        className="auth-method-tabs-bar"
                        label="Contact method"
                        idPrefix="auth-contact"
                        variant="segmented"
                        value={contactMethod}
                        onChange={(id) => changeContactMethod(id as ContactMethod)}
                        items={[
                          { id: 'email', label: <><Mail size={15} aria-hidden="true" /> Email</> },
                          { id: 'phone', label: <><Phone size={15} aria-hidden="true" /> Phone</> },
                        ]}
                      />
                    </>
                  )}

                  {currentMode === 'signup' && (
                    <fieldset className="auth-account-types">
                      <legend>How will you use EduReach?</legend>
                      <div className="auth-account-options">
                        {accountTypes.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`auth-account-option${option.value === accountType ? ' is-selected' : ''}${option.available ? '' : ' is-coming-soon'}`}
                            aria-pressed={option.value === accountType}
                            aria-describedby={option.available ? undefined : 'auth-coming-soon'}
                            disabled={!option.available}
                            onClick={() => { if (option.available) setAccountType(option.value); }}
                          >
                            <span className="auth-account-icon"><UserRound size={17} /></span>
                            <span>
                              <strong>{option.label}</strong>
                              <small>{option.available ? option.detail : 'Not open yet'}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="auth-account-note" id="auth-coming-soon">
                        Parent and teacher accounts are not available yet.
                      </p>
                    </fieldset>
                  )}

                  {currentMode === 'signup' && (
                    <div className="auth-field-grid">
                      <div className="auth-field">
                        <label htmlFor="auth-first-name">First name</label>
                        <input
                          id="auth-first-name"
                          name="given-name"
                          type="text"
                          value={firstName}
                          onChange={(event) => {
                            setFirstName(event.target.value);
                            if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: '' }));
                          }}
                          autoComplete="given-name"
                          maxLength={80}
                          aria-invalid={Boolean(fieldErrors.firstName)}
                          aria-describedby={fieldErrors.firstName ? 'auth-first-name-error' : undefined}
                          required
                        />
                        <FormFieldError id="auth-first-name-error" error={fieldErrors.firstName} />
                      </div>
                      <div className="auth-field">
                        <label htmlFor="auth-last-name">Last name</label>
                        <input
                          id="auth-last-name"
                          name="family-name"
                          type="text"
                          value={lastName}
                          onChange={(event) => {
                            setLastName(event.target.value);
                            if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: '' }));
                          }}
                          autoComplete="family-name"
                          maxLength={80}
                          aria-invalid={Boolean(fieldErrors.lastName)}
                          aria-describedby={fieldErrors.lastName ? 'auth-last-name-error' : undefined}
                          required
                        />
                        <FormFieldError id="auth-last-name-error" error={fieldErrors.lastName} />
                      </div>
                    </div>
                  )}

                  {phoneMethod && allowModeSwitch ? (
                    <>
                      <div className="auth-field">
                        <label htmlFor="auth-phone">{currentMode === 'signup' ? 'Phone number' : 'Phone number for sign-in'}</label>
                        <div className="auth-input-wrap"><Phone size={17} aria-hidden="true" />
                          <input
                            id="auth-phone"
                            name="tel"
                            type="tel"
                            value={phone}
                            onChange={(event) => {
                              setPhone(event.target.value);
                              if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
                              if (phoneStage === 'sent') {
                                setPhoneStage('idle');
                                setPhoneSentTo('');
                                setOtp('');
                              }
                            }}
                            autoComplete="tel"
                            inputMode="tel"
                            maxLength={20}
                            placeholder="+234 801 234 5678"
                            aria-invalid={Boolean(fieldErrors.phone)}
                            aria-describedby={fieldErrors.phone ? 'auth-phone-error' : undefined}
                            required
                          />
                        </div>
                        <FormFieldError id="auth-phone-error" error={fieldErrors.phone} />
                        <small>Include the country code. Nigerian numbers starting with 0 are converted automatically.</small>
                      </div>

                      {phoneStage === 'sent' && (
                        <div className="auth-field">
                          <OtpInput id="auth-otp" label={`Code sent to ${phoneSentTo}`} value={otp} onChange={setOtp} />
                          <small>Enter the code from the text message. <button className="auth-text-button auth-inline-button" type="button" onClick={() => { setPhoneStage('idle'); setOtp(''); setPhoneSentTo(''); }}>Use a different number</button></small>
                        </div>
                      )}
                      {currentMode === 'signup' && (
                        <p className="auth-phone-note">A phone account has no password. You can sign in with a code each time and add academic details after you arrive.</p>
                      )}
                    </>
                  ) : (
                    <>
                      {(currentMode === 'signup' || currentMode === 'signin' || currentMode === 'forgot') && (
                        <div className="auth-field">
                          <label htmlFor="auth-email">{currentMode === 'forgot' ? 'Account email' : 'Email address'}</label>
                          <div className="auth-input-wrap">
                            <Mail size={17} aria-hidden="true" />
                            <input
                              id="auth-email"
                              name="email"
                              type="email"
                              value={email}
                              onChange={(event) => {
                                setEmail(event.target.value);
                                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                              }}
                              autoComplete="email"
                              maxLength={254}
                              aria-invalid={Boolean(fieldErrors.email)}
                              aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                              required
                            />
                          </div>
                          <FormFieldError id="auth-email-error" error={fieldErrors.email} />
                          {currentMode === 'signup' && <small>We use this for sign-in and account updates.</small>}
                        </div>
                      )}

                      {currentMode === 'signup' && (
                        <div className="auth-field">
                          <label htmlFor="auth-phone">Phone number <span className="auth-optional">Optional</span></label>
                          <div className="auth-input-wrap">
                            <Phone size={17} aria-hidden="true" />
                            <input
                              id="auth-phone"
                              name="tel"
                              type="tel"
                              value={phone}
                              onChange={(event) => {
                                setPhone(event.target.value);
                                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
                              }}
                              autoComplete="tel"
                              inputMode="tel"
                              maxLength={20}
                              placeholder="+234 801 234 5678"
                              aria-invalid={Boolean(fieldErrors.phone)}
                              aria-describedby={fieldErrors.phone ? 'auth-phone-signup-error' : undefined}
                            />
                          </div>
                          <FormFieldError id="auth-phone-signup-error" error={fieldErrors.phone} />
                          <small>For account recovery and optional SMS alerts. You can add it later.</small>
                        </div>
                      )}

                      {currentMode === 'signin' && (
                        <div className="auth-field">
                          <div className="auth-label-row">
                            <label htmlFor="auth-password">Password</label>
                            <button className="auth-text-button" type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>
                          </div>
                          <div className="auth-input-wrap">
                            <LockKeyhole size={17} aria-hidden="true" />
                            <input
                              id="auth-password"
                              name="current-password"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(event) => {
                                setPassword(event.target.value);
                                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                              }}
                              autoComplete="current-password"
                              aria-invalid={Boolean(fieldErrors.password)}
                              aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                              required
                            />
                            <button className="auth-reveal" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                          </div>
                          <FormFieldError id="auth-password-error" error={fieldErrors.password} />
                        </div>
                      )}

                      {(currentMode === 'signup' || currentMode === 'reset') && (
                        <div className="auth-field-grid">
                          <div className="auth-field">
                            <label htmlFor="auth-password">{currentMode === 'signup' ? 'Create password' : 'New password'}</label>
                            <div className="auth-input-wrap">
                              <LockKeyhole size={17} aria-hidden="true" />
                              <input
                                id="auth-password"
                                name="new-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(event) => {
                                  setPassword(event.target.value);
                                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                                }}
                                autoComplete="new-password"
                                minLength={8}
                                aria-invalid={Boolean(fieldErrors.password)}
                                aria-describedby={fieldErrors.password ? 'auth-new-password-error' : undefined}
                                required
                              />
                              <button className="auth-reveal" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                            </div>
                            <FormFieldError id="auth-new-password-error" error={fieldErrors.password} />
                          </div>
                          <div className="auth-field">
                            <label htmlFor="auth-confirm-password">Confirm password</label>
                            <div className="auth-input-wrap">
                              <LockKeyhole size={17} aria-hidden="true" />
                              <input
                                id="auth-confirm-password"
                                name="confirm-password"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(event) => {
                                  setConfirmPassword(event.target.value);
                                  if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                                }}
                                autoComplete="new-password"
                                minLength={8}
                                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                                aria-describedby={fieldErrors.confirmPassword ? 'auth-confirm-password-error' : undefined}
                                required
                              />
                            </div>
                            <FormFieldError id="auth-confirm-password-error" error={fieldErrors.confirmPassword} />
                          </div>
                        </div>
                      )}
                      {(currentMode === 'signup' || currentMode === 'reset') && (
                        <PasswordStrengthMeter value={password} confirm={confirmPassword} />
                      )}
                    </>
                  )}

                  {currentMode === 'signup' && !phoneMethod && (
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

                  {currentMode === 'signup' && (
                    <div className="auth-legal-intro auth-legal-intro--bottom">
                      <label className="auth-consent">
                        <input
                          ref={termsRef}
                          type="checkbox"
                          checked={termsAgreed}
                          onChange={(event) => setTermsAgreed(event.target.checked)}
                          required
                        />
                        <span>
                          I am 16 or older, and I agree to the <a className="auth-legal-link" href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a className="auth-legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.
                        </span>
                      </label>
                    </div>
                  )}

                  <button className="auth-submit" type="submit" disabled={busy || phoneBusy} aria-busy={busy || phoneBusy} data-ready={authFormComplete}>
                    {(busy || phoneBusy) ? 'Please wait…' : submitLabel}
                    {!(busy || phoneBusy) && <ArrowRight size={17} aria-hidden="true" />}
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
