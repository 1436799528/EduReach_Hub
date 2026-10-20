import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Phase D rules, asserted against the code that expresses them. These are the
// behaviours the audit found missing: a dashboard that leads with what matters,
// listings that state their verification, news that shows its age, and a service
// page that says what happens after Submit. Each assertion is about a rule, not
// about markup, so a redesign that keeps the rule keeps passing.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

test('the dashboard opens with what matters now, not with static profile details', () => {
  const page = read('pages/StudentDashboardV2.tsx');
  assert.match(page, /dashboardPriorities\(/, 'the strip is derived from the shared rule');
  const priorityIndex = page.indexOf('dash-priority');
  const profileIndex = page.indexOf('Saved profile details');
  const requestsIndex = page.indexOf('Latest requests');
  assert.ok(priorityIndex > -1 && profileIndex > -1 && requestsIndex > -1);
  assert.ok(priorityIndex < requestsIndex, 'the priority strip comes before the working sets');
  assert.ok(requestsIndex < profileIndex, 'static reference details sit below the things that need action');
});

test('an expired attempt is never offered as resumable anywhere', () => {
  const page = read('pages/StudentDashboardV2.tsx');
  assert.match(page, /cbtAttemptState\(row\)/, 'the table reads the shared attempt rule');
  assert.ok(!/status === 'in_progress';?\s*$/.test(page.split('const isActiveCbtAttempt')[1]?.split('\n')[0] || ''), 'no bare status check remains');
  assert.match(page, /state === 'expired' && <a className="dash-card-link" href="\/cbt">Start a new test<'?/, 'an expired attempt points at a new test, not at the old one');
  assert.match(page, /\/cbt\/session\/\$\{encodeURIComponent\(row\.id\)\}/, 'resume goes straight into the attempt, not through setup');
});

test('opportunities state their verification and provenance instead of implying both', () => {
  const page = read('pages/JobsPage.tsx');
  assert.match(page, /opportunityStatus\(item\)/, 'the status comes from the shared rule');
  assert.match(page, /status\.verificationLabel/, 'the card states whether EduReach checked it');
  assert.match(page, /status\.cta/, 'the button wording follows the verification state');
  assert.match(page, /Eligibility/, 'eligibility is shown, including when it is not recorded');
  assert.match(page, /Last checked/, 'the check date is visible on the card');
  assert.match(page, /source_name/, 'the source is shown when one is recorded');
  // The claim that started this: every listing described as checked.
  assert.ok(
    !/Grants and scholarships appear only when their source, eligibility and application route have been checked/.test(page),
    'the header must not claim every listing was checked',
  );
  assert.match(page, /Not yet checked by EduReach/, 'an unchecked listing says so');
});

test('news rows carry their age and the list can be searched', () => {
  const rows = read('src/components/NewsSections.tsx');
  assert.match(rows, /newsFreshness\(item\)/, 'the row derives a freshness state');
  assert.match(rows, /er-news-freshness/, 'and shows it');
  const page = read('pages/NewsPage.tsx');
  assert.match(page, /type="search"/, 'the list has a search box');
  assert.match(page, /Number\(newsFreshness\(b\)\.current\) - Number\(newsFreshness\(a\)\.current\)/, 'current stories sort above expired ones');
  assert.match(page, /newsCategorySlug\(raw\)/, 'category links resolve through the one canonicaliser');
  assert.ok(!/legacyCategoryAliases/.test(page), 'the duplicate alias map is gone');
});

test('the service page says what happens after Submit, before and after it', () => {
  const page = read('pages/ServiceApplyPage.tsx');
  const timelineUses = page.match(/serviceTimeline\(\)/g) || [];
  assert.ok(timelineUses.length >= 2, 'the timeline appears on the review step and on the confirmation panel');
  assert.match(page, /After you press Submit/, 'the promise is made before the button is pressed');
  assert.match(page, /does not promise a number of days/, 'no invented service level is claimed');
  const dashboard = read('pages/StudentDashboardV2.tsx');
  assert.match(dashboard, /serviceStatusMeaning\(row\.status\)\.meaning/, 'the dashboard explains each status in the same words');
});

test('an institution without a recorded website offers a real next step', () => {
  const page = read('pages/SchoolDetailsPage.tsx');
  assert.match(page, /No official website recorded for this institution/);
  assert.match(page, /will not guess a URL/, 'the page explains why the link is absent');
  assert.match(page, /Request the verified link/, 'and gives the student a way to get it');
});

test('the shared rules are used, not re-implemented per page', () => {
  // One rule per concept: if a second copy appears, this fails and points at it.
  const competing = [
    ['status === \'in_progress\'', 'pages/StudentDashboardV2.tsx', 'use cbtAttemptState'],
    ['legacyCategoryAliases', 'pages/NewsPage.tsx', 'use newsCategorySlug'],
  ];
  for (const [pattern, file, advice] of competing) {
    assert.ok(!read(file).includes(pattern), `${file} must not re-implement the rule — ${advice}`);
  }
});

test('the dark footer does not override its accessible muted text color', () => {
  const layout = read('src/components/HubLayout.tsx');
  const footer = layout.slice(layout.indexOf('<footer className="er-footer"'), layout.indexOf('</footer>'));
  assert.match(footer, /color: '#94a3b8'/, 'the footer provides a readable text color on navy');
  assert.ok(!/color: '#64748b'/.test(footer), 'copyright text must not override it with low-contrast slate');
});

test('the product uses one name for the collection and one for each CBT action', () => {
  const files = [
    'pages/HubHomePage.tsx', 'pages/PastQuestionsPage.tsx', 'pages/StudentDashboardV2.tsx',
    'src/components/HubLayout.tsx', 'src/components/CardIdentityMark.tsx', 'src/components/ExamSimulatorGrid.tsx',
  ];
  const sources = files.map((file) => [file, read(file)] as const);
  for (const [file, source] of sources) {
    assert.ok(!/Past Question Library|Past Questions Bank|Start Test\b/.test(source), `${file} uses a retired term`);
  }
  // The setup page keeps the two governed actions, and the dashboard links to them.
  const setup = read('pages/ExamSetupPage.tsx');
  assert.match(setup, /'Start mock examination' : 'Start practice'/);
  assert.match(read('pages/StudentDashboardV2.tsx'), /Start practice</);
});

test('the home page leads with a display headline and a touch-sized action', () => {
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /<h1>Practise the exam you are sitting\.<\/h1>/, 'the page states its purpose as the h1');
  const density = read('src/compact-design-system.css');
  assert.match(
    density,
    /\.hub-home-intro h1\{[^}]*font-size:clamp\(28px,3\.4vw,40px\)!important/,
    'the compact layer does not flatten the hero to a card label',
  );
  assert.match(density, /\.hub-home-intro p\{[^}]*font-size:15px!important/, 'the hero paragraph is readable body copy');
  assert.doesNotMatch(density, /\.hub-home-intro h1\{font-size:19px/, 'the phone breakpoint does not shrink the hero below its paragraph');
  assert.match(density, /\.hub-home-intro h1\{font-size:clamp\(26px,7vw,30px\)!important\}/, 'the phone hero keeps a display size');
  const css = read('src/home-card-first.css');
  assert.match(css, /\.hub-home-actions \.hub-home-cta\{[^}]*min-height:44px/, 'the hero actions are touch targets');
});

test('both home actions are one control with two destinations', () => {
  const home = read('pages/HubHomePage.tsx');
  const start = home.indexOf('hub-home-actions');
  const actions = home.slice(start, home.indexOf('</div>', start));

  assert.equal((actions.match(/className="hub-home-cta"/g) ?? []).length, 2, 'both anchors carry the shared class');
  assert.doesNotMatch(actions, /hub-(primary|ghost)-btn/, 'neither anchor keeps a competing button style');
  assert.match(actions, /Start practising/, 'the simulator keeps the first position');
  assert.match(actions, /Past questions/);

  const css = read('src/home-card-first.css');
  const block = /\.hub-home-actions \.hub-home-cta\{([^}]*)\}/.exec(css);
  assert.ok(block, 'the pair is styled by one rule');
  for (const declaration of [
    'background:var(--er-primary)',
    'color:var(--er-on-primary)',
    'border:1px solid var(--er-primary-border)',
    'height:44px',
    'min-height:44px',
    'padding:0 18px',
    'border-radius:9px',
    'font:560 14px/1',
  ]) {
    assert.ok(block[1].includes(declaration), `the shared rule sets ${declaration}`);
  }
  assert.match(css, /\.hub-home-actions \.hub-home-cta:hover\{[^}]*background:var\(--er-primary-hover\)/, 'hover is defined once for the pair');
  assert.match(css, /\.hub-home-actions \.hub-home-cta:active\{[^}]*background:var\(--er-primary-active\)/, 'press feedback is defined once for the pair');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{[^{]*\.hub-home-actions \.hub-home-cta/, 'motion is reduced, not merely shortened');
});

test('the home page reuses the existing card system, not a home-local one', () => {
  // The simulator-first layout reordered the page. It must not have brought its
  // own card: the study tools are the same link tile the home page already had
  // (er-mini-link + the shared identity mark), and no home-local card CSS may
  // exist to drift from it.
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /className=\{`er-mini-link \$\{identityClassFor\(title, 'service'\)\}`\}/, 'the tile is the shared MySchool-style link tile');
  assert.match(home, /<CardIdentityMark value=\{title\} type="service" size="sm" \/>/, 'it carries the shared identity mark');
  assert.match(home, /className="er-test-strip"/, 'it sits in the existing tile strip');
  assert.doesNotMatch(home, /hub-home-tool/, 'the home page has no bespoke card class');

  const homeCss = read('src/home-card-first.css');
  assert.doesNotMatch(homeCss, /hub-home-tool/, 'the home sheet defines no card surface of its own');

  // The appearance comes from the shared rule, so a future edit to the tile
  // reaches the home page too instead of leaving a copy behind.
  const portal = read('src/edu-portal.css');
  const tile = /\.er-mini-link\{([^}]*)\}/.exec(portal);
  assert.ok(tile, 'the shared link tile rule exists');
  assert.match(tile[1], /border:1px solid #dfe4ea/, 'the tile keeps its existing border');
  assert.match(tile[1], /border-radius:10px/, 'the tile keeps its existing radius');
  // The hover accent is the card-identity colour (.er-identity-card:hover), which
  // is how every existing identity card behaves; this page does not override it.
  assert.match(portal, /\.er-identity-card:hover\{[^}]*--er-card-accent/, 'the identity accent still owns the card hover');
});

test('the MySchool card CSS survives in the stylesheet that owns it', () => {
  const myschool = read('src/myschool-clean.css');
  const tile = /\.ms-top-tile \{([^}]*)\}/.exec(myschool);
  assert.ok(tile, 'the MySchool top tile is still defined');
  assert.match(tile[1], /background: #ffffff/, 'its surface is untouched');
  assert.match(tile[1], /border: 1px solid #e2e8f0/, 'its border is untouched');
  assert.match(tile[1], /border-radius: 12px/, 'its radius is untouched');
  const card = /\.ms-service-card \{([^}]*)\}/.exec(myschool);
  assert.ok(card, 'the MySchool service card is still defined');
  assert.match(card[1], /background: #ffffff/, 'its surface is untouched');
});

test('the shared home action stays readable in every state', () => {
  const luminance = (hex: string): number => {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (a: string, b: string): number => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  // 4.5:1 is AA for the 14px label. The resting fill is the lightest of the
  // three, so passing it covers hover and pressed as well.
  assert.ok(contrast('#174A3A', '#ffffff') >= 4.5, 'resting button');
  assert.ok(contrast('#123A2D', '#ffffff') >= 4.5, 'hover');
  assert.ok(contrast('#0E3025', '#ffffff') >= 4.5, 'pressed');
});

test('the home resume card is lazy, signed-in only and follows the shared expiry rule', () => {
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /lazy\(\(\) => import\('\.\.\/src\/components\/ContinuePracticeCard'\)\)/, 'the card is code-split');
  assert.match(home, /\{isAuthenticated && \(/, 'guests do not download it');
  const card = read('src/components/ContinuePracticeCard.tsx');
  assert.match(card, /selectResumableAttempt\(/, 'the decision is the tested rule, not a local status check');
  assert.match(card, /\/cbt\/session\/\$\{encodeURIComponent\(attempt\.id\)\}/, 'it goes straight into the attempt');
});

test('the setup screen keeps internal review counts in the admin console', () => {
  const setup = read('pages/ExamSetupPage.tsx');
  assert.doesNotMatch(setup, /bank\.review\.approved/, 'students do not see editorial counts');
  assert.doesNotMatch(setup, /editorially approved/, 'approval progress is an admin statistic');
  assert.match(setup, /These are practice questions, not certified official past papers\./, 'the honesty note replaces the counts');
});
