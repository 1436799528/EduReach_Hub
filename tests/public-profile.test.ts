import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_PROFILE_SLUG_PATTERN,
  generatePublicProfileSlug,
  projectPublicProfile,
} from '../src/lib/publicProfile';

// UI-5: a shared profile link used to land on the private /profile route. The
// public surface is opt-in, served by a whitelist, and deliberately narrow.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const privateRow = {
  id: '00000000-0000-0000-0000-000000000001',
  full_name: 'James Aponi',
  school: 'University of Calabar',
  course_programme: 'Electrical Engineering',
  department: 'Electrical/Electronic Engineering',
  faculty: 'Engineering',
  level: '300',
  avatar_url: 'https://cdn.example/james.png',
  public_profile_slug: 'james-7k2p9q',
  email: 'james@example.com',
  phone: '08012345678',
  matric_number: 'UNICAL/2023/001',
  jamb_reg_no: '202312345678AB',
  role: 'student',
  notification_preferences: { email_alerts: true },
  profile_completed: true,
};

test('the public projection is an allow-list, not a redaction pass', () => {
  const profile = projectPublicProfile(privateRow, true);
  assert.deepEqual(Object.keys(profile).sort(), [
    'avatar_url',
    'course_programme',
    'email_verified',
    'full_name',
    'level',
    'school',
    'slug',
  ]);
  const serialized = JSON.stringify(profile);
  for (const secret of ['james@example.com', '08012345678', 'UNICAL/2023/001', '202312345678AB', privateRow.id, '"role"', 'notification_preferences']) {
    assert.equal(serialized.includes(secret), false, `the response must not contain ${secret}`);
  }
});

test('a missing name has an honest fallback, and an unsafe avatar is dropped', () => {
  const profile = projectPublicProfile({ full_name: null, avatar_url: 'javascript:alert(1)' });
  assert.equal(profile.full_name, 'EduReach student');
  assert.equal(profile.avatar_url, null);
});

test('long values are bounded instead of reflected whole', () => {
  const profile = projectPublicProfile({ full_name: 'A'.repeat(500), school: 'B'.repeat(500) });
  assert.equal(profile.full_name.length, 80);
  assert.equal(profile.school.length, 120);
});

test('generated slugs satisfy the database constraint and never contain a name-only guess', () => {
  for (const name of ['James Aponi', 'Chinwendu', '  ', 'Ọláø Adéyemí']) {
    const slug = generatePublicProfileSlug(name);
    assert.match(slug, PUBLIC_PROFILE_SLUG_PATTERN, `${slug} must be a valid public slug`);
    assert.ok(slug.length >= 6 && slug.length <= 32);
    assert.doesNotMatch(slug, /[A-Z_\s]/);
  }
  const first = generatePublicProfileSlug('James');
  const second = generatePublicProfileSlug('James');
  assert.notEqual(first, second, 'the suffix must not be predictable from the name alone');
});

test('the slug pattern rejects traversal, uppercase and overlong handles', () => {
  for (const value of ['../profile', 'James-Aponi', 'abc', 'a'.repeat(33), 'james_aponI']) {
    assert.equal(PUBLIC_PROFILE_SLUG_PATTERN.test(value), false, value);
  }
  assert.equal(PUBLIC_PROFILE_SLUG_PATTERN.test('james-7k2p9q'), true);
});

test('the migration makes public visibility opt-in and grants only the two columns', () => {
  const sql = read('supabase/migrations/20261113000000_public_profiles.sql');
  assert.match(sql, /public_profile boolean not null default false/i, 'public is off by default');
  assert.match(sql, /create unique index if not exists profiles_public_profile_slug_key/i);
  assert.match(sql, /grant update \(public_profile, public_profile_slug\) on table public\.profiles to authenticated;/i);
  assert.doesNotMatch(sql, /grant select/i, 'visitors read through the API, not an anonymous table grant');
});

test('the API reads only opted-in rows and returns no id', () => {
  const server = read('server.ts');
  assert.match(server, /app\.get\('\/api\/public\/profiles\/:slug'/);
  assert.match(server, /\.eq\('public_profile_slug', slug\)\s*\.eq\('public_profile', true\)/);
  assert.match(server, /publicProfileResponse\(row, emailVerified\)/);
  assert.match(server, /getUserById\(String\(row\.id\)\)/, 'verification is checked on the account');
  const projection = read('src/lib/publicProfile.ts');
  const select = /export const PUBLIC_PROFILE_SELECT = \[([\s\S]*?)\]\.join/.exec(projection);
  assert.ok(select, 'the select list is declared');
  assert.doesNotMatch(select[1], /phone|email|matric|jamb_reg_no|notification_preferences|role/);
});

test('the public route exists and the shared link is not the private profile page', () => {
  const routes = read('src/app/routes.tsx');
  assert.match(routes, /path\.startsWith\('\/u\/'\)/);
  assert.match(routes, /<PublicProfilePage slug=/);
  const page = read('pages/PublicProfilePage.tsx');
  assert.match(page, /fetchPublicProfile\(slug\)/);
  assert.match(page, /What this page does not show/);
  assert.match(page, /email address, phone number,\s*matric number/i);
  const seo = read('src/server/seo.ts');
  assert.match(seo, /'\/u\/'/, 'public profiles are opt-in and stay out of the index');
});

test('visibility is its own immediate setting, and it writes only the two public columns', () => {
  const page = read('pages/ProfileCompletionPage.tsx');
  assert.match(page, /const updateVisibility = async \(enabled: boolean\)/);
  assert.match(page, /\.update\(\{ public_profile: enabled, public_profile_slug: slug \}\)/);
  assert.match(page, /Create public link/);
  assert.match(page, /Turn off public link/);
  assert.doesNotMatch(page, /\.upsert\(/);
});
