import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { daysUntil, isFeedVisible, lifecycleOf } from '../lib/opportunityLifecycle';
import { cleanReviewText, parseReviewDraft, REVIEW_TEXT_MAX } from '../lib/reviewPolicy';
import { splitLegalSections } from '../src/lib/legalSections';
import { listingLifecycle } from '../src/lib/listingLifecycle';
import { SCHOLARSHIP_SEED } from '../src/data/scholarshipSeed';
import { FAQ_CATEGORIES } from '../src/data/faq';

const read = (path: string) => readFileSync(path, 'utf8');
const AT = Date.parse('2026-11-22T12:00:00Z');

test('the server clock decides a listing state, not a stored flag', () => {
  assert.equal(lifecycleOf({ is_active: true, deadline: '2026-12-07' }, AT), 'active');
  // The deadline is today: still open for the rest of the day.
  assert.equal(lifecycleOf({ is_active: true, deadline: '2026-11-22' }, AT), 'active');
  assert.equal(lifecycleOf({ is_active: true, deadline: '2026-11-21' }, AT), 'expired');
  assert.equal(lifecycleOf({ is_active: true, deadline: '2026-11-21', opens_at: '2026-11-01' }, AT), 'expired');
  assert.equal(lifecycleOf({ is_active: true, opens_at: '2026-12-01', deadline: '2026-12-31' }, AT), 'upcoming');
  assert.equal(lifecycleOf({ is_active: true, expires_at: '2026-11-22T11:59:00Z' }, AT), 'expired');

  // Chosen publication states win over the dates.
  assert.equal(lifecycleOf({ is_active: true, status: 'archived', deadline: '2026-12-07' }, AT), 'archived');
  assert.equal(lifecycleOf({ is_active: true, closed_at: '2026-11-01T00:00:00Z' }, AT), 'archived');
  assert.equal(lifecycleOf({ is_active: false }, AT), 'archived');
  assert.equal(lifecycleOf({ is_active: true, published_at: '2026-12-01T00:00:00Z' }, AT), 'scheduled');

  // A missing or unparseable date is not evidence of being closed.
  assert.equal(lifecycleOf({ is_active: true }, AT), 'active');
  assert.equal(lifecycleOf({ is_active: true, deadline: 'not-a-date' }, AT), 'active');
  assert.equal(lifecycleOf({ is_active: true, expires_at: 'not-a-date' }, AT), 'active');
});

test('the default feed excludes closed and archived listings; the archive keeps them', () => {
  assert.equal(isFeedVisible('active'), true);
  assert.equal(isFeedVisible('upcoming'), true);
  assert.equal(isFeedVisible('expired'), false);
  assert.equal(isFeedVisible('archived'), false);
  assert.equal(isFeedVisible('scheduled'), false);
});

test('daysUntil is a whole-day count from the server clock', () => {
  assert.equal(daysUntil('2026-11-23', AT), 2);
  assert.equal(daysUntil(null, AT), null);
  assert.equal(daysUntil('not-a-date', AT), null);
});

test('the card label is derived, never "Latest" on a closed listing', () => {
  const open = listingLifecycle({ deadline: '2027-01-31' }, AT);
  assert.equal(open.label, 'Open');
  assert.equal(open.actionable, true);
  assert.match(open.detail, /31 Jan 2027/);

  const soon = listingLifecycle({ deadline: '2026-12-01' }, AT);
  assert.equal(soon.label, 'Closing Soon');
  assert.match(soon.detail, /9 days left/);

  const upcoming = listingLifecycle({ opens_at: '2026-12-01', deadline: '2027-01-31' }, AT);
  assert.equal(upcoming.label, 'Upcoming');
  assert.equal(upcoming.actionable, false);

  const closed = listingLifecycle({ deadline: '2026-11-01' }, AT);
  assert.equal(closed.label, 'Closed');
  assert.equal(closed.actionable, false);

  const archived = listingLifecycle({ status: 'archived', deadline: '2026-12-07' }, AT);
  assert.equal(archived.label, 'Closed');
  assert.equal(archived.actionable, false);

  const evergreen = listingLifecycle({ deadline: null }, AT);
  assert.equal(evergreen.label, 'Open');
  assert.equal(evergreen.daysLeft, null);
});

