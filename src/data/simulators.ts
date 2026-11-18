/**
 * The CBT simulator catalogue.
 *
 * One source of truth for the examinations EduReach can simulate, their
 * display identity and the card they produce. The homepage, the Practice page
 * and the authenticated CBT tab all render from this module through the same
 * card component, so adding a question bank for a new examination body cannot
 * produce three differently-shaped destinations.
 *
 * Nothing here invents a simulator: a card exists only because the published
 * question-bank catalogue (GET /api/cbt/exams) returned a bank for that exam
 * body. The profiles below supply the *labels and descriptions* for the four
 * examination families EduReach knows; any other body keeps its own name.
 */

import { isStartableBank, type CatalogExam, type SetupExamKey } from '../lib/cbt-config';

export const SIMULATOR_EXAM_TYPES = ['jamb', 'waec', 'neco', 'post-utme'] as const;

export type SimulatorExamType = (typeof SIMULATOR_EXAM_TYPES)[number];

/**
 * Collapse every spelling a bank row can use for one examination onto a single
 * key. Colour, label and route are bound to this key, never to the order the
 * catalogue happens to return.
 */
export function simulatorExamType(mode: string): SimulatorExamType | null {
  const value = String(mode || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (value === 'jamb' || value === 'utme') return 'jamb';
  if (value === 'waec') return 'waec';
  if (value === 'neco') return 'neco';
  if (value === 'postutme') return 'post-utme';
  return null;
}

export type SimulatorProfile = {
  /** Small label printed on the card. */
  label: string;
  /** The simulator's name. */
  title: string;
  description: string;
  /** Existing brand mark used by the rest of the product. */
  logo: string;
  /** Setup wizard that owns this examination's workflow. */
  setupKey: SetupExamKey;
  /** Position in the catalogue: the four known families lead. */
  order: number;
};

/**
 * The four published simulator profiles. These describe features the product
 * actually implements (a configured session from a published bank); they are
 * not marketing claims.
 */
const PROFILES: Record<SimulatorExamType, SimulatorProfile> = {
  jamb: {
    label: 'JAMB',
    title: 'JAMB UTME',
    description: 'Four-subject UTME practice with Use of English, plus timed mocks.',
    logo: '/icons/brands/jamb.webp',
    setupKey: 'jamb',
    order: 0,
  },
  waec: {
    label: 'WAEC',
    title: 'WAEC SSCE',
    description: 'Subject-by-subject objective practice for the senior school certificate.',
    logo: '/icons/brands/waec.webp',
    setupKey: 'waec',
    order: 1,
  },
  neco: {
    label: 'NECO',
    title: 'NECO SSCE',
    description: 'Subject-by-subject practice built from the published NECO bank.',
    logo: '/icons/brands/neco.webp',
    setupKey: 'neco',
    order: 2,
  },
  'post-utme': {
    label: 'Post-UTME',
    title: 'Post-UTME screening',
    description: 'University screening practice, configured to each school’s subjects.',
    logo: '/icons/brands/jamb.webp',
    setupKey: 'post-utme',
    order: 3,
  },
};

/** URL-safe key for an examination body EduReach has no profile for. */
function slugFor(value: string): string {
  return String(value || 'cbt')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cbt';
}

export type SimulatorCardModel = {
  /** Stable key: the canonical exam type, or a slug of an unfamiliar body. */
  key: string;
  examType: SimulatorExamType | null;
  label: string;
  title: string;
  description: string;
  logo: string;
  href: string;
  /** A short, factual line about the bank behind the card. */
  meta: string;
  /** False when the catalogue holds a bank that cannot serve a session yet. */
  available: boolean;
  bankCount: number;
  questionCount: number | null;
};

type Group = {
  key: string;
  examType: SimulatorExamType | null;
  label: string;
  banks: CatalogExam[];
};

function groupKeyFor(exam: CatalogExam): { key: string; examType: SimulatorExamType | null; label: string } {
  const body = String(exam.exam_body || '').trim();
  const type = simulatorExamType(body) ?? simulatorExamType(String(exam.title || ''));
  if (type) return { key: type, examType: type, label: PROFILES[type].label };
  const label = body || String(exam.title || '').trim() || 'CBT';
  return { key: slugFor(label), examType: null, label };
}

function startableBanks(exam: CatalogExam, examType: SimulatorExamType | null): boolean {
  if (examType) return isStartableBank(exam, PROFILES[examType].setupKey);
  // Without availability counts the bank cannot be judged here; the setup page
  // remains the final arbiter.
  return typeof exam.question_count !== 'number' || exam.question_count >= 5;
}

/**
 * Group the published banks into one card per simulator.
 *
 * The four known families keep their published order. Any other examination
 * body the catalogue carries becomes its own card, sorted by name, and routes
 * through the legacy entry point that resolves its bank — so a new simulator
 * needs no code change to appear in Practice.
 */
export function buildSimulatorCards(exams: readonly CatalogExam[]): SimulatorCardModel[] {
  const groups = new Map<string, Group>();

  for (const exam of exams) {
    const { key, examType, label } = groupKeyFor(exam);
    const existing = groups.get(key);
    if (existing) {
      existing.banks.push(exam);
    } else {
      groups.set(key, { key, examType, label, banks: [exam] });
    }
  }

  const cards = [...groups.values()].map((group): SimulatorCardModel => {
    const profile = group.examType ? PROFILES[group.examType] : null;
    const startable = group.banks.filter((bank) => startableBanks(bank, group.examType));
    const questionCounts = group.banks
      .map((bank) => bank.question_count)
      .filter((count): count is number => typeof count === 'number' && Number.isFinite(count));
    const questionCount = questionCounts.length ? questionCounts.reduce((total, count) => total + count, 0) : null;
    const deepest = [...group.banks].sort((a, b) => (b.question_count ?? -1) - (a.question_count ?? -1))[0];
    const available = group.examType ? startable.length > 0 : group.banks.length > 0;

    // A known family enters its own setup wizard, carrying the bank the card
    // was built from so the wizard opens on that bank (it still resolves one
    // itself when the query is absent). An unfamiliar body keeps the exact bank
    // it came from through the legacy entry point.
    const href = simulatorStartHref(group.examType || group.label, deepest?.id);

    const bankLabel = `${group.banks.length} question bank${group.banks.length === 1 ? '' : 's'}`;
    return {
      key: group.key,
      examType: group.examType,
      label: group.label,
      title: profile?.title || `${group.label} CBT`,
      description: profile?.description
        || String(deepest?.description || '').trim()
        || 'Timed CBT practice from the published question bank.',
      logo: profile?.logo || '/icons/brands/jamb.webp',
      href,
      meta: available ? `Timed practice · ${bankLabel}` : 'Questions being prepared',
      available,
      bankCount: group.banks.length,
      questionCount,
    };
  });

  const rank = (card: SimulatorCardModel) => (card.examType ? PROFILES[card.examType].order : SIMULATOR_EXAM_TYPES.length);
  return cards.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

/** The filter row above the grid: "All exams" plus every simulator present. */
export type SimulatorFilter = { id: string; label: string };

export function simulatorFilters(cards: readonly SimulatorCardModel[]): SimulatorFilter[] {
  return [
    { id: 'ALL', label: 'All exams' },
    ...cards.map((card) => ({ id: card.key, label: card.label })),
  ];
}

/** Keep the catalogue honest when a filter matches nothing. */
export function filterSimulatorCards(cards: readonly SimulatorCardModel[], active: string): SimulatorCardModel[] {
  if (!active || active === 'ALL') return [...cards];
  return cards.filter((card) => card.key === active);
}

/**
 * Where a simulator's "start" action leads. Kept as a named export because the
 * CBT hall, the homepage cards and deep links all need the same answer.
 */
export function simulatorStartHref(mode: string, examId?: string): string {
  const type = simulatorExamType(mode);
  if (type) {
    const query = examId ? `?exam=${encodeURIComponent(examId)}` : '';
    return `/cbt/setup/${type}${query}`;
  }
  return examId ? `/cbt/practice?exam=${encodeURIComponent(examId)}` : '/cbt';
}

/**
 * Built-in homepage discovery cards.
 *
 * The public home page shows the four exam families immediately so testers can
 * see and open every simulator without waiting for the question-bank catalogue.
 * The destination setup page resolves the published bank only after a click.
 * Practice and the dashboard keep using the authoritative catalogue through
 * `buildSimulatorCards()`.
 */
export const BUILTIN_SIMULATOR_CARDS: SimulatorCardModel[] = SIMULATOR_EXAM_TYPES.map((examType) => {
  const profile = PROFILES[examType];
  return {
    key: examType,
    examType,
    label: profile.label,
    title: profile.title,
    description: profile.description,
    logo: profile.logo,
    href: simulatorStartHref(examType),
    meta: 'Timed practice',
    available: true,
    bankCount: 0,
    questionCount: null,
  };
});

/** Public copy shared by every surface that hosts the simulator grid. */
export const SIMULATOR_HUB_COPY = {
  practice: {
    title: 'Practice',
    lede: 'Every CBT simulator on EduReach in one place. Choose an exam to configure a session.',
  },
  home: {
    title: 'Choose your exam',
    lede: '',
  },
  dashboard: {
    title: 'CBT',
    lede: 'Choose a simulator to configure and start a timed session.',
  },
} as const;
