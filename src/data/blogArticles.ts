export type BlogArticle = {
  body: string[];
  source: string;
  updatedAt: string;
};

const sharedSource = 'EduReach Mock News Desk';

export const blogArticles: Record<string, BlogArticle> = {
  'nelfund-application-guide': {
    source: sharedSource,
    updatedAt: 'Sep 04, 2026',
    body: [
      'This is mock editorial content for the EduReach platform. It demonstrates how a funding update will be presented to students before verified live publishing is connected.',
      'Students should keep their personal and academic information organised before beginning any funding application. Read the requirements carefully and use the official portal for final submission.',
      'A good student checklist includes identity information, school details, programme information and any other items requested by the official process. Do not submit sensitive information through an unverified link.',
      'EduReach will clearly separate platform guidance from official announcements. When a live source is added, the article will show the publication source, publication date and update history.',
    ],
  },
  'jamb-slip-update': {
    source: sharedSource,
    updatedAt: 'Sep 03, 2026',
    body: [
      'This mock JAMB update shows the format EduReach will use for examination-related announcements.',
      'Before printing an examination slip, a student should review the candidate details shown on the document and keep a readable copy for reference.',
      'Check names, registration information, examination details and any venue information displayed on the document. Where something appears incorrect, use the official support channel rather than guessing.',
      'Any real examination date, centre or policy must be confirmed from official JAMB communication before a student acts on it.',
    ],
  },
  'waec-result-checking': {
    source: sharedSource,
    updatedAt: 'Sep 02, 2026',
    body: [
      'This is mock guidance for students checking a WAEC result.',
      'Students should confirm that they are using the correct result-checking details and should avoid sharing sensitive PINs, serial numbers or account information with other people.',
      'Take your time when entering examination information. A small typing error can lead to an unsuccessful check even when the correct details were purchased or issued.',
      'EduReach will provide the steps in simple language while directing students to the appropriate official result-checking service for final verification.',
    ],
  },
  'neco-result-checking': {
    source: sharedSource,
    updatedAt: 'Sep 01, 2026',
    body: [
      'This mock article demonstrates a NECO result guide inside EduReach.',
      'Prepare the examination information requested by the official checking service and check that every entry is correct before submitting.',
      'Keep a secure personal record after viewing the result, especially where the result may later be needed for admission, screening or registration.',
      'Do not post result-checking credentials publicly. Use the official channel for final confirmation whenever a decision depends on the result.',
    ],
  },
  'campus-gist-week': {
    source: 'EduReach Campus Desk',
    updatedAt: 'Aug 31, 2026',
    body: [
      'Campus Gist is one of EduReach’s fast-moving content categories, covering the conversations students are having around academic life.',
      'This mock edition focuses on registration pressure, result expectations, admission conversations and the daily realities students face on campus.',
      'Campus stories will be written for students first: easy to read, clear about what is confirmed, and careful not to turn rumours into facts.',
      'Real campus reports will be clearly identified, dated and linked to a source when live publishing is introduced.',
    ],
  },
  'admission-deferment-letter': {
    source: 'EduReach Mock Guides',
    updatedAt: 'Aug 30, 2026',
    body: [
      'This mock admission guide explains the structure students may use when preparing a deferment request.',
      'A student should clearly state the admission details, the reason for the request and any supporting information required by the institution.',
      'The strongest letters are usually clear, respectful and direct. Avoid adding claims or circumstances that cannot be supported.',
      'Institutional procedures differ, so EduReach will never present a general template as though it were an official university rule.',
    ],
  },
  'supplementary-admission': {
    source: sharedSource,
    updatedAt: 'Aug 29, 2026',
    body: [
      'This mock update is designed to help students think carefully before accepting a supplementary admission offer.',
      'Useful questions include the programme being offered, the response deadline, required payments and the next registration step.',
      'Students should also confirm whether accepting the offer changes any earlier admission decision or creates a separate registration process.',
      'Verify every important condition with the institution before making a final decision.',
    ],
  },
  'academic-calendar-alerts': {
    source: sharedSource,
    updatedAt: 'Aug 28, 2026',
    body: [
      'EduReach’s Academic Calendar Watch will collect important student dates into one easy-to-read update.',
      'Mock entries can include registration periods, examination windows, result release notices and other deadlines students commonly miss.',
      'Students should save important dates in a personal calendar and check for changes, because academic schedules can be revised by institutions.',
      'Before taking action, students should confirm final dates with their institution or the relevant official body.',
    ],
  },
  'school-fees-reminder': {
    source: 'EduReach Mock Guides',
    updatedAt: 'Aug 27, 2026',
    body: [
      'This mock student guide focuses on a simple habit: confirm deadlines early instead of waiting until the last day.',
      'Students should keep payment references, receipts or screenshots where appropriate and check that the institution has recorded the transaction.',
      'When a payment issue happens, gather the transaction details before contacting support. This makes the issue easier to trace.',
      'Never assume that a successful bank or payment message automatically means the school portal has updated. Confirm the school record where possible.',
    ],
  },
  'project-season-campus': {
    source: 'EduReach Campus Desk',
    updatedAt: 'Aug 26, 2026',
    body: [
      'Project season can make an already busy semester feel heavier. This mock campus piece focuses on organisation rather than panic.',
      'Breaking a project into smaller tasks, tracking deadlines and keeping supervisor feedback in one place can make the process easier to manage.',
      'Students can reduce last-minute pressure by setting personal deadlines before the official deadline and keeping copies of drafts and reference materials.',
      'EduReach can later turn this category into a regular campus column with contributions from verified student communities.',
    ],
  },
  'result-release-follow-up': {
    source: 'EduReach Mock Guides',
    updatedAt: 'Aug 25, 2026',
    body: [
      'This mock result guide covers the period after a student checks a result.',
      'Keep a secure copy of the result information and check whether your institution has additional steps for registration, screening, admission or result verification.',
      'Write down any follow-up deadline instead of relying on memory. A result may be available while the next school process is still pending.',
      'Do not assume that seeing a result online automatically completes every school requirement.',
    ],
  },
  'student-opportunities': {
    source: sharedSource,
    updatedAt: 'Aug 24, 2026',
    body: [
      'This mock opportunity roundup shows how EduReach can combine scholarships, skills opportunities, competitions and student programmes in one place.',
      'Students should check eligibility, deadline, application requirements and the official source before submitting any personal information.',
      'A useful opportunity tracker should also record whether an opportunity is open, closing soon, shortlisted or closed so students do not waste time on old listings.',
      'The future live version of this section will separate verified opportunities from community-submitted leads.',
    ],
  },
};
