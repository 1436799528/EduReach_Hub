import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePhone } from '../src/lib/authProviders';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

test('phone numbers become E.164 without guessing a country for a bare number', () => {
  assert.equal(normalizePhone('0801 234 5678'), '+2348012345678');
  assert.equal(normalizePhone('+234 801 234 5678'), '+2348012345678');
  assert.equal(normalizePhone('2348012345678'), '+2348012345678');
  assert.equal(normalizePhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalizePhone('8012345678'), '', 'a bare national number has no country code and is rejected');
  assert.equal(normalizePhone('not a phone'), '');
});

test('Google and phone are real methods, not labels on a dead button', () => {
  const providers = read('src/lib/authProviders.ts');
  assert.match(providers, /signInWithOAuth/);
  assert.match(providers, /provider: 'google'|provider === 'google'|SocialProvider = 'google'/);
  assert.doesNotMatch(providers, /'apple'/);
  assert.match(providers, /signInWithOtp/);
  assert.match(providers, /verifyOtp/);
  assert.match(providers, /type: 'sms'/);

  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /startSocialSignIn\(provider/);
  assert.doesNotMatch(page, /apple/i);
  assert.match(page, /sendPhoneCode\(/);
  assert.match(page, /verifyPhoneCode\(/);
  assert.match(page, /Continue with \$\{label\}|Sign up with \$\{label\}/);
});

test('parent and teacher registration is closed instead of creating an empty account', () => {
  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /Parent and teacher accounts are not available yet/);
  assert.match(page, /disabled=\{!option\.available\}/);
  assert.match(page, /available: false/, 'the two unavailable roles are declared');
});

test('registration requires an explicit, readable privacy and terms acknowledgement', () => {
  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /I am 16 or older, and I agree to the/);
  assert.match(page, /Terms of Service/);
  assert.match(page, /Privacy Notice/);
  assert.match(page, /if \(!ensureTerms\(\)\) return;/);
  assert.match(page, /termsRef\.current\?\.focus\(\)/, 'the failed gate moves focus to the checkbox');
  assert.doesNotMatch(page, /What we collect to personalise your experience/, 'the long consent explanation is gone');
  assert.doesNotMatch(page, /NIN|BVN/, 'the login hero does not explain what we never ask for');
  assert.doesNotMatch(page, /Back to home/, 'the page keeps one Back control and no second home link');
  assert.match(page, /className="auth-back"/);

  const consentStart = page.indexOf('auth-legal-intro auth-legal-intro--bottom');
  const submitStart = page.indexOf('data-ready={authFormComplete}');
  assert.ok(consentStart > 0 && consentStart < submitStart, 'the age and terms agreement sits directly above the submit button, not at the top');

  const css = read('src/auth-page.css');
  const consent = /\.auth-consent \{[^}]*font-size:\s*([\d.]+)px/.exec(css);
  assert.ok(consent, 'the consent copy has an explicit size');
  assert.ok(Number(consent[1]) >= 12, 'legal copy must stay readable, not be shrunk to discourage reading');
});

test('a social sign-up records consent before redirecting and settles it on return', () => {
  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /markPendingTermsAcceptance\(\)/);
  assert.match(page, /settlePendingTermsAcceptance\(user\.id\)/);
  const consent = read('src/lib/legalConsent.ts');
  assert.match(consent, /PENDING_TERMS_KEY/);
  assert.match(consent, /terms_agreed_at/);
  assert.match(consent, /clearPendingTermsAcceptance\(\)/, 'the marker is removed only after both writes succeed');
  assert.match(consent, /readTermsAcceptance/);
  assert.match(page, /termsGateFor/, 'a new OAuth account without recorded consent is asked before the dashboard');
});

