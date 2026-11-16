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

test('the dashboard leads with priorities, removes redundant action cards and groups recent activity', () => {
  const page = read('pages/StudentDashboardV2.tsx');
  assert.match(page, /dashboardPriorities\(/, 'the strip is derived from the shared rule');
  const priorityIndex = page.indexOf('dash-priority');
  const notificationsIndex = page.indexOf('id="dashboard-notifications"');
  const recentIndex = page.indexOf('Recent activity');
  assert.ok(priorityIndex > -1 && notificationsIndex > -1 && recentIndex > -1);
  assert.ok(priorityIndex < notificationsIndex && notificationsIndex < recentIndex, 'priorities and notifications precede recent activity');
  assert.match(page, /Service requests/);
  assert.match(page, /CBT results/);
  assert.doesNotMatch(page, /dash-quick-card|Saved profile details|dash-profile-detail-grid/, 'large shortcuts and duplicated profile fields are removed');
  assert.doesNotMatch(page, /Verified student/, 'an authenticated account is not mislabeled as verified');
  const welcome = page.slice(page.indexOf('const overview ='), page.indexOf('dash-priority'));
  assert.doesNotMatch(welcome, /jamb_reg_no|matric_number|authUser\?\.email/, 'sensitive profile identifiers are not repeated on the overview');
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
  assert.match(page, /er-card-arrow/, 'the card action is a thin arrow; the status chips carry the wording');
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
  assert.match(page, /FilterSearch/, 'the list uses the shared filter search');
  const field = read('src/components/ui/FilterSearch.tsx');
  assert.match(field, /type="search"/, 'the shared field is still a real search input');
  assert.match(page, /filter\(isArticleCurrent\)/, 'expired stories are removed from the board');
  assert.match(page, /new Date\(b\.published_at \|\| 0\)\.getTime\(\) - new Date\(a\.published_at \|\| 0\)\.getTime\(\)/, 'the newest current stories are listed first');
  assert.match(page, /newsCategorySlug\(raw\)/, 'category links resolve through the one canonicaliser');
  assert.ok(!/legacyCategoryAliases/.test(page), 'the duplicate alias map is gone');
});

test('home simulators are fetched from the live bank catalogue and keep their exact bank id', () => {
  const grid = read('src/components/ExamSimulatorGrid.tsx');
  assert.match(grid, /fetchCbtExamsWithAvailability\(\)/, 'the server returns public banks with live availability');
  assert.match(grid, /setExams\(live\)/, 'only actual catalogue rows become cards');
  assert.doesNotMatch(grid, /MAIN_EXAM_NAMES|mainExams|staticMain/, 'there are no invented fallback banks');
  assert.match(grid, /simulatorStartHref\(exam\.mode, exam\.id\)/, 'each card routes to the exact exam bank it represents');
  assert.match(grid, /No active public question banks are connected/, 'an empty catalogue is disclosed honestly');
  assert.match(grid, /er-card-arrow/, 'the only card action is the thin arrow');
  assert.ok(grid.includes('`/cbt/practice?exam=${encodeURIComponent(examId)}`'), 'less common exam types still retain the bank id');
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
  // The compact bar still uses the readable dark surface. Measured on #0f172a:
  // #94a3b8 6.96, #8fa0b5 6.68, #cbd5e1 12.02, #fff 17.85.
  const css = read('src/edu-portal.css');
  const footer = css.slice(css.indexOf('.er-footer{'), css.indexOf('.er-legal-page{'));
  assert.match(footer, /\.er-footer\{background:#0f172a;color:#94a3b8/, 'the footer sets its readable base colour');
  assert.ok(!/#64748b/.test(footer), 'no low-contrast slate is introduced anywhere in the footer');
  for (const pair of ['#8fa0b5', '#cbd5e1']) {
    assert.ok(footer.includes(pair), `${pair} is a documented footer text colour`);
  }
  assert.match(footer, /padding-bottom:calc\(12px \+ env\(safe-area-inset-bottom\)\)/, 'the bar clears the phone safe area');
  assert.doesNotMatch(footer, /er-footer-grid|er-footer-bottom|er-footer-about/, 'the old multi-row footer is gone');
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

test('the home page opens as a product screen, not a hero', () => {
  const home = read('pages/HubHomePage.tsx');

  // The home screen is an application surface: a greeting and study actions;
  // attempt history and scored student results belong in the dashboard.
  assert.match(home, /className="hub-home-container er-home-app"/, 'the product home shell exists');
  assert.doesNotMatch(home, /er-home-intro|er-home-proof|er-home-steps|er-home-actions/, 'no hero block survives');
  assert.doesNotMatch(home, /Practise the exam you are sitting\./, 'the slogan is gone');
  assert.match(home, /className="er-home-greeting"/, 'the first line is the student greeting');
  for (const action of ['Start practice', 'Past questions', 'My CBT']) {
    assert.ok(home.includes(action), `the ${action} control is on the first screen`);
  }
  assert.match(home, /HomeNewsSection/, 'the home page restores its public news feed');
  assert.doesNotMatch(home, /Results|score|recentHomeAttempts|summarizeHomeActivity|fetchCbtHistory|cbt-result-/, 'student results and attempt history never render on home');
  assert.doesNotMatch(home, /er-home-record|er-home-activity|ContinuePracticeCard/, 'personal result and attempt widgets are absent from home');

  // Exactly one h1 remains, hidden for structure and screen readers; the
  // visible greeting is an h2. A page without a heading is an accessibility
  // regression, not a simplification.
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1, 'exactly one h1');
  assert.match(home, /<h1 className="er-visually-hidden">/, 'it is the screen-reader heading');
  assert.match(home, /<h2 className="er-home-greeting" id="er-home-title">/, 'the visible title is a section heading');
  assert.match(read('src/edu-portal.css'), /\.er-visually-hidden\{position:absolute/, 'the class really hides it visually');

  // The headline scale is product-sized, not landing-page-sized.
  const product = read('src/styles/ux5-product.css');
  const greeting = /\.er-home-greeting \{([^}]*)\}/.exec(product);
  assert.ok(greeting, 'the greeting has a rule');
  assert.match(greeting![1], /clamp\(21px, 2\.2vw, 26px\)/, 'it tops out at 26px');
  assert.doesNotMatch(product, /clamp\(28px, 3\.4vw, 44px\)/, 'the 44px hero headline is deleted');
});

test('home shows current news with a retryable feed and a route to all stories', () => {
  const news = read('src/components/HomeNewsSection.tsx');
  assert.match(news, /fetchNews\(\)/, 'the section uses published news from the shared API');
  assert.match(news, /NewsRow/, 'the feed uses the established news row component');
  assert.match(news, /href="\/news"/, 'readers can open all news');
  assert.match(news, /ErrorState error=\{error\} onRetry/, 'a failed feed has a recovery path');
  assert.match(news, /No current news yet/, 'an empty news catalogue is not mistaken for a failure');
});

test('the account trigger uses initials on desktop and mobile, not a name beside navigation', () => {
  const layout = read('src/components/HubLayout.tsx');
  assert.match(layout, /className="hub-profile-trigger-initials"/, 'the trigger contains initials');
  assert.doesNotMatch(layout, /className="hub-profile-trigger-name"/, 'no visible name is rendered in the trigger');
  const styles = read('src/cbt-engine.css');
  assert.match(styles, /\.hub-profile-trigger-initials\{display:inline-grid/, 'initials show by default, including desktop');
  assert.match(styles, /\.hub-profile-trigger-name\{display:none\}/, 'the name beside the trigger is hidden');
});

test('the home page keeps the shared search bar and it still searches', () => {
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /<SiteSearch\s+variant="home"/, 'the shared search component is present');
  const search = read('src/components/SiteSearch.tsx');
  assert.match(search, /role="search"/, 'it is announced as a search landmark');
  assert.match(search, /aria-label=\{label\}/, 'the field keeps its accessible name');
  assert.match(home, /placeholder="Search services or exams"/, 'the prompt describes searchable content in four words');

  // It sits above the exam catalogue, which is what "on the home screen" means
  // once the greeting and the four actions take the first line.
  const searchAt = home.indexOf('<SiteSearch');
  assert.ok(searchAt > home.indexOf('<h1'), 'the heading stays first for structure');
  assert.ok(searchAt < home.indexOf('aria-label="Choose your exam"'), 'search is above the exam cards');

  const styles = read('src/site-search.css');
  assert.match(styles, /@media \(max-width: 1040px\) \{ \.site-search--header \{ display: none; \} \}/, 'the header search is desktop-only');
  assert.match(styles, /\.site-search \{[^}]*min-height: 48px/, 'every placement uses the same touch-friendly height');
  assert.doesNotMatch(styles, /\.site-search--(?:header|home|page|drawer|dashboard) \{[^}]*min-height/, 'variants do not change the control height');
  assert.match(styles, /\.site-search input \{[^}]*min-width: 0/, 'the field shrinks instead of overflowing on a phone');
});

test('the home page does not repeat the practice shortcut as a banner', () => {
  const home = read('pages/HubHomePage.tsx');
  assert.doesNotMatch(home, /className="er-banner"/, 'the study-centre banner is gone');
  assert.doesNotMatch(home, /jamb-cbt-banner\.webp/, 'its artwork is not reloaded');
  assert.doesNotMatch(home, /EDUREACH STUDY CENTRE/, 'the duplicate practice card is gone');
  assert.doesNotMatch(home, /hub-home-footer-callout/, 'the second services CTA is gone');
});

test('the portal search submit keeps a neutral non-primary treatment', () => {
  const styles = read('src/site-search.css');
  const submit = /\.site-search > button\[type="submit"\] \{([^}]*)\}/.exec(styles);
  assert.ok(submit, 'the shared search submit has a rule');
  assert.match(submit[1], /background: #f1f5f9/, 'the submit uses a quiet neutral surface');
  assert.match(submit[1], /color: #334155/, 'the submit text stays readable');
  assert.doesNotMatch(submit[1], /var\(--er-primary\)|#b14933/i, 'search is not styled like a primary action');
});

test('study tools are inline links, not another row of cards', () => {
  // UX-7: utilities are not destinations. They use one compact link list and
  // do not re-introduce the identity-card tile that this page no longer needs.
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /className="er-home-tool-list"/, 'the tools are a link list');
  assert.match(home, /toolLinks\.map/, 'the list is driven by one source');
  assert.doesNotMatch(home, /er-mini-link|er-test-strip|CardIdentityMark/, 'no card tile is rebuilt on the home page');

  const product = read('src/styles/ux5-product.css');
  const link = /\.er-home-tool-list a \{([^}]*)\}/.exec(product);
  assert.ok(link, 'the link row has a rule');
  assert.match(link![1], /min-height: 44px/, 'each link is a touch-sized target');
  assert.match(link![1], /border: 1px solid var\(--er-border\)/, 'it uses the shared border token');

  // The shared card system still owns the cards that remain.
  const portal = read('src/edu-portal.css');
  const tile = /\.er-mini-link\{([^}]*)\}/.exec(portal);
  assert.ok(tile, 'the shared link tile rule survives for other screens');
  assert.match(portal, /\.er-identity-card:hover\{[^}]*--er-card-accent/, 'the identity accent still owns its card hover');
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

test('the setup screen keeps internal review counts in the admin console', () => {
  const setup = read('pages/ExamSetupPage.tsx');
  assert.doesNotMatch(setup, /bank\.review\.approved/, 'students do not see editorial counts');
  assert.doesNotMatch(setup, /editorially approved/, 'approval progress is an admin statistic');
  assert.match(setup, /These are practice questions, not certified official past papers\./, 'the honesty note replaces the counts');
});

test('every app shell shows the same five bottom destinations on a phone', () => {
  // UX-7: navigation is a product constant. The public shell and the dashboard
  // used to swap five different labels when a student crossed into the account
  // area, which made the app feel like two products.
  const labels = ['Home', 'Practice', 'My CBT', 'Results', 'Profile'];
  for (const file of ['src/components/HubLayout.tsx', 'pages/StudentDashboardV2.tsx']) {
    const source = read(file);
    assert.match(source, /<nav className="er-mobile-bottom-nav" aria-label="Mobile navigation">/, `${file} uses the shared bottom bar`);
    for (const label of labels) {
      assert.ok(source.includes(`<span>${label}</span>`), `${file} labels its ${label} destination`);
    }
    assert.doesNotMatch(source, /<span>CBT<\/span>|<span>Account<\/span>|<span>Services<\/span>/, `${file} keeps the five product labels`);
  }
  // Icons are familiar and every one of these destinations keeps its label.
  assert.match(read('src/components/HubLayout.tsx'), /<BookOpenCheck size=\{18\}/, 'Practice carries its familiar icon');
  // The bar is reachable at tablet widths too, where the dashboard hides its sidebar.
  assert.match(read('src/edu-portal.css'), /@media\(max-width:768px\)\{\s*body:not\(\.er-exam-mode\) \.hub-shell\{padding-bottom/, 'the bar appears while the sidebar is hidden');
});
