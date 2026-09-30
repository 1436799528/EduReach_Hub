/**
 * Editorial lexicon shared by relevance classification, category routing and
 * near-duplicate "same event" detection.
 *
 * The weights and categories are editorial policy, not magic numbers: they say
 * what EduReach considers a Nigerian student update. Keep this file in review
 * with the newsroom runbook (docs/NEWSROOM_PIPELINE.md) when the policy changes.
 */

export type CategoryRule = { category: string; terms: string[] };

/**
 * Weighted terms for "is this relevant to a Nigerian tertiary student?".
 * 3 = the story is almost certainly about our audience, 1 = supporting signal.
 */
export const RELEVANCE_TERMS: Record<string, number> = {
  // Examinations and admissions
  jamb: 3, utme: 3, 'post-utme': 3, 'post utme': 3, waec: 3, neco: 3, nabteb: 3,
  'jamb cbt': 3, 'admission list': 3, 'admission letter': 3, admissions: 3, admission: 3,
  'cut-off mark': 3, 'cutoff mark': 3, 'cut-off marks': 3, 'cutoff marks': 3,
  'screening exercise': 3, 'post utme screening': 3, 'supplementary admission': 3,
  'matriculation': 2, convocation: 2, 'change of institution': 3, 'jamb profile': 3,
  'jamb portal': 3, 'caps': 1, 'result checker': 2, 'exam slip': 3, 'jamb slip': 3,

  // Student finance and support
  nelfund: 3, 'student loan': 3, 'students loan': 3, 'education loan': 3, bursary: 3,
  scholarship: 3, scholarships: 3, grant: 2, grants: 2, 'tuition fee': 3, 'school fees': 3,
  'fee hike': 3, 'fee increase': 2, 'work-study': 2, tETFUND: 2, tetfund: 2,

  // Institutions and academic life
  university: 2, universities: 2, polytechnic: 2, polytechnics: 2, 'college of education': 2,
  'federal university': 3, 'state university': 3, 'private university': 2, 'nuc': 2,
  'national universities commission': 3, 'nbte': 3, undergraduate: 2,
  postgraduate: 1, 'hnd': 2, 'nysc': 2, 'academic calendar': 3, 'resumption date': 3,
  resumption: 2, semester: 2, 'session': 1, 'strike': 2, asuu: 3, 'aSUU': 3,
  'lecturers': 2, 'gce': 2, 'ssce': 2, 'neco gce': 3, 'internal examination': 1,
  'cbT': 2, 'computer based test': 2, 'computer-based test': 2, 'mock exam': 2,

  // Opportunities
  internship: 2, 'graduate trainee': 2, fellowship: 2, competition: 1, 'fully funded': 2,
  'application deadline': 2, 'portal opens': 2, 'portal closes': 2, deadline: 2,
  'call for applications': 2, 'apply now': 1,

  // Nigerian context
  nigeria: 2, nigerian: 3, "nigeria's": 2, 'federal ministry of education': 3,
  'fg': 1, 'federal government': 2, 'nigerian students': 3, 'students in nigeria': 3,
  lagos: 1, abuja: 1, 'kano': 1, 'ibadan': 1, 'port harcourt': 1, 'enugu': 1, 'jos': 1,
  'zaria': 1, 'ilorin': 1, 'benin city': 1, 'abeokuta': 1, 'maiduguri': 1, 'calabar': 1,
  'owerri': 1, 'uyo': 1, 'akure': 1, 'sokoto': 1, 'bauchi': 1, 'minna': 1, 'makurdi': 1,

  // Actions that make a story actionable for a student
  registration: 2, registrations: 2, 'registration deadline': 3, result: 1, results: 1,
  released: 2, 'has released': 2, portal: 2, timetable: 2, 'exam timetable': 3,
  screening: 2, 'closes': 1, 'opens': 1, 'extended': 2, 'postponed': 2, 'cancelled': 2,
  'notice': 1, 'announces': 1, 'announcement': 1, 'guidelines': 1, 'requirements': 1,
};

/**
 * Topical terms that disqualify a story unless it also carries real relevance
 * weight. A general news feed is mostly these, and EduReach is not a general
 * news site.
 */