test('email verification is temporarily off but its eight-digit path is preserved for re-enable', () => {
  const page = read('pages/AuthPageV2.tsx');
  const flag = read('src/lib/emailVerification.ts');
  assert.match(flag, /VITE_EMAIL_VERIFICATION_ENABLED === 'true'/);
  assert.match(flag, /mailer_autoconfirm/, 'the switch documents the hosted Supabase setting');
  assert.equal(flag.includes('= true'), false, 'email verification stays off by default for testers');
  assert.match(page, /EMAIL_VERIFICATION_ENABLED/);
  assert.match(page, /mode === 'verify' && !EMAIL_VERIFICATION_ENABLED \? 'signin' : mode/, 'old /verify-email links open sign-in while the switch is off');
  assert.match(page, /if \(EMAIL_VERIFICATION_ENABLED\)/, 'the original verification branch is reachable only after re-enable');
  assert.match(page, /Your account was created, but automatic sign-in failed/, 'new accounts are signed in immediately');
  assert.match(page, /verifyOtp\(\{ email: target, token, type: 'signup' \}\)/);
  assert.match(page, /<OtpInput[^>]*id="auth-email-code"[^>]*length=\{8\}/, 'email verification matches mailer_otp_length = 8');
  assert.match(page, /<OtpInput[^>]*id="auth-otp"/, 'phone verification uses the shared code field');
  assert.doesNotMatch(page, /6-digit code/, 'the copy no longer promises a six-digit code the hosted project does not send');
  assert.match(page, /verification email/i, 'the verification infrastructure remains in the source');
  assert.match(read('.env.example'), /VITE_EMAIL_VERIFICATION_ENABLED=false/);
});

test('the return bar keeps Back and nothing else', () => {
  const page = read('src/components/PageBar.tsx');
  assert.match(page, />Back</);
  assert.doesNotMatch(page, /er-pagebar-home|<Home\b|>Home</);
});

test('the welcome heading is centred and follows the logo palette', () => {
  const css = read('src/auth-page.css');
  assert.match(css, /\.auth-card-heading\{[^}]*text-align:center/);
  assert.match(css, /--auth-brand:var\(--er-primary/);
  assert.match(css, /--auth-blue-ink/);
});

test('a fresh email signup is not hijacked by an existing session or admin checks', () => {
  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /if \(currentMode === 'signup'\) return;/, 'a deliberate /register visit stays available while signed in');
  assert.match(page, /\[isAuthenticated, isLoading, user\?\.id, currentMode\]/, 'the return effect follows mode changes');
  assert.match(page, /mode === 'verify' && !EMAIL_VERIFICATION_ENABLED \? 'signin' : mode/, 'direct verification links still open sign-in while verification is off');
  assert.match(page, /await bootstrapAdmin\(\);/, 'sign-in admin bootstrap is preserved');
  assert.match(page, /isAdmin \? '\/admin' : getSafeNextPath\(\)/, 'staff sign-in routing is preserved');

  const submitStart = page.indexOf('async function submit(');
  const signupStart = page.indexOf("if (currentMode === 'signup') {", submitStart);
  const signinStart = page.indexOf("if (currentMode === 'signin') {", signupStart);
  assert.ok(submitStart > 0 && signupStart > submitStart && signinStart > signupStart, 'signup and sign-in branches are separate');
  const signupBlock = page.slice(signupStart, signinStart);
  assert.match(signupBlock, /supabase\.auth\.signUp\(/, 'new emails are created by Supabase Auth');
  assert.match(signupBlock, /signInWithPassword\(/, 'a new email without an immediate session is signed in');
  assert.match(signupBlock, /navigateInApp\(getSafeNextPath\(\)\)/, 'the new user reaches the app');
  assert.match(signupBlock, /if \(EMAIL_VERIFICATION_ENABLED\)/, 'the verification branch remains behind the off-by-default switch');
  assert.doesNotMatch(signupBlock, /bootstrapAdmin|admin\/session/, 'signup does not probe or bootstrap admin access');

  const flag = read('src/lib/emailVerification.ts');
  assert.match(flag, /VITE_EMAIL_VERIFICATION_ENABLED === 'true'/);
  assert.equal(flag.includes('= true'), false, 'verification stays off unless explicitly re-enabled');
  assert.match(read('.env.example'), /VITE_EMAIL_VERIFICATION_ENABLED=false/);
  assert.match(read('.env.production.example'), /VITE_EMAIL_VERIFICATION_ENABLED=false/);
});

test('student dashboards do not call the staff-gated session endpoint', () => {
  const dashboard = read('pages/StudentDashboardV2.tsx');
  assert.match(dashboard, /import \{ isStaffRole, resolveAppRole \} from '\.\.\/src\/lib\/capabilities';/);
  assert.match(dashboard, /const profileIsStaff = isStaffRole\(resolveAppRole\(profileRole\)\);/);
  assert.match(dashboard, /setIsAdminUser\(adminSession \|\| profileIsStaff\)/);

  const gate = dashboard.indexOf('if (profileIsStaff) {');
  const probe = dashboard.indexOf("fetch(apiUrl('/api/admin/session')", gate);
  const afterProbe = dashboard.indexOf('setIsLocalMode(false);', probe);
  assert.ok(gate > 0 && probe > gate && afterProbe > probe, 'the admin-session request is inside the staff-only branch');
});
