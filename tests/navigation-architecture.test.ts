import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * The two navigation layers.
 *
 * Public EduReach is a discovery site: Home · Practice · Services · News ·
 * Scholarships, with everything else disclosed from More. Authenticated
 * EduReach is the student's own workspace: Overview · CBT · Results · Profile ·
 * Tools, with service requests and utilities in secondary navigation.
 *
 * These assertions pin the *structure* — how many primary slots exist, what
 * they are, and which layer owns each destination — because that is the part a
 * later redesign is most likely to quietly undo.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const layout = read('src/components/HubLayout.tsx');
const dashboard = read('pages/StudentDashboardV2.tsx');
const routes = read('src/app/routes.tsx');
const practice = read('pages/CbtPage.tsx');
/** The page without its explanatory comments: assertions are about what ships. */
const practiceMarkup = practice.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const home = read('pages/HubHomePage.tsx');

/** The literal PUBLIC_PRIMARY list, in order. */
function publicPrimary(): string[] {
  const block = layout.slice(layout.indexOf('const PUBLIC_PRIMARY'), layout.indexOf('function publicPrimaryNav'));
  return [...block.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
}

function dashboardNav(): string[] {
  const block = dashboard.slice(dashboard.indexOf('const NAV:'), dashboard.indexOf('const localSavedItemsKey'));
  return [...block.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
}

test('the public site has exactly five primary destinations, in order', () => {
  assert.deepEqual(
    publicPrimary(),
    ['Home', 'Practice', 'Services', 'News', 'Scholarships'],
    'Home · Practice · Services · News · Scholarships',
  );
  assert.ok(publicPrimary().length <= 5, 'no more than five primary slots');
});

test('past questions is part of Practice/Questions, not a sixth primary tab', () => {
  assert.ok(!publicPrimary().includes('Past questions'), 'past questions does not take a primary slot');
  const secondary = layout.slice(layout.indexOf('const publicSecondaryNav'));
  assert.match(secondary, /href: '\/past-questions'/, 'it is disclosed from More');
  assert.match(practice, /href="\/past-questions"/, 'and linked from the Practice page');
  assert.match(layout, /label: 'Past questions'/);
});

test('the More menu holds the secondary public destinations', () => {
  const secondary = layout.slice(layout.indexOf('const publicSecondaryNav'), layout.indexOf('export default function HubLayout'));
  for (const label of ['Events and deadlines', 'School finder', 'Screening calculator', 'CGPA calculator', 'About EduReach', 'Contact']) {
    assert.ok(secondary.includes(label), `${label} is reachable from More`);
  }
  // The desktop row renders the five primaries plus the More disclosure only.
  const nav = layout.slice(layout.indexOf('<nav className="hub-desktop-nav"'), layout.indexOf('</nav>'));
  assert.equal((nav.match(/hub-nav-link/g) ?? []).length, 2, 'the row maps one link class and one More trigger');
  assert.match(nav, /aria-label="More"/, 'the overflow menu is labelled');
});

test('the dashboard has five primary destinations: Overview, CBT, Results, Profile, Tools', () => {
  assert.deepEqual(dashboardNav(), ['Overview', 'CBT', 'Results', 'Profile', 'Tools']);
  // CBT is central, not buried: it is the second of five and owns the raised
  // centre position on the phone bar.
  assert.equal(dashboardNav()[1], 'CBT');
  assert.match(dashboard, /className=\{activeTab === 'cbt' \? 'active mobile-cbt' : 'mobile-cbt'\}/, 'CBT keeps the raised centre tab');
  assert.equal(dashboardNav().includes('My Requests'), false, 'service requests are not a study destination');
});

test('the dashboard routes match the five destinations, and old links still resolve', () => {
  assert.match(routes, /path === '\/dashboard' \|\| path === '\/dashboard\/notifications'/, 'overview');
  assert.match(routes, /path === '\/dashboard\/cbt'/, 'CBT');
  assert.match(routes, /path === '\/dashboard\/results'/, 'results');
  assert.match(routes, /path === '\/dashboard\/profile'.*protectedDashboard\('profile'\)/, 'profile');
  assert.match(routes, /path === '\/dashboard\/tools'/, 'tools');
  // Legacy links from the previous structure keep working.
  assert.match(routes, /path === '\/dashboard\/cbt\/results'\) return <RedirectTo path="\/dashboard\/results"/, 'the old results URL redirects');
  assert.match(routes, /path\.startsWith\('\/dashboard\/cbt\/results\/'\)/, 'including a saved result');
  assert.match(routes, /path === '\/dashboard\/past-questions'\) return <RedirectTo path="\/past-questions"/, 'past questions left the dashboard');
});

