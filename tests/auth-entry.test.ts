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

test('Google, Apple and phone are real methods, not labels on a dead button', () => {
  const providers = read('src/lib/authProviders.ts');
  assert.match(providers, /signInWithOAuth/);
  assert.match(providers, /provider: 'google'|provider === 'google'|SocialProvider = 'google'/);
  assert.match(providers, /'apple'/);
  assert.match(providers, /signInWithOtp/);
  assert.match(providers, /verifyOtp/);
  assert.match(providers, /type: 'sms'/);

  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /startSocialSignIn\(provider/);
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

test('email registration offers a 6-digit code just like phone registration', () => {
  const page = read('pages/AuthPageV2.tsx');
  assert.match(page, /verifyOtp\(\{ email: target, token, type: 'signup' \}\)/);
  assert.match(page, /autoComplete="one-time-code"/);
  assert.match(page, /6-digit code/);
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
