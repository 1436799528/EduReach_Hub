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

test('the notification icon carries a small unread count, never a large red block', () => {
  const component = read('src/components/NotificationCenter.tsx');
  const css = read('src/styles/type-system.css');
  // UX-3 asked for a quiet dot; the later product corrections replaced it with
  // a numeric count so a student can see how much is waiting. The rule that
  // survives both designs is the size: a small badge attached to the bell, with
  // the count also announced to screen readers, never a block that competes
  // with navigation.
  assert.match(component, /er-notif-unread-badge/, 'the unread count is rendered on the bell');
  assert.match(component, /aria-hidden="true">\{unread > 99 \? '99\+' : unread\}/, 'the visible count is capped and hidden from assistive tech');
  assert.match(component, /er-visually-hidden">\{unread\} unread/, 'the same count is announced in words');
  assert.match(component, /markNotificationsRead\(userId\)/, 'mark-all reconciles read state with the server');
  assert.doesNotMatch(component, /autoMarkedRef/, 'opening the panel never blanket-marks every notification read');
  const badgeRule = css.match(/\.er-notif-unread-badge\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(badgeRule, /height:\s*16px/, 'the badge is 16px tall, not a block');
  assert.match(badgeRule, /min-width:\s*16px/);
  assert.match(badgeRule, /border-radius:\s*999px/, 'it is a pill, not a square');
  assert.match(badgeRule, /font-size:\s*10px/, 'the count stays micro type');
});

test('notification and delete actions float without card chrome and stay compact', () => {
  const type = read('src/styles/type-system.css');
  const cbt = read('src/cbt-engine.css');
  const dashboard = read('src/student-dashboard.css');
  const a11y = read('src/styles/a11y.css');
  const bell = type.match(/\.er-notif-trigger\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(bell, /width:\s*32px/);
  assert.match(bell, /height:\s*32px/);
  assert.match(bell, /border:\s*0/);
  assert.match(bell, /background:\s*transparent/);
  assert.match(type, /@media \(pointer: coarse\)[\s\S]*?\.er-notif-trigger \{ width: 44px; height: 44px; \}/, 'the floating bell still has a thumb-sized touch target');

  const deleteActions = cbt.match(/\.er-history-delete,\s*\.er-result-delete\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(deleteActions, /width:\s*30px/);
  assert.match(deleteActions, /height:\s*30px/);
  assert.match(deleteActions, /border:\s*0/);
  assert.match(deleteActions, /background:\s*transparent/);
  assert.match(cbt, /@media \(pointer: coarse\)[\s\S]*?\.er-history-delete,[\s\S]*?width:\s*44px/, 'touch users keep an accessible hit target');

  const dashboardDelete = dashboard.match(/\/\* Destructive actions visually float[\s\S]*?\.dash-icon-btn\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(dashboardDelete, /width:\s*30px/);
  assert.match(dashboardDelete, /border:\s*0/);
  assert.match(dashboardDelete, /background:\s*transparent/);
  assert.match(dashboard, /@media \(pointer: coarse\) \{ \.dash-icon-btn \{ width: 44px; height: 44px;/, 'dashboard delete controls keep a 44px touch target');
  assert.match(a11y, /\.dash-icon-btn,[\s\S]*?min-height: 44px !important/, 'the shared touch rule protects the delete target height');
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
  assert.match(page, /restoreAdminNews\(article\)/, 'Undo restores through the server with the original identity');
  assert.match(read('src/lib/api.ts'), /news\/restore/, 'the restore endpoint is a real API call, not a client-side reinsert');
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
    // The retired labels were Title Case product copy ("Delete Result",
    // "Remove Result", "Delete My Result"). The match is case-sensitive on
    // purpose: the current, shorter label is the sentence-case "Delete result",
    // and an /i match would forbid ordinary sentence case as if it were the old
    // label. The paste-image affordance is gone in every casing.
    assert.doesNotMatch(source, /Delete Result|Remove Result|Delete My Result/, file);
    assert.doesNotMatch(source, /paste image/i, file);
  }
  assert.match(read('pages/CbtResultsPage.tsx'), /Delete result/, 'the destructive action still names its object in sentence case');
});

test('the admin overview does not repeat the same activity group', () => {
  const page = read('pages/AdminDashboardPage.tsx');
  const count = (page.match(/title="Most-completed services"/g) || []).length;
  assert.equal(count, 1, 'one group per activity measure');
  assert.match(page, /Most-viewed services/, 'views are labelled as views, not submissions');
});
