import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

function read(relPath: string): string {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), 'utf8');
}

test('AuthPageV2 renders field-level errors directly beneath inputs with aria attributes', () => {
  const page = read('pages/AuthPageV2.tsx');

  // FormFieldError imported and rendered
  assert.match(page, /import FormFieldError from '\.\.\/src\/components\/FormFieldError'/);
  assert.match(page, /<FormFieldError id="auth-email-error" error=\{fieldErrors\.email\} \/>/);
  assert.match(page, /<FormFieldError id="auth-password-error" error=\{fieldErrors\.password\} \/>/);
  assert.match(page, /<FormFieldError id="auth-first-name-error" error=\{fieldErrors\.firstName\} \/>/);
  assert.match(page, /<FormFieldError id="auth-last-name-error" error=\{fieldErrors\.lastName\} \/>/);
  assert.match(page, /<FormFieldError id="auth-phone-error" error=\{fieldErrors\.phone\} \/>/);
  assert.match(page, /<FormFieldError id="auth-new-password-error" error=\{fieldErrors\.password\} \/>/);
  assert.match(page, /<FormFieldError id="auth-confirm-password-error" error=\{fieldErrors\.confirmPassword\} \/>/);

  // aria-invalid and aria-describedby associations
  assert.match(page, /aria-invalid=\{Boolean\(fieldErrors\.email\)\}/);
  assert.match(page, /aria-describedby=\{fieldErrors\.email \? 'auth-email-error' : undefined\}/);
  assert.match(page, /aria-invalid=\{Boolean\(fieldErrors\.password\)\}/);
  assert.match(page, /aria-describedby=\{fieldErrors\.password \? 'auth-password-error' : undefined\}/);
});

test('ServiceApplyPage renders field-level errors directly beneath inputs', () => {
  const page = read('pages/ServiceApplyPage.tsx');

  assert.match(page, /import FormFieldError from '\.\.\/src\/components\/FormFieldError'/);
  assert.match(page, /<FormFieldError id="service-apply-fullname-error"/);
  assert.match(page, /<FormFieldError id="service-apply-phone-error"/);
  assert.match(page, /<FormFieldError id="service-apply-whatsapp-error"/);
  assert.match(page, /<FormFieldError id="service-apply-institution-error"/);
  assert.match(page, /aria-describedby=\{errorField === 'fullName' \? 'service-apply-error' : undefined\}/);
});

test('ProfileCompletionPage renders field-level errors directly beneath inputs', () => {
  const page = read('pages/ProfileCompletionPage.tsx');

  assert.match(page, /import FormFieldError from '\.\.\/src\/components\/FormFieldError'/);
  assert.match(page, /<FormFieldError id="profile-school-error" error=\{fieldErrors\.school\} \/>/);
  assert.match(page, /<FormFieldError id="profile-course-error" error=\{fieldErrors\.courseProgramme\} \/>/);
  assert.match(page, /<FormFieldError id="profile-dept-error" error=\{fieldErrors\.department\} \/>/);
  assert.match(page, /<FormFieldError id="profile-faculty-error" error=\{fieldErrors\.faculty\} \/>/);
  assert.match(page, /<FormFieldError id="profile-level-error" error=\{fieldErrors\.level\} \/>/);
  assert.match(page, /<FormFieldError id="profile-session-error" error=\{fieldErrors\.session\} \/>/);
  assert.match(page, /<FormFieldError id="profile-admission-year-error" error=\{fieldErrors\.admissionYear\} \/>/);
  assert.match(page, /<FormFieldError id="profile-grad-year-error" error=\{fieldErrors\.expectedGradYear\} \/>/);
  assert.match(page, /<FormFieldError id="profile-phone-error" error=\{fieldErrors\.phone\} \/>/);
});

test('SecurityModal renders field-level errors directly beneath password inputs', () => {
  const modal = read('src/components/dashboard/SecurityModal.tsx');

  assert.match(modal, /import FormFieldError from '\.\.\/FormFieldError'/);
  assert.match(modal, /<FormFieldError id="security-new-password-error" error=\{passwordErrors\.newPassword\} \/>/);
  assert.match(modal, /<FormFieldError id="security-confirm-password-error" error=\{passwordErrors\.confirmNewPassword\} \/>/);
  assert.match(modal, /aria-invalid=\{Boolean\(passwordErrors\.newPassword\)\}/);
  assert.match(modal, /aria-describedby=\{passwordErrors\.newPassword \? 'security-new-password-error' : undefined\}/);
  assert.match(modal, /aria-invalid=\{Boolean\(passwordErrors\.confirmNewPassword\)\}/);
  assert.match(modal, /aria-describedby=\{passwordErrors\.confirmNewPassword \? 'security-confirm-password-error' : undefined\}/);
});

test('Apple login has been completely removed from client pages and providers', () => {
  const authPage = read('pages/AuthPageV2.tsx');
  assert.doesNotMatch(authPage, /'apple'/i);
  assert.doesNotMatch(authPage, /Continue with Apple|Sign up with Apple/i);
  assert.doesNotMatch(authPage, /socialIcons.*apple/);

  const authProviders = read('src/lib/authProviders.ts');
  assert.doesNotMatch(authProviders, /'apple'/);
  assert.doesNotMatch(authProviders, /Continue with Apple/);
  assert.match(authProviders, /SocialProvider = 'google'/);

  const authCss = read('src/auth-page.css');
  assert.doesNotMatch(authCss, /\.auth-social-btn--apple/);
});
