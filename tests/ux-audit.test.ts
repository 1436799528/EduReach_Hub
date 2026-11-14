import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// UX-1 — the quiet hierarchy the audit asked for. These assertions protect the
// decisions that are easy to silently undo in a later visual pass: the overview
// is analytics-first, colour is semantic, profile saves speak in sentences a
// student can act on, and the admin shell can find its own pages by keyboard.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const dashboard = read('pages/StudentDashboardV2.tsx');
const profile = read('pages/ProfileCompletionPage.tsx');
const adminLayout = read('pages/AdminLayout.tsx');
const adminDashboard = read('pages/AdminDashboardPage.tsx');
const quickFind = read('src/components/admin/AdminQuickFind.tsx');

test('the student overview is identity, KPIs and analytics before explanation', () => {
  assert.match(dashboard, /Your learning overview/);
  assert.match(dashboard, /className="dash-kpi-grid"/);
  assert.match(dashboard, /className="dash-analytics"/);
  assert.match(dashboard, /Not enough activity yet/);
  assert.match(dashboard, /className="dash-attention"/);
  assert.doesNotMatch(dashboard, /Welcome back/);
  assert.doesNotMatch(dashboard, /dash-quick-actions/);
  assert.doesNotMatch(dashboard, /dash-report-strip/);
});

test('the overview keeps attention, notifications and recent activity in that order', () => {
  const overview = dashboard.slice(dashboard.indexOf('const overview = ('));
  const attention = overview.indexOf('dash-attention');
  const notifications = overview.indexOf('id="dashboard-notifications"');
  const recent = overview.indexOf('dash-recent-activity');
  assert.ok(attention > 0 && notifications > attention, 'attention precedes notifications');
  assert.ok(recent > notifications, 'notifications precede recent activity');
});

test('colour is a status signal, not a category decoration', () => {
  const studentCss = read('src/student-dashboard.css');
  const adminCss = read('src/admin.css');
  assert.doesNotMatch(studentCss, /\.edureach-nav-item\.active\s*\{[^}]*#b14933/i, 'selected navigation is not crimson');
  assert.doesNotMatch(adminCss, /\.admin-kpi-icon[^{]*\{[^}]*crimson/i, 'KPI icons are neutral');
  assert.match(studentCss, /\.dash-notification-dot\s*\{[^}]*var\(--er-crimson\)/, 'unread is an attention state');
});

test('profile save has a specific success state and a safe failure sentence', () => {
  assert.match(profile, /Profile saved successfully/);
  assert.match(profile, /Saving\.\.\./);
  assert.match(profile, /Couldn’t save your profile\. Try again\./);
  assert.doesNotMatch(profile, /Profile was not saved: \$\{safe\}/, 'raw database errors never reach the page');
  assert.match(profile, /aria-live="polite"/);
});

test('the admin shell exposes a keyboard-first page finder and a live timestamp', () => {
  assert.match(adminLayout, /<AdminQuickFind items=\{quickFindItems\}/);
  assert.match(quickFind, /role="combobox"/);
  assert.match(quickFind, /ArrowDown/);
  assert.match(quickFind, /aria-activedescendant/);
  assert.match(adminDashboard, /admin-live/);
  assert.match(adminDashboard, /Live/);
});

test('the profile write fix grants only the staff predicate the policies call', () => {
  const migration = read('supabase/migrations/20261113120000_repair_profile_write_policy.sql');
  assert.match(migration, /grant execute on function public\.is_staff\(uuid\) to authenticated, service_role/);
  assert.match(migration, /create or replace function public\.is_staff\(p_user_id uuid\)/);
  assert.match(migration, /coalesce\(auth\.uid\(\), p_user_id\)/, 'authenticated callers cannot query another user');
  assert.match(migration, /revoke all on function public\.is_staff/);
});
