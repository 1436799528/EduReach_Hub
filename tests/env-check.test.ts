import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyProject, describeProject, projectReference, PRODUCTION_PROJECT_REF } from '../scripts/env-check';

// The project classifier exists because one `.env` is used for two jobs with
// opposite safety rules: read-only verification (safe anywhere) and a manual
// walkthrough that creates accounts, attempts and uploads (never safe against
// production). It has to be right about which project is which, and it has to
// never leak more than the project reference.

test('the project reference is read from a Supabase URL', () => {
  assert.equal(projectReference('https://abcdefghijklmnop.supabase.co'), 'abcdefghijklmnop');
  assert.equal(projectReference('https://abcdefghijklmnop.supabase.co/'), 'abcdefghijklmnop');
  assert.equal(projectReference('  https://abcdefghijklmnop.supabase.co  '), 'abcdefghijklmnop');
  assert.equal(projectReference('https://abcdefghijklmnop.supabase.in'), 'abcdefghijklmnop');
});

test('anything that is not a Supabase project URL yields no reference', () => {
  assert.equal(projectReference(''), null);
  assert.equal(projectReference(undefined), null);
  assert.equal(projectReference('http://localhost:54321'), null);
  assert.equal(projectReference('https://edureachhub.netlify.app'), null);
  // A key accidentally pasted into the URL slot must not be echoed as a project.
  assert.equal(projectReference('sb_secret_abcdefghijklmnop'), null);
});

test('the documented production project is classified as production, with write guidance', () => {
  const verdict = classifyProject(PRODUCTION_PROJECT_REF);
  assert.equal(verdict.kind, 'production');
  assert.equal(verdict.reference, PRODUCTION_PROJECT_REF);
  const text = verdict.guidance.join(' ');
  assert.match(text, /Read-only checks are fine/);
  assert.match(text, /Do NOT create accounts/);
  assert.match(text, /db push/);
});

test('any other project is treated as staging, and the guidance says to confirm', () => {
  const verdict = classifyProject('someotherprojectref');
  assert.equal(verdict.kind, 'staging-or-other');
  assert.match(verdict.guidance.join(' '), /Confirm it is really your staging project/);
});

test('an unconfigured environment says so instead of guessing', () => {
  const verdict = describeProject({});
  assert.equal(verdict.kind, 'unconfigured');
  assert.equal(verdict.reference, null);
  assert.match(verdict.guidance.join(' '), /nothing can reach a database/);
});

test('the environment is read without ever returning a key', () => {
  const verdict = describeProject({
    VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_should_not_appear',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_should_not_appear',
  });
  assert.equal(verdict.reference, 'abcdefghijklmnop');
  assert.doesNotMatch(JSON.stringify(verdict), /should_not_appear/);
});