export const OFF_TOPIC_TERMS = [
  'betting', 'bet9ja', 'sportybet', 'premier league', 'super eagles', 'afcon',
  'nollywood', 'big brother', 'bbnaija', 'album', 'afrobeats', 'music video',
  'celebrity', 'actor', 'actress', 'billionaire', 'crypto', 'bitcoin',
  'forex', 'betting odds', 'horoscope', 'recipe', 'fashion week',
];

/** Category routing, in priority order — the first match with the highest weight wins. */
export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'nelfund', terms: ['nelfund', 'student loan', 'students loan', 'education loan', 'loan scheme'] },
  { category: 'jamb', terms: ['jamb', 'utme', 'jamb cbt', 'jamb portal', 'jamb profile', 'caps', 'change of institution', 'jamb slip', 'exam slip', 'mock'] },
  { category: 'post-utme', terms: ['post-utme', 'post utme', 'screening exercise', 'post-utme screening', 'screening'] },
  { category: 'waec', terms: ['waec', 'wassce', 'west african examinations council'] },
  { category: 'neco', terms: ['neco'] },
  { category: 'nabteb', terms: ['nabteb'] },
  { category: 'scholarships', terms: ['scholarship', 'scholarships', 'bursary', 'grant', 'grants', 'fully funded', 'sponsorship', 'tETFUND', 'tetfund'] },
  { category: 'universities', terms: ['university', 'universities', 'nuc', 'national universities commission', 'vice chancellor', 'faculty of', 'department of'] },
  { category: 'polytechnics', terms: ['polytechnic', 'polytechnics', 'nbte', 'hnd', 'national diploma'] },
  { category: 'colleges-of-education', terms: ['college of education', 'colleges of education', 'ncc e'] },
  { category: 'academic-calendar', terms: ['academic calendar', 'resumption date', 'resumption', 'semester', 'session', 'timetable'] },
  { category: 'examination-updates', terms: ['examination', 'examinations', 'exam', 'result', 'results', 'released', 'malpractice', 'cbt'] },
  { category: 'school-updates', terms: ['students', 'campus', 'students union', 'hostel', 'matriculation', 'convocation'] },
  { category: 'admissions', terms: ['admission', 'admissions', 'admission list', 'admission letter', 'supplementary admission', 'cutoff', 'cut-off'] },
];

/**
 * Entity/action extraction for "same event, different headline" detection.
 * Two headlines that agree on at least two entities, one action and land
 * within a few days of each other are treated as the same story.
 */
export const EVENT_ENTITIES = [
  'jamb', 'utme', 'waec', 'neco', 'nabteb', 'nelfund', 'nuc', 'nbte', 'tetfund',
  'asuu', 'nysc', 'federal ministry of education', 'national assembly', 'senate',
  'university of lagos', 'unilag', 'ui', 'uniben', 'abu', 'unilag', 'oau', 'unn',
  'futa', 'lasu', 'abu zaria', 'babcock', 'covenant university', 'yaba college',
  'kaduna polytechnic', 'federal polytechnic',
];

export const EVENT_ACTIONS = [
  'registration', 'registrations', 'deadline', 'result', 'results', 'released',
  'announces', 'announced', 'opens', 'opened', 'closes', 'closed', 'extended',
  'postponed', 'cancelled', 'suspends', 'suspended', 'resumes', 'approves',
  'approved', 'rejects', 'approve', 'warns', 'directs', 'begins', 'ends',
  'screening', 'admission', 'admissions', 'list', 'portal', 'timetable', 'cutoff',
  'requirements', 'guidelines', 'fee', 'fees', 'loan', 'loans', 'scholarship',
];

/** Normalises variants that mean the same entity or action. */
export const TERM_ALIASES: Record<string, string> = {
  'post utme': 'post-utme',
  universities: 'university',
  polytechnics: 'polytechnic',
  'cut-off': 'cutoff',
  'cut-off marks': 'cutoff',
  'cut-off mark': 'cutoff',
  'cutoff marks': 'cutoff',
  'students loan': 'student loan',
  admissions: 'admission',
  scholarships: 'scholarship',
  grants: 'grant',
  loans: 'loan',
  fees: 'fee',
  results: 'result',
  registrations: 'registration',
  examinations: 'examination',
  exams: 'exam',
};