test('review submission is validated before it reaches the database', () => {
  assert.deepEqual(parseReviewDraft({ rating: 0, reviewText: 'x'.repeat(30) }), {
    ok: false,
    error: 'Choose a rating from 1 to 5 stars.',
  });
  assert.deepEqual(parseReviewDraft({ rating: 3.5, reviewText: 'x'.repeat(30) }), {
    ok: false,
    error: 'Choose a rating from 1 to 5 stars.',
  });
  assert.deepEqual(parseReviewDraft({ rating: 5, reviewText: 'too short' }), {
    ok: false,
    error: 'Write at least 20 characters about your experience.',
  });
  assert.deepEqual(parseReviewDraft({ rating: 5, reviewText: 'x'.repeat(30), examType: 'sitting' }), {
    ok: false,
    error: 'Choose a valid exam type or leave it blank.',
  });

  const ok = parseReviewDraft({ rating: 4, reviewText: '  Practised\nfor  three  weeks  ', examType: 'jamb' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.ok && ok.value, { rating: 4, reviewText: 'Practised for three weeks', examType: 'JAMB' });

  const blankExam = parseReviewDraft({ rating: 5, reviewText: 'x'.repeat(30), examType: '' });
  assert.equal(blankExam.ok, true);
  assert.equal(blankExam.ok && blankExam.value.examType, null);
});

test('review text is bounded and whitespace is collapsed, never trusted', () => {
  assert.equal(cleanReviewText('  a   b\n\nc '), 'a b c');
  assert.equal(cleanReviewText('x'.repeat(REVIEW_TEXT_MAX + 500)).length, REVIEW_TEXT_MAX);
  assert.equal(cleanReviewText(undefined), '');
});

test('a legal document is split into one card per top-level heading only', () => {
  const sections = splitLegalSections(
    '<p>Intro</p><h2>Using EduReach</h2><p>Body</p><h3>Sub</h3><h2>Your <em>account</em></h2><p>More</p>',
  );
  assert.deepEqual(
    sections.map((section) => [section.id, section.heading]),
    [
      ['introduction', null],
      ['using-edureach', 'Using EduReach'],
      ['your-account', 'Your account'],
    ],
  );
  assert.match(sections[1].html, /<h3>Sub<\/h3>/, 'a h3 stays inside its section');
  assert.ok(!sections[2].html.includes('<h2>'), 'the heading is not duplicated in the body');
  assert.deepEqual(splitLegalSections(''), []);
  assert.deepEqual(splitLegalSections('<p>Only prose</p>').map((s) => s.id), ['overview']);

  // Duplicate headings get distinct anchors instead of colliding ids.
  const repeated = splitLegalSections('<h2>Terms</h2>a<h2>Terms</h2>b');
  assert.deepEqual(repeated.map((s) => s.id), ['terms', 'terms-2']);
});

test('the reviewed scholarship seed matches its expiry dates and never invents an award', () => {
  const slugs = new Set<string>();
  for (const item of SCHOLARSHIP_SEED) {
    assert.ok(item.slug && !slugs.has(item.slug), `${item.slug} must be unique`);
    slugs.add(item.slug!);
    assert.match(String(item.link_url), /^https:\/\//, `${item.slug} links to an https source`);
    assert.ok(item.source_name, `${item.slug} names the provider source`);
    if (item.status !== 'archived') {
      assert.ok(item.verified_at, `${item.slug} records when it was verified`);
    }
    assert.ok(!/₦|N[0-9,]{6,}/.test(item.title), 'no amount is invented in a title');
  }
  const closed = SCHOLARSHIP_SEED.find((item) => item.slug === 'mtn-foundation-scholarship-2026');
  assert.ok(closed, 'the closed 2026 MTN cycle is kept as an archived record');
  assert.equal(closed!.status, 'archived');
  assert.equal(closed!.is_active, false);
  assert.equal(lifecycleOf(closed!, AT), 'archived');
  // Every live row is still live on the review date.
  for (const item of SCHOLARSHIP_SEED.filter((row) => row.status !== 'archived')) {
    assert.notEqual(lifecycleOf(item, AT), 'expired', `${item.slug} must not be expired on 2026-11-22`);
  }
});

test('the FAQ is grouped, complete and answerable', () => {
  const required = [
    'Account',
    'CBT simulator',
    'JAMB, WAEC, NECO and Post-UTME',
    'Past questions',
    'Scholarships',
    'Payments and access',
    'Privacy and security',
  ];
  assert.deepEqual(FAQ_CATEGORIES.map((group) => group.label), required);
  const ids = new Set<string>();
  for (const group of FAQ_CATEGORIES) {
    assert.ok(group.questions.length > 0, `${group.label} has answers`);
    for (const item of group.questions) {
      assert.ok(item.question.includes('?'), `${item.question} is a question`);
      assert.ok(item.answer.length > 40, `${item.question} is answered in a sentence`);
      assert.ok(!ids.has(item.id), `${item.id} is unique`);
      ids.add(item.id);
    }
  }
});

test('rating and question totals come from the API, never from a literal in the page', () => {
  const reviews = read('pages/ReviewsPage.tsx');
  assert.match(reviews, /Based on \{count\.toLocaleString\(\)\} approved review/);
  assert.match(reviews, /fetchReviews\(/, 'the page reads the API');
  assert.doesNotMatch(reviews, /\b4\.[0-9]\s*\/\s*5\b/, 'a rating is not hard-coded');

  const banks = read('src/components/admin/AdminQuestionBankOverview.tsx');
  assert.match(banks, /fetchAdminQuestionBanks\(/);
  assert.doesNotMatch(banks, /\b\d{2,}\s+questions\b/i, 'a count is not typed into the console');
  assert.match(banks, /No questions yet/, 'an empty bank says so');
});

test('the review and question-bank API routes keep their gates and their honest failures', () => {
  const server = read('server.ts');

  // Submitting requires a signed-in student who has actually used the product.
  const submit = server.slice(server.indexOf("app.post('/api/reviews'"), server.indexOf("app.get('/api/admin/reviews'"));
  assert.match(submit, /requireUser\(req, 'dashboard\.access'\)/);
  assert.match(submit, /parseReviewDraft\(req\.body\)/);
  assert.match(submit, /RATE_LIMIT_RULES\.reviewSubmit/);
  assert.match(submit, /status\(403\)[\s\S]{0,120}Complete a practice test or a service request first/);
  assert.match(submit, /error\.code === '23505'.*409/s, 'a duplicate review is a conflict, not a crash');
  assert.match(submit, /status: 'pending'/, 'an approved review is re-moderated after an edit');

  // Moderation is capability-gated, audited, and a missing row is a 404.
  const moderation = server.slice(server.indexOf("app.patch('/api/admin/reviews/:reviewId'"), server.indexOf("// Question-bank overview"));
  assert.match(moderation, /requireCapability\('review\.moderate'\)/);
  assert.match(moderation, /recordAudit\(/);
  assert.match(moderation, /status\(404\)\.json\(\{ error: 'Review not found\.' \}\)/);

  // The bank console reads the RPC, and says "not applied" instead of showing zeros.
  const banks = server.slice(server.indexOf("app.get('/api/admin/question-banks'"), server.indexOf('// PDF', server.indexOf("app.get('/api/admin/question-banks'")));
  assert.match(banks, /requireCapability\('cbt\.read'\)/);
  assert.match(banks, /rpc\('admin_question_bank_summary'\)/);
  assert.match(banks, /status\(503\)/);
});

test('an expired opportunity never reaches the active feed from the API', () => {
  const server = read('server.ts');
  const route = server.slice(server.indexOf("app.get('/api/opportunities'"), server.indexOf("app.get('/api/opportunities/:opportunityId'"));
  assert.match(route, /scope === 'archive'/);
  assert.match(route, /isFeedVisible\(/);
  assert.match(route, /lifecycleOf\(/);
});
