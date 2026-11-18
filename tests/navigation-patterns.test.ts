import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Navigation is one system matched to platform and depth: five visible
 * destinations on phones, persistent sidebars where desktop content is
 * hierarchical, secondary hamburger disclosures, an accelerator that is never
 * the only route, and no breadcrumb on a two-level structure.
 *
 * These are source contracts in the same style as the rest of the suite. They
 * pin the decisions a later "cleanup" is most likely to quietly undo.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const adminLayout = read('pages/AdminLayout.tsx');
const adminNav = read('pages/AdminNav.tsx');
const quickFind = read('src/components/admin/AdminQuickFind.tsx');
const adminCss = read('src/admin.css');
const publicLayout = read('src/components/HubLayout.tsx');
const dashboard = read('pages/StudentDashboardV2.tsx');

test('the public and student shells keep their five-destination pattern', () => {
  assert.match(publicLayout, /const PUBLIC_PRIMARY/, 'public desktop primaries stay visible in one list');
  assert.match(publicLayout, /<nav className="hub-desktop-nav"/, 'the shallow public site keeps its top bar');
  assert.match(publicLayout, /<nav className="er-mobile-bottom-nav"/, 'public phones keep bottom tabs');
  assert.match(publicLayout, /publicPrimaryNav\(path\)\.map/, 'the bottom bar is driven by the five primaries');
  assert.match(dashboard, /<nav className="er-mobile-bottom-nav"/, 'student phones keep bottom tabs');
  assert.match(dashboard, /edureach-dash-sidebar/, 'the deeper student workspace keeps a desktop sidebar');
});

test('desktop admin navigation is a persistent sidebar, not a collapsed menu', () => {
  assert.match(adminLayout, /<aside[\s\S]*?className=\{`admin-sidebar/, 'the sidebar is rendered outside the drawer state');
  assert.doesNotMatch(adminLayout, /data-menu-open/, 'no collapsed-by-default desktop menu');
  assert.match(adminCss, /\.admin-sidebar\s*\{[\s\S]*?overflow-y:\s*auto/, 'the sidebar scrolls its own hierarchy');
  assert.match(adminCss, /\.admin-nav-group/, 'its five sections are grouped, not flattened');
  assert.match(adminCss, /@media \(max-width: 780px\)[\s\S]*?\.admin-sidebar\.is-open/, 'only phones turn it into a drawer');
});

test('phones keep 3–4 primary admin destinations visible and make More secondary', () => {
  const candidates = adminLayout.slice(
    adminLayout.indexOf('const ADMIN_MOBILE_PRIMARY'),
    adminLayout.indexOf('/** Path changes'),
  );
  assert.ok((candidates.match(/href:/g) ?? []).length >= 3, 'at least three role-appropriate destinations are available');
  assert.match(adminLayout, /\.slice\(0, 4\)/, 'the bar shows no more than four primary destinations');
  assert.match(adminLayout, /mobilePrimary\.map/, 'the primary tabs are capability-filtered');
  assert.match(adminNav, /variant\?: 'sidebar' \| 'mobile'/, 'one link component serves both placements');
  assert.match(adminLayout, /variant="mobile"/, 'the phone tabs use the mobile link variant');
  assert.match(adminLayout, /aria-label="More admin sections"/, 'the hamburger is a labelled secondary disclosure');
  assert.ok(
    adminLayout.indexOf('mobilePrimary.map') < adminLayout.indexOf('aria-label="More admin sections"'),
    'primary destinations render before the More disclosure',
  );
  assert.match(adminCss, /\.admin-mobile-tabs \{ display: none; \}/, 'the tabs are platform-specific');
  assert.match(adminCss, /@media \(max-width: 780px\)[\s\S]*?\.admin-mobile-tabs\s*\{[\s\S]*?position:\s*fixed[\s\S]*?bottom:\s*0/, 'phone tabs are fixed within thumb reach');
  assert.match(adminCss, /\.admin-main \{ padding: 18px 14px calc\(78px \+ env\(safe-area-inset-bottom\)\)/, 'content clears the fixed bar');
});

test('Cmd/Ctrl K is an accelerator paired with visible navigation', () => {
  assert.equal((adminLayout.match(/<AdminQuickFind items=\{quickFindItems\}/g) ?? []).length, 2, 'one placement in the topbar and one in the drawer');
  assert.match(adminLayout, /event\.metaKey \|\| event\.ctrlKey/, 'the shortcut accepts Command and Control');
  assert.match(adminLayout, /event\.key\.toLowerCase\(\) !== 'k'/, 'and only the K chord');
  assert.match(adminLayout, /setMobileNavOpen\(true\)/, 'on a phone it opens the visible drawer');
  assert.match(quickFind, /aria-keyshortcuts="Control\+K Meta\+K"/, 'the finder advertises its shortcut');
  assert.match(adminLayout, /<nav id="admin-navigation" className="admin-nav" aria-label="Administration">/, 'the complete sidebar remains independently visible');
  assert.match(adminCss, /@media \(max-width: 900px\)[\s\S]*?\.admin-topbar > \.admin-quickfind\s*\{\s*display: none;/, 'the compact placement moves into the sidebar rather than disappearing');
});

test('two-level admin routes use a page label, not a breadcrumb trail', () => {
  assert.doesNotMatch(adminLayout, /admin-breadcrumb/, 'no breadcrumb component remains');
  assert.doesNotMatch(adminLayout, /<span aria-hidden="true">\/<\/span>/, 'no two-level separator remains');
  assert.match(adminLayout, /className="admin-page-context"/, 'the current section is still named');
  assert.match(adminCss, /\.admin-page-context[\s\S]*?font-size: 12px/, 'and styled as a compact context label');
});

test('admin navigation ids are unique and drawer controls target one shell element', () => {
  assert.equal((adminLayout.match(/id="admin-navigation"/g) ?? []).length, 1, 'only the nav owns the navigation id');
  assert.equal((adminLayout.match(/id="admin-navigation-drawer"/g) ?? []).length, 1, 'the drawer has its own id');
  assert.match(adminLayout, /aria-controls="admin-navigation-drawer"/, 'the disclosure points at the drawer');
});
