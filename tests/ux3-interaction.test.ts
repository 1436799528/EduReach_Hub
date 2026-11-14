import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  normaliseFacultyForTest,
  normaliseLevelForTest,
  optionsForSavedTest,
} from './ux3-helpers';

// UX-3 pins the interaction contract in source. Browser tests exercise the
// rendered behaviour; these catch a regression before a build is needed.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

test('the profile has one real photo affordance and no pasted image URL', () => {
  const page = read('pages/ProfileCompletionPage.tsx');
  assert.doesNotMatch(page, /avatarImageUrl/, 'the pasted URL state is gone');
  assert.doesNotMatch(page, /paste image URL|paste a public image URL|Or paste image/i, 'no paste copy remains');
  assert.doesNotMatch(page, /aria-label="Profile image URL"/, 'no URL field remains');
  assert.match(page, /accept="image\/png,image\/jpeg,image\/webp,image\/gif"/, 'a real file picker remains');
  assert.match(page, /supabase\.storage\.from\('avatars'\)\.upload/, 'the photo still goes to Storage');
  assert.match(page, /const finalAvatar = \[customAvatar, avatarUrl\]/, 'only a Storage/legacy public URL is persisted');
  assert.doesNotMatch(page, /avatarImageUrl|data:image/, 'no base64 avatar path is introduced');
  assert.match(page, /noValidate/, 'the form validates in the app, not only through a silent native bubble');
  assert.match(page, /disabled=\{saving \|\| savedSuccess \|\| !isDirty\}/, 'Save is enabled only for a change');
  assert.match(page, /confirmDiscard/, 'Cancel can warn before discarding edits');
});

test('legacy faculty and level values stay visible and map to current labels', () => {
  assert.equal(normaliseFacultyForTest('Science'), 'Faculty of Science');
  assert.equal(normaliseFacultyForTest('Engineering'), 'Faculty of Engineering & Technology');
  assert.equal(normaliseLevelForTest('300'), '300 Level');
  assert.equal(normaliseFacultyForTest('Faculty of Law'), 'Faculty of Law');
  assert.equal(normaliseLevelForTest('400 Level'), '400 Level');
  assert.deepEqual(optionsForSavedTest(['Faculty of Law'], 'Science'), ['Science', 'Faculty of Law']);
  assert.deepEqual(optionsForSavedTest(['Faculty of Law'], 'Faculty of Law'), ['Faculty of Law']);
});

test('the notification icon is a small dot, never a numbered red block', () => {
  const component = read('src/components/NotificationCenter.tsx');
  const css = read('src/styles/type-system.css');
  assert.doesNotMatch(component, /er-notif-badge/, 'the count block markup is gone');
  assert.match(component, /er-notif-unread-dot/, 'the dot markup is present');
  assert.match(component, /markNotificationsRead\(userId\)/, 'opening reconciles read state with the server');
  assert.match(component, /autoMarkedRef/, 'a failed auto-mark does not loop');
  const dotRule = css.match(/\.er-notif-unread-dot\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(dotRule, /width:\s*8px/);
  assert.match(dotRule, /height:\s*8px/);
  assert.match(dotRule, /top:\s*5px/);
  assert.match(dotRule, /right:\s*5px/);
});

test('admin navigation is client-side and still supports modified clicks', () => {
  const nav = read('pages/AdminNav.tsx');
  assert.match(nav, /event\.preventDefault\(\)/);
  assert.match(nav, /navigateInApp\(href\)/);
  assert.match(nav, /metaKey \|\| event\.ctrlKey/, 'new-tab clicks are left to the browser');
});

test('news table has honest select-all, live selection and reversible bulk delete', () => {
  const page = read('pages/AdminNewsPage.tsx');
  const css = read('src/admin.css');
  assert.match(page, /selectAllRef\.current\.indeterminate = someOnPageSelected/, 'the header checkbox has a dash state');
  assert.match(page, /Select all \$\{visible\.length\} matching/, 'the label states how many rows it will select');
  assert.match(page, /new Map\(current\)/, 'selection survives a page/filter change in component state');
  assert.match(page, /deleteSelected/, 'bulk delete exists');
  assert.match(page, /10_000/, 'Undo has a ten-second window');
  assert.match(page, /undoDelete/, 'Undo is wired');
  assert.match(page, /createAdminNews\(input\)/, 'Undo restores through the server, not the client list');
  assert.match(page, /aria-label="Delete"/, 'the row delete affordance is named Delete');
  assert.match(page, /<Trash2 size=\{18\}/, 'the delete glyph is 18px');
  assert.doesNotMatch(page, /<Trash2 size=\{12\} \/> Delete/, 'the old text+12px delete control is gone');
  assert.match(css, /\.admin-icon-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/, 'the delete target is 44×44');
  assert.match(css, /\.admin-undo-progress/, 'the countdown drains visibly');
});

test('question import has a partial-selection-aware select-all', () => {
  const page = read('pages/AdminQuestionImportPage.tsx');
  assert.match(page, /selectAllRef\.current\.indeterminate = someReviewSelected/);
  assert.match(page, /Select all \$\{selectableReviewItems\.length\} matching/);
  assert.match(page, /toggleReviewPage/);
});

test('MyCBT shows the latest paper, real metrics and an honest empty trend', () => {
  const page = read('pages/StudentDashboardV2.tsx');
  assert.match(page, /Latest CBT/);
  assert.match(page, /Performance analysis/);
  assert.match(page, /const latestAccuracy/);
  assert.match(page, /const overallAccuracy/);
  assert.match(page, /No performance trend yet\. Complete two scored papers/, 'one score is not drawn as a trend');
  assert.match(page, /latestDurationMinutes/);
});

test('one motion scale is defined and reduced motion removes it', () => {
  const css = read('src/styles/type-system.css');
  assert.match(css, /--er-motion-tap:\s*80ms/);
  assert.match(css, /--er-motion-standard:\s*140ms/);
  assert.match(css, /--er-motion-enter:\s*240ms/);
  assert.match(css, /--er-motion-exit:\s*160ms/);
  assert.match(css, /--er-motion-attention:\s*650ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /animation:\s*bounce|spring\(/i, 'no bounce/spring system');
});

test('mobile CBT action is one white-bar primary with no gradient', () => {
  const css = read('src/edu-portal.css');
  const page = read('pages/ExamSetupPage.tsx');
  assert.match(page, /er-setup-secondary/);
  assert.match(css, /\.er-setup-actions \.hub-primary-btn\{min-height:48px/);
  assert.match(css, /\.er-setup-actions \.er-setup-secondary\{[\s\S]*?border:0;background:transparent/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?min-height: 44px !important/, 'touch actions are at least 44px');
});

test('the old delete-result and paste-image labels are absent from source', () => {
  const files = [
    'pages/StudentDashboardV2.tsx',
    'pages/CbtResultsPage.tsx',
    'pages/ProfileCompletionPage.tsx',
    'src/components/NotificationCenter.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /Delete Result|Remove Result|Delete My Result|Paste Image/i, file);
  }
});

test('the admin overview does not repeat the same activity group', () => {
  const page = read('pages/AdminDashboardPage.tsx');
  const count = (page.match(/title="Most-completed services"/g) || []).length;
  assert.equal(count, 1, 'one group per activity measure');
  assert.match(page, /Most-viewed services/, 'views are labelled as views, not submissions');
});
