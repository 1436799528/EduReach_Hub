/**
 * UX-5 wireframe generator.
 *
 * These are structural wireframes, not screenshots. Each artifact shows the
 * desktop (1280) and mobile (390) arrangement of one screen: hierarchy,
 * navigation placement, content regions, and primary/secondary actions.
 *
 * Run: node scripts/ux5-wireframes.mjs
 * Output: docs/design/ux-5/wireframes/*.svg + index.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'docs/design/ux-5/wireframes';
mkdirSync(OUT, { recursive: true });

const W = 1280;
const H = 900;
const M = 390;
const MH = 844;
const GAP = 40;
const PAD = 24;

// Region shorthand. `tone` encodes hierarchy, `kind` the control type.
const r = (x, y, w, h, label, kind = 'block', tone = 1) => ({ x, y, w, h, label, kind, tone });

const nav = (mobile = false) => mobile
  ? [r(0, 0, M, 56, 'Header · logo · menu', 'nav', 2)]
  : [r(0, 0, W, 64, 'Global header · wordmark · primary nav · search · account', 'nav', 2)];

const mobileBar = (active = 'Home') => [
  r(0, MH - 64, M, 64, `Bottom nav · Home · News · CBT · Services · ${active}`, 'nav', 2),
];

const studentScreens = [
  {
    id: 'home', group: 'Student', title: 'Homepage — decide where to start',
    intent: 'A first-time visitor identifies the platform and starts a practice paper in one tap.',
    desktop: [
      ...nav(), r(0, 64, W, 64, 'Search · one field, one submit', 'input', 1),
      r(64, 144, 760, 264, 'Hero · “Practice the exam you are sitting” · primary CTA “Start CBT practice” · secondary “Past questions”', 'hero', 3),
      r(848, 144, 368, 264, 'Next step for signed-in student · resume unfinished paper', 'card', 2),
      r(64, 440, 1152, 48, 'Section head · Choose your exam', 'head', 2),
      r(64, 500, 1152, 176, 'Four exam cards · neutral surface, one accent edge · name · bank status · start', 'grid', 1),
      r(64, 700, 560, 150, 'Study tools · calculator · CGPA · schools', 'grid', 1),
      r(648, 700, 568, 150, 'Updates · 2 current headlines', 'grid', 1),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 56, 'Search', 'input', 1),
      r(16, 144, M - 32, 252, 'Hero · headline · primary CTA full width · secondary link', 'hero', 3),
      r(16, 412, M - 32, 88, 'Resume card (signed in only)', 'card', 2),
      r(16, 516, M - 32, 40, 'Choose your exam', 'head', 2),
      r(16, 564, M - 32, 300, 'Exam cards · stacked, compact, 88–104 px each', 'grid', 1),
      ...mobileBar('Home'),
    ],
    changes: ['Visible page title and purpose', 'One primary action above the fold', 'Neutral exam cards, status instead of decoration', 'No duplicate study-tool tile'],
  },
  {
    id: 'dashboard', group: 'Student', title: 'Student dashboard — what to do next',
    intent: 'A signed-in student sees their next action, their numbers, and recent activity without reading three empty states.',
    desktop: [
      ...nav(), r(64, 88, 232, 560, 'Sidebar · Overview · Requests · My CBT · Tools · Academic profile', 'nav', 2),
      r(320, 88, 896, 88, 'Page head · “Overview” · greeting · primary CTA “Start practice”', 'head', 3),
      r(320, 192, 896, 96, 'Next step panel · one recommended action with reason', 'card', 3),
      r(320, 304, 896, 108, 'Metric strip · Average score · Papers · Open requests · Study streak', 'grid', 2),
      r(320, 428, 440, 220, 'Recent CBT · last 3 attempts with score and subject', 'list', 1),
      r(776, 428, 440, 220, 'Requests + notifications · compact rows, one CTA each', 'list', 1),
      r(320, 664, 896, 120, 'Getting started checklist (only while profile incomplete)', 'card', 1),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 74, 'Page head · Overview · greeting', 'head', 3),
      r(16, 160, M - 32, 92, 'Next step panel', 'card', 3),
      r(16, 264, M - 32, 160, 'Metric grid 2×2', 'grid', 2),
      r(16, 440, M - 32, 220, 'Recent CBT list', 'list', 1),
      r(16, 676, M - 32, 96, 'Requests summary', 'list', 1),
      ...mobileBar('Account'),
    ],
    changes: ['Person name is a greeting, not the page title', 'One recommendation replaces three stacked empty boxes', 'Metrics capped at four'],
  },
  {
    id: 'mycbt', group: 'Student', title: 'My CBT — performance in plain language',
    intent: 'A student reads their average, trend and weakest subject, then starts the recommended paper.',
    desktop: [
      ...nav(), r(64, 88, 232, 560, 'Dashboard sidebar', 'nav', 2),
      r(320, 88, 896, 84, 'Page head · “My CBT” · one-sentence summary · “Start practice”', 'head', 3),
      r(320, 188, 440, 160, 'Primary metric · Average score · papers scored · trend chip', 'card', 3),
      r(776, 188, 440, 160, 'Secondary metrics · best · latest · accuracy', 'grid', 2),
      r(320, 364, 896, 236, 'Score trend · line chart with labelled last point', 'chart', 1),
      r(320, 616, 896, 180, 'Subject breakdown · ranked bars with “practise next” link', 'grid', 1),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 78, 'Page head · My CBT · Start practice', 'head', 3),
      r(16, 164, M - 32, 132, 'Average score card', 'card', 3),
      r(16, 308, M - 32, 180, 'Secondary metrics 2×2', 'grid', 2),
      r(16, 500, M - 32, 190, 'Trend chart', 'chart', 1),
      r(16, 702, M - 32, 180, 'Subject list', 'grid', 1),
      ...mobileBar('Account'),
    ],
    changes: ['Sentence-case section labels', 'Explanation moved behind “How this is calculated”', 'One primary number'],
  },
  {
    id: 'cbt-setup', group: 'Student', title: 'CBT setup — choose paper with confidence',
    intent: 'A student understands the rules, picks subjects, sees time and question count, and starts without surprises.',
    desktop: [
      ...nav(), r(64, 88, 1152, 76, 'Page head · exam identity · “JAMB practice” · back link', 'head', 3),
      r(64, 184, 760, 132, 'Instruction strip · 3 numbered rules · time · questions · autosave', 'card', 1),
      r(64, 336, 760, 340, 'Subject selection · grouped checkboxes with availability', 'form', 2),
      r(64, 696, 760, 64, 'Validation / bank status line', 'notice', 1),
      r(848, 184, 368, 380, 'Sticky summary · subjects chosen · questions · time · “Start paper”', 'card', 3),
      r(848, 588, 368, 140, 'What happens next · result saved · resume rules', 'card', 1),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 76, 'Page head · exam · back', 'head', 3),
      r(16, 160, M - 32, 92, 'Instruction summary · collapsible', 'card', 1),
      r(16, 264, M - 32, 360, 'Subject selection list', 'form', 2),
      r(0, MH - 128, M, 64, 'Sticky summary · 4 subjects · 120 min', 'card', 3),
      r(0, MH - 64, M, 64, 'Sticky primary action · Start paper', 'cta', 3),
    ],
    changes: ['Summary is sticky and visible while choosing', 'Bank availability explained before the click', 'Mobile start action within thumb reach'],
  },
  {
    id: 'exam', group: 'Student', title: 'Examination — calm, single-focus paper',
    intent: 'A student answers, navigates and submits without losing time or state.',
    desktop: [
      r(0, 0, W, 64, 'Exam bar · exam · timer · saved indicator · submit', 'nav', 3),
      r(64, 80, 836, 760, 'Question card · number · subject · prompt · options', 'form', 2),
      r(924, 80, 292, 420, 'Question palette · answered / flagged / current', 'grid', 1),
      r(924, 520, 292, 150, 'Paper summary · answered count · flags', 'card', 1),
      r(924, 690, 292, 150, 'Submit panel · “Review before submitting”', 'card', 2),
    ],
    mobile: [
      r(0, 0, M, 56, 'Exam bar · timer · menu', 'nav', 3),
      r(16, 72, M - 32, 520, 'Question · options full width, 48 px targets', 'form', 2),
      r(0, MH - 128, M, 64, 'Question palette drawer handle', 'grid', 1),
      r(0, MH - 64, M, 64, 'Previous · Flag · Next', 'nav', 2),
    ],
    changes: ['Timer and saved state always visible', 'Options use full tap targets', 'Palette available without leaving the paper'],
  },
  {
    id: 'results', group: 'Student', title: 'Results — understand the outcome',
    intent: 'A student knows their score, what it means, and the next useful step.',
    desktop: [
      ...nav(), r(64, 88, 1152, 116, 'Result head · exam · date · score ring · band label', 'head', 3),
      r(64, 228, 560, 240, 'Breakdown · correct / wrong / skipped by subject', 'chart', 1),
      r(648, 228, 568, 240, 'What this means · 2 short observations', 'card', 1),
      r(64, 492, 560, 200, 'Answer review list · filter by wrong', 'list', 1),
      r(648, 492, 568, 200, 'Next step · recommended paper, retry, share', 'card', 2),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 150, 'Result head · score ring', 'head', 3),
      r(16, 238, M - 32, 200, 'Subject breakdown', 'chart', 1),
      r(16, 454, M - 32, 120, 'What this means', 'card', 1),
      r(16, 590, M - 32, 150, 'Next step card', 'card', 2),
      ...mobileBar('Account'),
    ],
    changes: ['One score hierarchy instead of six equal cards', 'Outcome language replaces statistic jargon'],
  },
  {
    id: 'profile', group: 'Student', title: 'Profile — edit with context',
    intent: 'A student sees completeness, edits grouped information, saves, and sees the saved state.',
    desktop: [
      ...nav(), r(64, 88, 288, 420, 'Profile card · avatar · name · completeness ring · public link', 'card', 2),
      r(376, 88, 840, 88, 'Page head · “Academic profile” · save state · Save changes', 'head', 3),
      r(376, 192, 840, 520, 'Form groups · Personal · Academic · Contact · Preferences', 'form', 2),
      r(376, 728, 840, 64, 'Sticky save bar · unsaved changes · Cancel · Save', 'cta', 3),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 120, 'Compact identity · avatar · completeness', 'card', 2),
      r(16, 208, M - 32, 60, 'Page head · Academic profile', 'head', 3),
      r(16, 284, M - 32, 440, 'Form groups, one column', 'form', 2),
      r(0, MH - 128, M, 64, 'Sticky unsaved indicator', 'notice', 1),
      r(0, MH - 64, M, 64, 'Sticky Save changes', 'cta', 3),
    ],
    changes: ['Progress and actions share one header', 'Bottom bar never covers fields (safe-area aware)', 'Groups replace one long card'],
  },
  {
    id: 'notifications', group: 'Student', title: 'Notifications — status you can act on',
    intent: 'A student scans unread updates and opens the related request or result.',
    desktop: [
      ...nav(), r(64, 88, 1152, 76, 'Page head · Notifications · mark all read · filter All/Unread', 'head', 3),
      r(64, 184, 760, 520, 'Notification list · unread dot · title · one-line body · relative time · action', 'list', 1),
      r(848, 184, 368, 260, 'Preferences · which events notify me', 'card', 1),
      r(848, 468, 368, 236, 'Quiet state · no new notifications', 'card', 1),
    ],
    mobile: [
      ...nav(true), r(16, 72, M - 32, 70, 'Page head · Notifications · Mark all read', 'head', 3),
      r(16, 156, M - 32, 60, 'Filter chips', 'grid', 1),
      r(16, 232, M - 32, 500, 'Notification rows · 88 px each', 'list', 1),
      ...mobileBar('Account'),
    ],
    changes: ['Unread and read are visually distinct', 'Each notification carries the action it refers to'],
  },
];

const adminScreens = [
  {
    id: 'admin-overview', group: 'Admin', title: 'Admin overview — platform state at a glance',
    intent: 'An administrator sees workload, risk and recent activity in one screen.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar · console name · environment · view site · account', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar · Overview · People · Learning · Requests · Content · System', 'nav', 2),
      r(280, 84, 936, 84, 'Page head · Operations overview · date · quick actions', 'head', 3),
      r(280, 192, 936, 120, 'Attention row · failed jobs · unverified banks · overdue requests', 'grid', 3),
      r(280, 328, 456, 200, 'Activity chart · last 14 days', 'chart', 1),
      r(760, 328, 456, 200, 'Workload by team · queue counts', 'grid', 1),
      r(280, 548, 936, 260, 'Recent admin actions · actor · action · target · time', 'list', 1),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar · menu · title', 'nav', 2),
      r(16, 72, M - 32, 84, 'Page head · Operations overview', 'head', 3),
      r(16, 172, M - 32, 176, 'Attention cards stacked', 'grid', 3),
      r(16, 364, M - 32, 180, 'Activity chart', 'chart', 1),
      r(16, 560, M - 32, 200, 'Recent actions', 'list', 1),
    ],
    changes: ['Attention before analytics', 'Grouped navigation with one active section'],
  },
  {
    id: 'admin-nav', group: 'Admin', title: 'Admin navigation — grouped by job',
    intent: 'An administrator finds a section by the job they are doing, not by database table.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 288, 840, 'Sidebar · Overview', 'nav', 1),
      r(0, 220, 288, 210, 'People · Students · Staff · Profiles', 'nav', 2),
      r(0, 430, 288, 210, 'Learning · Question banks · Questions · Exams · Imports', 'nav', 2),
      r(0, 640, 288, 150, 'Requests & content · Services · News · Opportunities', 'nav', 2),
      r(0, 790, 288, 110, 'System · Settings · Security · Audit log', 'nav', 2),
      r(320, 88, 896, 240, 'Explanatory panel · what each group is for', 'card', 1),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar · menu', 'nav', 2),
      r(0, 56, M, 788, 'Full-screen drawer · groups · search · current section', 'nav', 2),
    ],
    changes: ['38 flat links become 5 job groups', 'Search within navigation for uncommon sections'],
  },
  {
    id: 'admin-users', group: 'Admin', title: 'Users — find, inspect, act',
    intent: 'An administrator finds a student, understands their state, and takes a safe action.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar', 'nav', 2),
      r(280, 84, 936, 80, 'Page head · Students · export · invite', 'head', 3),
      r(280, 180, 936, 64, 'Toolbar · search · role filter · status filter · count', 'input', 2),
      r(280, 260, 936, 420, 'Table · student · role · status · joined · last active · row actions', 'table', 1),
      r(280, 692, 936, 60, 'Pagination · range · page size', 'nav', 1),
      r(760, 76, 456, 640, 'Detail drawer (on selection) · identity · requests · CBT · actions', 'card', 3),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar', 'nav', 2),
      r(16, 72, M - 32, 76, 'Page head · Students', 'head', 3),
      r(16, 160, M - 32, 56, 'Search + filter button', 'input', 2),
      r(16, 228, M - 32, 480, 'Stacked records · name · role · status · key action', 'list', 1),
      r(0, MH - 64, M, 64, 'Filter sheet trigger · “Filters”', 'cta', 2),
    ],
    changes: ['Desktop table keeps columns; mobile becomes records', 'Row action opens a drawer instead of a new page'],
  },
  {
    id: 'admin-questions', group: 'Admin', title: 'Question management — review safely',
    intent: 'An administrator filters questions, inspects one, and edits with provenance visible.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar · Learning', 'nav', 2),
      r(280, 84, 936, 80, 'Page head · Questions · import · new question', 'head', 3),
      r(280, 180, 936, 64, 'Toolbar · bank · subject · status · search', 'input', 2),
      r(280, 260, 600, 520, 'Question list · prompt excerpt · subject · bank · status', 'list', 1),
      r(896, 260, 320, 520, 'Editor / preview · stem · options · answer · explanation · provenance', 'form', 2),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar', 'nav', 2),
      r(16, 72, M - 32, 70, 'Page head · Questions', 'head', 3),
      r(16, 154, M - 32, 56, 'Search', 'input', 2),
      r(16, 222, M - 32, 480, 'Question cards · tap opens editor', 'list', 1),
      r(0, MH - 64, M, 64, 'Sticky · Import questions', 'cta', 2),
    ],
    changes: ['Editor is a side panel, list keeps place', 'Provenance is visible while editing'],
  },
  {
    id: 'admin-exams', group: 'Admin', title: 'Examination management — publish with confidence',
    intent: 'An administrator sees bank health, subject counts and publication state before publishing.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar · Learning', 'nav', 2),
      r(280, 84, 936, 80, 'Page head · CBT banks · new bank', 'head', 3),
      r(280, 180, 936, 120, 'Health summary · published · draft · below threshold', 'grid', 3),
      r(280, 316, 936, 380, 'Bank cards · exam · subjects · questions · time · status · open', 'grid', 1),
      r(280, 712, 936, 100, 'Publish checklist · what blocks a bank', 'card', 1),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar', 'nav', 2),
      r(16, 72, M - 32, 70, 'Page head · CBT banks', 'head', 3),
      r(16, 154, M - 32, 120, 'Health summary', 'grid', 3),
      r(16, 290, M - 32, 460, 'Bank cards stacked', 'grid', 1),
      r(0, MH - 64, M, 64, 'Sticky · New bank', 'cta', 2),
    ],
    changes: ['Publish blockers visible', 'Counts grouped as health, not decoration'],
  },
  {
    id: 'admin-services', group: 'Admin', title: 'Service requests — work the queue',
    intent: 'An administrator sees requests needing action, opens one, and changes status with a reason.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar · Requests', 'nav', 2),
      r(280, 84, 936, 80, 'Page head · Service requests', 'head', 3),
      r(280, 180, 936, 72, 'Queue tabs · Needs action · In progress · Completed · All', 'nav', 2),
      r(280, 268, 600, 500, 'Request rows · reference · service · student · status · age', 'list', 1),
      r(896, 268, 320, 500, 'Detail · request data · status control · reason · notify student', 'form', 2),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar', 'nav', 2),
      r(16, 72, M - 32, 70, 'Page head · Requests', 'head', 3),
      r(16, 154, M - 32, 52, 'Queue tabs scroll', 'nav', 2),
      r(16, 218, M - 32, 500, 'Request cards', 'list', 1),
    ],
    changes: ['Queue is ordered by need, not newest', 'Status changes require a reason and notify the student'],
  },
  {
    id: 'admin-content', group: 'Admin', title: 'Content — publish and verify',
    intent: 'An administrator sees what is live, what is scheduled, and what needs review.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar · Content', 'nav', 2),
      r(280, 84, 936, 80, 'Page head · Content · new article', 'head', 3),
      r(280, 180, 936, 72, 'State tabs · Published · Scheduled · Needs review · Archived', 'nav', 2),
      r(280, 268, 936, 460, 'Content table · title · type · source · state · updated · actions', 'table', 1),
      r(280, 744, 936, 100, 'Bulk actions bar', 'nav', 1),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar', 'nav', 2),
      r(16, 72, M - 32, 70, 'Page head · Content', 'head', 3),
      r(16, 154, M - 32, 52, 'State chips', 'nav', 2),
      r(16, 218, M - 32, 500, 'Content cards', 'list', 1),
    ],
    changes: ['State is a tab, not a column to scan', 'Source and verification are first-class'],
  },
  {
    id: 'admin-settings', group: 'Admin', title: 'System settings — explain consequences',
    intent: 'An administrator changes a setting and understands its blast radius.',
    desktop: [
      r(0, 0, W, 60, 'Admin top bar', 'nav', 2),
      r(0, 60, 248, 840, 'Sidebar · System', 'nav', 2),
      r(280, 84, 936, 80, 'Page head · Settings · environment badge', 'head', 3),
      r(280, 180, 248, 620, 'Settings nav · General · Access · Notifications · Data', 'nav', 1),
      r(552, 180, 664, 620, 'Setting groups · label · control · helper · Save bar', 'form', 2),
    ],
    mobile: [
      r(0, 0, M, 56, 'Admin bar', 'nav', 2),
      r(16, 72, M - 32, 70, 'Page head · Settings', 'head', 3),
      r(16, 154, M - 32, 52, 'Settings section selector', 'nav', 1),
      r(16, 218, M - 32, 480, 'Setting groups stacked', 'form', 2),
      r(0, MH - 64, M, 64, 'Sticky Save', 'cta', 3),
    ],
    changes: ['Consequence text sits under the control it describes', 'Danger zone separated from routine settings'],
  },
];

const tones = {
  1: { fill: '#FFFFFF', stroke: '#CBD5E1', text: '#334155' },
  2: { fill: '#F1F5F9', stroke: '#94A3B8', text: '#1E293B' },
  3: { fill: '#E7EFEA', stroke: '#174A3A', text: '#123C2F' },
};
const kindFill = {
  nav: '#0F172A', head: '#E7EFEA', hero: '#DCE9E2', cta: '#174A3A', table: '#F8FAFC',
  card: '#FFFFFF', grid: '#FFFFFF', list: '#FFFFFF', chart: '#FFFFFF', form: '#FFFFFF',
  input: '#FFFFFF', notice: '#FEF3C7', block: '#FFFFFF',
};

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(text, max) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { if (line) lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function drawRegion(region, scale, offsetX, offsetY) {
  const { x, y, w, h, label, kind, tone } = region;
  const lowered = label.toLowerCase();
  const isNav = kind === 'nav' && tone >= 2 && (lowered.includes('header') || lowered.includes('bar') || lowered.includes('nav'));
  const fill = kind === 'cta' ? '#174A3A' : (isNav ? '#0F172A' : (kindFill[kind] || tones[tone].fill));
  const stroke = kind === 'cta' ? '#174A3A' : tones[tone].stroke;
  const text = kind === 'cta' || isNav ? '#F8FAFC' : tones[tone].text;
  const X = offsetX + x * scale;
  const Y = offsetY + y * scale;
  const ww = w * scale;
  const hh = h * scale;
  const lines = wrap(label, Math.max(14, Math.floor(ww / (7.2 * Math.max(scale, 0.55)))));
  const lineH = 12;
  return `
  <g>
    <rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${ww.toFixed(1)}" height="${hh.toFixed(1)}" rx="${kind === 'cta' ? 6 : 4}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    ${lines.slice(0, Math.max(1, Math.floor((hh - 10) / lineH))).map((line, i) => `<text x="${(X + 8).toFixed(1)}" y="${(Y + 16 + i * lineH).toFixed(1)}" font-family="Inter, Arial, sans-serif" font-size="${(8.6).toFixed(1)}" font-weight="${kind === 'head' ? 700 : 500}" fill="${text}">${esc(line)}</text>`).join('')}
  </g>`;
}

function screenSvg(screen) {
  const scale = 0.55;
  const width = PAD * 2 + W * scale + GAP + M * scale;
  const height = PAD * 2 + 44 + Math.max(H, MH) * scale + 96;
  const desktop = screen.desktop.map(region => drawRegion(region, scale, PAD, PAD + 44));
  const mobileX = PAD + W * scale + GAP;
  const mobile = screen.mobile.map(region => drawRegion(region, scale, mobileX, PAD + 44));
  const annotations = screen.changes.map((c, i) => `<text x="${PAD}" y="${(PAD + 44 + H * scale + 34 + i * 18).toFixed(1)}" font-family="Inter, Arial, sans-serif" font-size="10.5" fill="#475467">• ${esc(c)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(0)}" height="${height.toFixed(0)}" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" role="img" aria-label="Wireframe: ${esc(screen.title)}">
  <rect width="100%" height="100%" fill="#F8FAFC"/>
  <text x="${PAD}" y="${PAD + 8}" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="#0F172A">${esc(screen.title)}</text>
  <text x="${PAD}" y="${PAD + 26}" font-family="Inter, Arial, sans-serif" font-size="10.5" fill="#475467">${esc(screen.intent)}</text>
  <text x="${PAD}" y="${PAD + 42}" font-family="Inter, Arial, sans-serif" font-size="9" font-weight="600" fill="#64748B" letter-spacing=".08em">DESKTOP 1280</text>
  <text x="${mobileX}" y="${PAD + 42}" font-family="Inter, Arial, sans-serif" font-size="9" font-weight="600" fill="#64748B" letter-spacing=".08em">MOBILE 390</text>
  <rect x="${PAD - 4}" y="${PAD + 44 - 4}" width="${W * scale + 8}" height="${H * scale + 8}" fill="#FFFFFF" stroke="#E2E8F0"/>
  <rect x="${mobileX - 4}" y="${PAD + 44 - 4}" width="${M * scale + 8}" height="${MH * scale + 8}" fill="#FFFFFF" stroke="#E2E8F0"/>
  ${desktop.join('')}
  ${mobile.join('')}
  ${annotations}
</svg>`;
}

const screens = [...studentScreens, ...adminScreens];
for (const screen of screens) writeFileSync(`${OUT}/${screen.id}.svg`, screenSvg(screen));

const cards = screens.map(s => `<a class="card" href="${s.id}.svg"><span class="tag">${s.group}</span><strong>${esc(s.title)}</strong><p>${esc(s.intent)}</p></a>`).join('\n');
writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EduReach UX-5 wireframes</title>
<style>body{margin:0;background:#F7F9F8;color:#0F172A;font:15px/1.6 Inter,Arial,sans-serif}header{padding:40px 24px 8px;max-width:1080px;margin:auto}h1{margin:0 0 6px;font-size:30px;letter-spacing:-.02em}header p{margin:0;color:#475467;max-width:720px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;max-width:1080px;margin:24px auto 60px;padding:0 24px}.card{display:block;padding:18px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;color:inherit;text-decoration:none}.card:hover{border-color:#174A3A}.tag{display:inline-block;margin-bottom:8px;padding:2px 8px;border-radius:999px;background:#EDF5F0;color:#174A3A;font-size:11px;font-weight:600}.card strong{display:block;font-size:15px}.card p{margin:6px 0 0;font-size:12.5px;color:#475467}</style>
<header><h1>EduReach UX-5 wireframes</h1><p>Structural wireframes for the student and administrator applications. Greyscale regions describe hierarchy and placement; they are deliberately not screenshots of the current build.</p></header><div class="grid">${cards}</div></html>`);

console.log(`Wrote ${screens.length} wireframes to ${OUT}`);
