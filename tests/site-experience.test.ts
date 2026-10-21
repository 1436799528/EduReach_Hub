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

test('the dark footer keeps every text pair above 4.5:1 on navy', () => {
  // Phase 8 moved the footer from inline styles in HubLayout to a component with
  // its own rules, so the assertion follows it. Measured on #0f172a:
  // #94a3b8 6.96, #8fa0b5 6.68, #7d8ca3 5.23, #cbd5e1 12.02, #86efac 12.71.
  const css = read('src/edu-portal.css');
  const footer = css.slice(css.indexOf('.er-footer{'), css.indexOf('.er-legal-page{'));
  assert.match(footer, /\.er-footer\{background:#0f172a;color:#94a3b8/, 'the footer sets its readable base colour');
  assert.ok(!/#64748b/.test(footer), 'no low-contrast slate is introduced anywhere in the footer');
  for (const pair of ['#8fa0b5', '#7d8ca3']) {
    assert.ok(footer.includes(pair), `${pair} is a documented footer text colour`);
  }
  const component = read('src/components/SiteFooter.tsx');
  assert.doesNotMatch(component, /color:\s*'#/, 'the footer does not override its colours inline');
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

test('the home page has no promotional hero, only the working page', () => {
  const home = read('pages/HubHomePage.tsx');

  // Removed on request: the simulator-first hero and its Start practising /
  // Past questions pair duplicated navigation the cards already provide.
  assert.doesNotMatch(home, /hub-home-intro/, 'the hero section is gone');
  assert.doesNotMatch(home, /hub-home-cta|Start practising/, 'its call-to-action pair is gone');
  assert.doesNotMatch(home, /Practise the exam you are sitting/, 'and so is the promotional line');

  // The page keeps exactly one h1 for structure, hidden as it was before the
  // rewrite. A page without a heading is an accessibility regression, not a
  // simplification.
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1, 'exactly one h1');
  assert.match(home, /<h1 className="er-visually-hidden">/, 'it is the screen-reader heading');
  assert.match(read('src/edu-portal.css'), /\.er-visually-hidden\{position:absolute/, 'the class really hides it visually');

  // The styles are gone with the markup, from every sheet that set them.
  for (const sheet of ['src/home-card-first.css', 'src/compact-design-system.css', 'src/compact-structural.css']) {
    assert.doesNotMatch(read(sheet), /hub-home-intro|hub-home-cta|hub-home-actions/, `${sheet} no longer carries hero rules`);
  }
});

test('the home page keeps the portal search bar and it still searches', () => {
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /<form[^>]*className="er-search"/, 'the portal search form is back');
  assert.match(home, /role="search"/, 'it is announced as a search landmark');
  assert.match(home, /aria-label="Search services"/, 'the field keeps its accessible name');
  assert.match(home, /placeholder="Search services: NELFUND, result checking, JAMB slips…"/, 'the prompt is the original one');
  assert.match(home, /useState\(''\)/, 'the search term is component state');
  assert.match(home, /navigateInApp\(`\/search\?q=\$\{encodeURIComponent\(search\.trim\(\)\)\}`\)/, 'submitting goes to the shared search page');
  assert.match(home, /if \(search\.trim\(\)\)/, 'an empty submit does nothing');

  // It sits above every card, which is what "top of the homepage" means once
  // the simulator hero has the first line.
  const searchAt = home.indexOf('className="er-search"');
  assert.ok(searchAt > home.indexOf('<h1'), 'the heading stays first for structure');
  assert.ok(searchAt < home.indexOf('className="er-banner"'), 'the card follows the search bar');
  assert.ok(searchAt < home.indexOf('Choose your exam'), 'search is above the exam cards');

  // The header search disappears under 1040px, so this bar is the only search
  // a phone gets - that is why it may not be dropped.
  const portal = read('src/edu-portal.css');
  assert.match(portal, /@media\(max-width:1040px\)\{\.hub-global-search\{display:none\}\}/, 'the header search is desktop-only');
  assert.match(portal, /\.er-search\{[^}]*display:flex/, 'the portal bar is a flex row at every width');
  assert.match(portal, /\.er-search input\{[^}]*min-width:0/, 'the field shrinks instead of overflowing on a phone');
});

test('the study-centre card is restored as one click, not a menu', () => {
  const home = read('pages/HubHomePage.tsx');
  const start = home.indexOf('<a href="/past-questions" className="er-banner">');
  assert.ok(start > -1, 'the study-centre card is back');
  const card = home.slice(start, home.indexOf('</a>', start) + 4);
  assert.match(card, /EDUREACH STUDY CENTRE/, 'it keeps its kicker');
  assert.match(card, /Past questions &amp; CBT practice/, 'and its title');
  assert.match(card, /jamb-cbt-banner\.webp/, 'and its artwork');
  assert.match(card, /loading="lazy"/, 'the thumbnail stays lazy');
  // One click: the whole card is the link, with nothing nested inside it.
  assert.doesNotMatch(card, /<button/, 'no start-practice button inside the card');
  assert.equal((card.match(/<a\b/g) ?? []).length, 1, 'the card is a single anchor, with no second link inside it');
  assert.doesNotMatch(card, /pdf/i, 'no PDF list inside the card');
  assert.doesNotMatch(card, /start practi/i, 'no start-practice action inside the card');
});

test('the portal red is the search submit colour, not green', () => {
  const theme = read('src/styles/theme.css');
  const token = (name: string): string => {
    const match = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(theme);
    assert.ok(match, `${name} is a token`);
    return match[1].toUpperCase();
  };
  assert.equal(token('--er-brand-red'), '#C02220', 'the authored red is centralised');
  assert.equal(token('--er-brand-red-hover'), '#A81C1B', 'and its hover step');

  const portal = read('src/edu-portal.css');
  const submit = /\.er-search button\{([^}]*)\}/.exec(portal);
  assert.ok(submit, 'the submit has a rule');
  assert.match(submit[1], /background:var\(--er-brand-red\)/, 'the submit is the portal red');
  assert.doesNotMatch(submit[1], /--er-primary/, 'it is not the green action colour');
  assert.doesNotMatch(portal, /#c02220/, 'the red is never typed again as a literal');

  // White on that red still clears AA, at rest and on hover.
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
  assert.ok(contrast('#FFFFFF', token('--er-brand-red')) >= 4.5, 'white on the search submit');
  assert.ok(contrast('#FFFFFF', token('--er-brand-red-hover')) >= 4.5, 'white on its hover');
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
