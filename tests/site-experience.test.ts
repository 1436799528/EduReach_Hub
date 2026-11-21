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
  const recentIndex = page.indexOf('dash-recent-activity');
  assert.ok(priorityIndex > -1 && recentIndex > -1 && priorityIndex < recentIndex, 'needs-attention precedes recent activity');
  // The notification panel moved into the persistent dashboard header, where it
  // is available from every tab instead of only the overview column. The order
  // rule that matters still holds: nothing personal sits above the priorities.
  assert.match(page, /<NotificationCenter variant="dashboard" \/>/, 'notifications stay in the dashboard chrome');
  assert.ok(page.indexOf('edureach-dash-header') < page.indexOf('{view}'), 'the header, and its bell, render above the tab content');
  assert.match(page, /service request/i, 'service-request status is still on the overview');
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
  assert.match(page, /state === 'expired' && <a className="dash-card-link" href="\/dashboard\/cbt">Start a new test/, 'an expired attempt points at a new test in the dashboard, not at the old one');
  assert.doesNotMatch(page, /state === 'expired'[^\n]*cbt\/session/, 'an expired attempt never links back into the session');
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

test('simulators are built from the live bank catalogue, never an invented list', () => {
  const grid = read('src/components/ExamSimulatorGrid.tsx');
  const data = read('src/data/simulators.ts');
  assert.match(grid, /fetchCbtExamsWithAvailability\(\)/, 'the server returns public banks with live availability');
  assert.match(grid, /setExams\(items\)/, 'only actual catalogue rows reach the builder');
  assert.doesNotMatch(grid, /MAIN_EXAM_NAMES|mainExams|staticMain/, 'there are no invented fallback banks');
  assert.match(data, /export function buildSimulatorCards/, 'one card per simulator is derived from those rows');
  assert.match(data, /simulatorStartHref\(group\.examType \|\| group\.label, deepest\?\.id\)/, 'each card carries its bank into the one route resolver');
  assert.match(grid, /No active public question banks are connected/, 'an empty catalogue is disclosed honestly');
  const card = read('src/components/SimulatorCard.tsx');
  assert.match(card, /er-card-arrow/, 'the only card action is the thin arrow');
  assert.match(data, /`\/cbt\/practice\?exam=\$\{encodeURIComponent\(examId\)\}`/, 'less common exam types still retain the bank id');
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
  assert.match(news, /from '\.\/NewsSections'/, 'the feed uses the established news components, not its own markup');
  assert.match(news, /<NewsCard key=\{item\.id\} item=\{item\} \/>/, 'each story renders through the shared card');
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

test('footer is static in document flow (not fixed or sticky) across all shared surfaces', () => {
  const cssFiles = [
    'src/edu-portal.css',
    'src/compact-structural.css',
    'src/hub.css',
    'src/styles/theme.css',
    'src/student-dashboard.css',
  ];
  for (const file of cssFiles) {
    const content = read(file);
    assert.doesNotMatch(content, /\.er-footer\s*\{[^}]*position:\s*(?:fixed|sticky)/i, `${file} does not make .er-footer fixed or sticky`);
  }
  const component = read('src/components/SiteFooter.tsx');
  assert.doesNotMatch(component, /position:\s*['"]?(?:fixed|sticky)/i, 'SiteFooter does not set fixed/sticky inline');
});

test('mobile menu trigger and profile controls are separated on opposite sides of the header', () => {
  const layout = read('src/components/HubLayout.tsx');
  const triggerIdx = layout.indexOf('className="hub-mobile-trigger"');
  const profileIdx = layout.indexOf('className="hub-profile-trigger"');
  assert.ok(triggerIdx !== -1, 'hub-mobile-trigger exists');
  assert.ok(profileIdx !== -1, 'hub-profile-trigger exists');
  assert.ok(triggerIdx < profileIdx, 'mobile menu trigger sits on the left (before profile controls on the right)');
  const brandIdx = layout.indexOf('className="hub-brand-link"');
  assert.ok(triggerIdx < brandIdx, 'mobile menu trigger is placed at the leading edge of the header row');

  // Verify dashboard header also separates menu toggle and profile button
  const dash = read('pages/StudentDashboardV2.tsx');
  const dashMenuIdx = dash.indexOf('className="edureach-menu-toggle"');
  const dashProfileIdx = dash.indexOf('className="edureach-dash-profile-btn"');
  assert.ok(dashMenuIdx !== -1, 'edureach-menu-toggle exists in dashboard');
  assert.ok(dashProfileIdx !== -1, 'edureach-dash-profile-btn exists in dashboard');
  assert.ok(dashMenuIdx < dashProfileIdx, 'dashboard menu toggle is on the left and profile button is on the right');
});

test('the home page keeps the shared search bar and it still searches', () => {
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /<SiteSearch\s+variant="header"/, 'the shared search component is present');
  assert.match(home, /import SiteSearch from '\.\.\/src\/components\/LazySiteSearch'/, 'home loads the shared search, lazily');
  const search = read('src/components/SiteSearch.tsx');
  assert.match(search, /role="search"/, 'it is announced as a search landmark');
  assert.match(search, /aria-label=\{label\}/, 'the field keeps its accessible name');
  assert.match(home, /placeholder="Search services or exams"/, 'the prompt describes searchable content in four words');

  // The search moved into the shared header (`HubLayout customSearch`) so it is
  // reachable from every surface, not only the top of the home body. The
  // structural rule it must not break is that the page still opens with its
  // (visually hidden) h1 and the exam catalogue below it.
  assert.match(home, /customSearch=\{<SiteSearch variant="header"/, 'the header slot carries the search');
  assert.ok(home.indexOf('<h1') < home.indexOf('er-home-head'), 'the heading stays first in the body');
  assert.ok(home.indexOf('aria-label="Choose your exam"') > -1, 'the exam catalogue is still on the page');

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

test('each navigation layer carries five destinations on a phone', () => {
  // The public shell and the dashboard are two different experiences, so they
  // have different navigation — but each one keeps five destinations, and the
  // student never loses the current page.
  const publicLayout = read('src/components/HubLayout.tsx');
  assert.match(publicLayout, /<nav className="er-mobile-bottom-nav" aria-label="Mobile navigation">/, 'the public shell uses the bottom bar');
  assert.match(publicLayout, /publicPrimaryNav\(path\)\.map/, 'driven by the five public primaries');
  for (const label of ['Home', 'Practice', 'Services', 'News', 'Scholarships']) {
    assert.ok(publicLayout.includes(`pub_${label}`) || publicLayout.includes(`label: '${label}'`), `the public bar can label ${label}`);
  }
  assert.match(publicLayout, /item\.href === '\/cbt'/, 'Practice carries its familiar icon');
  assert.match(publicLayout, /\? BookOpenCheck/, 'and that icon is the open book');

  const dashboard = read('pages/StudentDashboardV2.tsx');
  assert.match(dashboard, /<nav className="er-mobile-bottom-nav" aria-label="Mobile navigation">/, 'the dashboard uses the same bar');
  for (const label of ['Overview', 'CBT', 'Results', 'Profile', 'Tools']) {
    assert.ok(dashboard.includes(`<span>${label}</span>`), `the dashboard labels ${label}`);
  }
  assert.doesNotMatch(dashboard, /<span>My CBD<\/span>|<span>Requests<\/span>/, 'secondary functions stay out of the primary bar');
  // The bar is reachable at tablet widths too, where the dashboard hides its sidebar.
  assert.match(read('src/edu-portal.css'), /@media\(max-width:768px\)\{\s*body:not\(\.er-exam-mode\) \.hub-shell\{padding-bottom/, 'the bar appears while the sidebar is hidden');
});

test('current-page search fields suggest values from every field on the page', async () => {
  const { filterSearchSuggestions } = await import('../src/lib/searchMatch');
  const component = read('src/components/ui/FilterSearch.tsx');
  const admin = read('src/components/admin/AdminFilterSearch.tsx');
  const site = read('src/components/SiteSearch.tsx');
  const paths = [
    'pages/NewsPage.tsx',
    'pages/JobsPage.tsx',
    'pages/ServicesCatalogPage.tsx',
    'pages/PastQuestionsPage.tsx',
    'pages/SchoolFinderPage.tsx',
    'src/components/dashboard/SchoolFinderCard.tsx',
    'pages/AdminNewsPage.tsx',
    'pages/AdminSchoolsPage.tsx',
    'pages/AdminInstitutionIntelligencePage.tsx',
    'pages/AdminContentManagerPage.tsx',
    'pages/AdminCbtPage.tsx',
    'pages/AdminBankSecurityPage.tsx',
  ];
  assert.match(component, /role="combobox"/);
  assert.match(component, /aria-label=\{label\}/, 'the filter input carries the accessible name');
  assert.doesNotMatch(component, /role="search"\s+aria-label=\{label\}/, 'the landmark does not duplicate the input label');
  assert.match(component, /onBlur=/, 'focus leaving the field dismisses suggestions');
  assert.match(component, /aria-expanded=\{suggestionsOpen\}/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /aria-activedescendant/);
  const siteStyles = read('src/site-search.css');
  const filterStyles = read('src/styles/type-system.css');
  assert.match(siteStyles, /\.site-search-popover \{[^}]*pointer-events: none/, 'site search panels do not block results beneath them');
  assert.match(filterStyles, /\.er-filter-suggestions \{[^}]*pointer-events: none/, 'page filter panels do not block controls beneath them');
  assert.match(component, /ArrowDown/);
  assert.match(component, /ArrowUp/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /visibleSuggestions\[activeIndex\]/, 'Enter submits the active suggestion');
  assert.match(component, /filterSearchSuggestions\(suggestionItems, value/);
  assert.match(site, /const suggestionsEnabled = true/, 'page search keeps suggestions too');
  for (const path of paths) {
    const source = read(path);
    assert.match(source, /(?:suggestionItems|items)=\{/, `${path} supplies page-specific suggestions`);
    assert.match(source, /keywords:/, `${path} indexes its non-title fields`);
    assert.match(source, /suggestionLabel=/, `${path} names its suggestion set`);
  }
  const rows = [
    { id: 'one', title: 'WAEC news', category: 'Exam', description: 'Registration deadline', keywords: ['published', 'Editor'] },
    { id: 'two', title: 'Scholarship', category: 'Funding', description: 'Apply before May', keywords: ['draft', 'Admin'] },
  ];
  assert.deepEqual(
    filterSearchSuggestions(rows, 'dead').map((row) => row.id),
    ['one'],
    'a partial word inside a non-title field is found',
  );
  assert.deepEqual(filterSearchSuggestions(rows, 'may').map((row) => row.id), ['two']);
  assert.deepEqual(filterSearchSuggestions(rows, 'funding waec').map((row) => row.id), [], 'all tokens must match');
  assert.match(admin, /<FilterSearch/, 'admin filters inherit the shared combobox');
  assert.match(admin, /onSubmit\?: \(value: string\) => void/, 'server-backed forms can submit deliberately');
  assert.match(admin, /suggestionLimit=\{8\}/, 'admin lists offer a longer suggestion set');
});

test('mobile CBT subject tabs are centred and keyboard-navigable', () => {
  const page = read('pages/CbtSessionPage.tsx');
  const css = read('src/styles/ux5-product.css');
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-orientation="horizontal"/);
  assert.match(page, /tabIndex=\{current \? 0 : -1\}/, 'one roving tab stop');
  assert.match(page, /case 'ArrowRight'/, 'arrow keys move between subjects');
  assert.match(page, /case 'Home'/, 'Home jumps to the first subject');
  assert.match(page, /case 'End'/, 'End jumps to the last subject');
  assert.match(css, /\.er-exam-subject-tabs \{[\s\S]*?justify-content: center/, 'the row is centred');
  const home = read('pages/HubHomePage.tsx');
  assert.match(home, /er-home-dashboard-switch/, 'the public Home has a visible Dashboard switch');
  assert.match(css, /\.er-home-dashboard-switch/, 'and a compact shared style');
});
