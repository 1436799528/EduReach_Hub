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