test('Practice is the simulator hub and nothing else', () => {
  assert.match(practice, /<ExamSimulatorGrid[^>]*showFilters/, 'every simulator renders from the shared catalogue');
  assert.match(practice, /SIMULATOR_HUB_COPY\.practice/, 'the page states one purpose');
  for (const removed of [
    /CbtHistoryPanel/,
    /Practice history/,
    /Results/,
    /score/,
    /Average/,
    /fetchCbtHistory/,
    /Calculator/,
    /News/,
    /Scholarship/,
  ]) {
    assert.doesNotMatch(practiceMarkup, removed, `Practice must not carry ${removed}`);
  }
  assert.doesNotMatch(practice, /er-bank-card/, 'the old second bank-card list is gone');
});

test('Results owns practice history and analysis', () => {
  assert.match(dashboard, /const resultsView = \(/, 'the results view is the history surface');
  assert.match(dashboard, /<h1 className="dash-page-title" id="dash-results-heading" tabIndex=\{-1\}>Results<\/h1>/);
  assert.match(dashboard, /Performance analysis/, 'analysis stays with results');
  assert.match(dashboard, /attemptsTable\(visibleAttempts\)/, 'and so does the detailed history');
  // The Practice page no longer owns either.
  assert.doesNotMatch(practice, /analysis|attemptsTable|performance/i);
});

test('CBT inside the dashboard is the same simulator hub the public Practice page uses', () => {
  const cbtView = dashboard.slice(dashboard.indexOf('const cbtHubView'), dashboard.indexOf('const profileView'));
  assert.match(cbtView, /<ExamSimulatorGrid showFilters \/>/, 'one shared catalogue');
  assert.match(cbtView, /dash-resume/, 'an unfinished paper is one tap away');
  assert.doesNotMatch(cbtView, /Performance analysis|attemptsTable/, 'results are not mixed into CBT');
});

test('Profile is part of the dashboard and reuses the one profile page', () => {
  assert.match(dashboard, /lazy\(\(\) => import\('\.\/ProfileCompletionPage'\)\)/, 'the profile page is loaded, not cloned');
  assert.match(dashboard, /<ProfilePanel embedded \/>/, 'and mounted without the public shell');
  const profile = read('pages/ProfileCompletionPage.tsx');
  assert.match(profile, /function ProfileShell\(\{ embedded, children \}/, 'the page supports an embedded mount');
  assert.match(profile, /Privacy and data/, 'privacy controls live with the account');
  assert.match(profile, /Request data or account deletion/, 'deletion is a named route, not a silent control');
  for (const section of ['Personal information', 'Academic information', 'Account &amp; security', 'Preferences']) {
    assert.ok(profile.includes(section), `the profile keeps ${section}`);
  }
});

test('the phone bar carries the same hierarchy as its layer', () => {
  const pub = layout.slice(layout.indexOf('<nav className="er-mobile-bottom-nav"'));
  assert.match(pub, /publicPrimaryNav\(path\)\.map/, 'the public bar is driven by the five primaries');
  const dash = dashboard.slice(dashboard.indexOf('<nav className="er-mobile-bottom-nav"'));
  for (const label of ['Overview', 'CBT', 'Results', 'Profile', 'Tools']) {
    assert.ok(dash.includes(`<span>${label}</span>`), `the dashboard bar labels ${label}`);
  }
  assert.equal((dash.match(/<span>/g) ?? []).length, 5, 'exactly five destinations, not seven');
});

test('registration and sign-in land in the dashboard, not back on the homepage', () => {
  const auth = read('pages/AuthPageV2.tsx');
  assert.match(auth, /return next && next\.startsWith\('\/'\) && !next\.startsWith\('\/\/'\) \? next : '\/dashboard'/, 'the default post-auth destination is the dashboard');
  const profile = read('pages/ProfileCompletionPage.tsx');
  assert.match(profile, /navigateInApp\(embedded \? profileBase : editMode \? '\/profile' : '\/dashboard'\)/, 'finishing onboarding opens the dashboard, while a dashboard edit returns to the profile tab');
});

test('personal data stays out of the public layer', () => {
  assert.doesNotMatch(home, /dashboard\/results|score|Average|Attempts/, 'the public homepage shows no student achievement data');
  assert.match(home, /exam|Practice/, 'it still offers the public study entry point');
  // The primary row is public-only; the authenticated account menu may still
  // offer the student's own destinations once they are signed in.
  const primaryBlock = layout.slice(layout.indexOf('const PUBLIC_PRIMARY'), layout.indexOf('export default function HubLayout'));
  assert.doesNotMatch(primaryBlock, /dashboard\/results|dashboard\/profile|\/cbt\/session/, 'no private destination is a public primary');
});
