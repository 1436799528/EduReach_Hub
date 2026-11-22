/**
 * The FAQ catalogue.
 *
 * Every answer describes behaviour the application actually has. Nothing here
 * promises a feature the code does not implement (refunds, automatic answer
 * marking by email, an approval guarantee), because a help page that over-claims
 * is worse than no help page: it is the first place a disappointed student
 * looks. Where the honest answer is "it depends on the exam body" or "contact
 * us", it says that.
 */

export interface FaqQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: string;
  label: string;
  description: string;
  questions: FaqQuestion[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'account',
    label: 'Account',
    description: 'Signing up, signing in and keeping your profile right.',
    questions: [
      {
        id: 'create-account',
        question: 'How do I create an account?',
        answer:
          'Open /register, enter your name, email and a password, then confirm your email address from the message we send. You can browse most of the site without an account; one is needed to sit a timed exam, save results, request a service or submit a review.',
      },
      {
        id: 'reset-password',
        question: 'How do I reset my password?',
        answer:
          'Use “Forgot password” on the sign-in page. We email a recovery link to the address on your account; the link expires, so use it promptly. If the email does not arrive, check the spam folder before contacting us.',
      },
      {
        id: 'update-profile',
        question: 'How do I update my profile?',
        answer:
          'Sign in and open Dashboard → Profile. Your school, department, level and matric number are used to match practice papers and past questions to your programme, so keep them accurate. Changes save to your account, not just to this browser.',
      },
      {
        id: 'profile-photo',
        question: 'How do I upload or change my profile photo?',
        answer:
          'Open Dashboard → Profile → Photo. The image must be a JPG, PNG or WebP under the size limit shown beside the control. The photo is stored on our media service and appears on your profile; you can replace it at any time.',
      },
    ],
  },
  {
    id: 'cbt',
    label: 'CBT simulator',
    description: 'How the practice hall behaves, and what happens when something goes wrong.',
    questions: [
      {
        id: 'how-cbt-works',
        question: 'How does the CBT simulator work?',
        answer:
          'Choose an exam body (JAMB, WAEC, NECO or Post-UTME), pick your subjects and start a paper. The timer counts down from the duration set for that paper. Questions come from the reviewed question bank for the subjects you selected; you answer, navigate between questions, and submit before time runs out.',
      },
      {
        id: 'practice-without-exam',
        question: 'Can I practise without taking a “real” exam?',
        answer:
          'Yes. Practice mode gives you immediate feedback after you submit and does not pretend to be an official examination. Guest practice is available for a short paper without an account; a signed-in attempt is saved to your results so you can compare later.',
      },
      {
        id: 'question-selection',
        question: 'How are questions selected?',
        answer:
          'The server builds each paper from approved questions in the selected exam body and subjects, following the paper rules for that exam (number of questions and duration). The same request decides the paper for every student, so refreshing the page does not reroll your questions.',
      },
      {
        id: 'change-answers',
        question: 'Can I change my answers?',
        answer:
          'Yes, while the paper is open. Select another option and the previous answer for that question is replaced. Answers are locked when you submit or when the timer reaches zero.',
      },
      {
        id: 'internet-drops',
        question: 'What happens if my internet connection drops?',
        answer:
          'Your answers and the paper are kept on this device, and the page tries to resync when the connection returns. If the connection stays down until time expires, the paper is sealed locally and submitted on reconnect; you do not lose answers you had already selected. Do not clear browser data or use private browsing during an exam.',
      },
      {
        id: 'auto-save',
        question: 'Are my answers saved automatically?',
        answer:
          'Yes. Each selection is written to local storage first and sent to the server as you go. The status line on the exam screen tells you whether the latest answer has reached the server, so you are not guessing.',
      },
      {
        id: 'submit-exam',
        question: 'How do I submit an examination?',
        answer:
          'Use “Submit” on the exam screen and confirm. You will see a summary of answered and unanswered questions before the paper closes. Submitting early is allowed; the remaining time is not added to your score.',
      },
      {
        id: 'review-previous',
        question: 'Can I review previous questions?',
        answer:
          'Yes. The question navigator lists every question and its state (answered, unanswered, flagged). Move back to any question while the paper is still open, or review the whole paper from the result screen after submission.',
      },
      {
        id: 'score-calculation',
        question: 'How is my score calculated?',
        answer:
          'Each correct answer adds the marks set for that question (one mark unless stated otherwise). The score is the total marks earned out of the total marks available, shown as a percentage. Unanswered questions earn nothing and are not penalised further.',
      },
    ],
  },
  {
    id: 'exams',
    label: 'JAMB, WAEC, NECO and Post-UTME',
    description: 'Subjects, paper structure and what the simulator does and does not copy.',
    questions: [
      {
        id: 'select-subjects',
        question: 'How do I select subjects?',
        answer:
          'On the practice setup screen, choose the subjects listed for that exam body. JAMB papers use Use of English plus your other chosen subjects. A paper needs at least one subject with approved questions available.',
      },
      {
        id: 'english-included',
        question: 'Is English automatically included where required?',
        answer:
          'For JAMB, Use of English is part of the paper structure and is selected with the exam rather than left out by accident. For WAEC, NECO and Post-UTME, choose the subjects you are preparing for; the setup screen tells you when a subject has no approved questions yet.',
      },
      {
        id: 'how-many-questions',
        question: 'How many questions are available?',
        answer:
          'It depends on the bank. The admin console shows the real number per exam body, and the setup screen only offers subjects that have approved questions. We do not pad a subject with placeholder questions to make the number look larger.',
      },
      {
        id: 'mirror-real-exam',
        question: 'Does the simulator follow the actual exam structure?',
        answer:
          'It follows the paper structure we have verified for the selected exam body, and the console records whether that structure is verified, partially verified or unverified. JAMB, WAEC and NECO have changed formats over the years, so always check the exam body’s current instructions for the real examination.',
      },
      {
        id: 'past-questions-practice',
        question: 'Can I practise past questions?',
        answer:
          'Yes. Past-question papers are listed on /past-questions, and questions extracted from a paper can be sat in the simulator once an editor has reviewed and approved them. A PDF on its own is a document, not a live question.',
      },
    ],
  },
  {
    id: 'past-questions',
    label: 'Past questions',
    description: 'Where the papers come from and how a PDF becomes a practice question.',
    questions: [
      {
        id: 'pq-source',
        question: 'Where do the past questions come from?',
        answer:
          'From papers uploaded by the EduReach team and, where allowed, from official exam-body material. Each resource records its source and year. We do not label a paper as official when we cannot show where it came from.',
      },
      {
        id: 'pq-added',
        question: 'How are questions added?',
        answer:
          'An administrator uploads a PDF, the text is extracted, and the parsed questions wait in a review queue. An editor checks the wording, the options and the answer key, corrects what the parser got wrong, and only then approves. Extraction alone never publishes a question.',
      },
      {
        id: 'pq-previous-years',
        question: 'Can I practise questions from previous years?',
        answer:
          'Yes, when that paper has been uploaded and its questions approved. The past-question library lists the year for each resource, and approved questions keep a link to the paper they came from so a wrong item can be traced and corrected.',
      },
      {
        id: 'pq-answer-keys',
        question: 'How are answer keys verified?',
        answer:
          'A reviewer compares each key against the source paper before approval. When a key is wrong after publication, a correction is made in the console and affected submitted attempts can be regraded from the answers those students stored. A student can also report a problem from the review screen.',
      },
    ],
  },
  {
    id: 'scholarships',
    label: 'Scholarships',
    description: 'Using the scholarship list safely.',
    questions: [
      {
        id: 'scholarship-apply',
        question: 'How do I apply for a scholarship?',
        answer:
          'Open the scholarship card, read the eligibility and deadline, then use “Apply” to reach the provider’s own application page. EduReach does not submit applications on your behalf and is not part of the selection process.',
      },
      {
        id: 'scholarship-fees',
        question: 'Does EduReach Hub collect scholarship application fees?',
        answer:
          'No. We do not collect money for a scholarship application, and no one at EduReach will ask you to pay to be shortlisted. If a provider charges a fee, that is between you and the provider and should be stated on their official page.',
      },
      {
        id: 'scholarship-verify',
        question: 'How do I verify a scholarship?',
        answer:
          'Each card shows who offers it, the date EduReach last checked the provider’s page, and a link to that page. Follow the link and confirm the deadline and requirements there before you share personal documents. A listing marked “Not yet checked” has not been verified by us.',
      },
      {
        id: 'scholarship-deadline-passes',
        question: 'What happens when a scholarship deadline passes?',
        answer:
          'The listing leaves the active list automatically and moves to the archive, where it stays readable for reference. It is never shown as “Open” or “Closing Soon” after the deadline.',
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments and access',
    description: 'What happens around a paid request.',
    questions: [
      {
        id: 'after-payment',
        question: 'What happens after payment?',
        answer:
          'A paid service request moves into the queue with a reference code you can see in your dashboard. If a payment is still being confirmed, the request says so rather than showing a false success. Keep the reference code when you contact support.',
      },
      {
        id: 'access-purchased',
        question: 'How do I access purchased content?',
        answer:
          'Sign in with the same account you used to pay. Purchased or granted access is attached to that account, not to the device, so it is available in Dashboard → Tools and in the relevant service or practice page.',
      },
      {
        id: 'paid-no-access',
        question: 'What should I do if payment succeeds but access is not granted?',
        answer:
          'Do not pay twice. Open the request in your dashboard and send us the reference code and the payment time through the contact page, and we will reconcile it against the payment record.',
      },
    ],
  },
  {
    id: 'privacy',
    label: 'Privacy and security',
    description: 'Your data, your account and your history.',
    questions: [
      {
        id: 'information-protected',
        question: 'How is my information protected?',
        answer:
          'Signed-in reads and writes are checked on the server against your account, and database row-level security stops a student session from reading another student’s rows. Sensitive operations run through server endpoints that verify your session before doing anything.',
      },
      {
        id: 'delete-account',
        question: 'Can I delete my account?',
        answer:
          'Account deletion is handled by the EduReach team at the moment: contact us from the email address on the account. Some records, such as payment and audit history, may be kept where the law or fraud prevention requires it; the privacy notice explains the retention position.',
      },
      {
        id: 'exam-history',
        question: 'What happens to my exam history?',
        answer:
          'Submitted attempts are kept so you can review your results and see progress. Practice history is yours; staff can see attempt metadata for support and question-quality work, but not to sell or publish it. You can ask us about your data using the contact page.',
      },
    ],
  },
];

export function faqSearchText(category: FaqCategory, question: FaqQuestion): string {
  return [category.label, question.question, question.answer].join(' ');
}
