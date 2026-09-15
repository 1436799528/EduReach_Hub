export type ServiceCatalogItem = {
  slug: string;
  title: string;
  short: string;
  description: string;
  price: string;
  action: string;
  tone: 'blue' | 'green' | 'amber';
};

export const hubServices: ServiceCatalogItem[] = [
  { slug: 'nelfund-loan', title: 'NELFUND Loan Application', short: 'NELFUND Loan', description: 'Organise your student-loan request details and get guided support before you submit through the official portal.', price: 'Assistance service', action: 'Apply Now', tone: 'green' },
  { slug: 'results', title: 'WAEC / NECO Result Checking', short: 'Result Checking', description: 'Get guided support for WAEC and NECO result checking while keeping candidate details and PINs private.', price: 'Result support', action: 'Apply Now', tone: 'blue' },
  { slug: 'scratch-cards', title: 'WAEC / NECO Scratch Cards', short: 'Scratch Cards', description: 'Request the right result-checking card type and keep your code private while using the official checker.', price: 'Code request', action: 'Get Code', tone: 'amber' },
  { slug: 'jamb-slip', title: 'JAMB Exam Slip Printing', short: 'JAMB Slip', description: 'Support for locating, verifying and preparing your examination slip for printing.', price: 'Printing support', action: 'Apply Now', tone: 'blue' },
  { slug: 'admission-letters', title: 'Admission Deferment & Supplementary Letters', short: 'Admission Letters', description: 'Prepare a clear application letter around your institution’s actual requirements.', price: 'Letter support', action: 'Apply Now', tone: 'green' },
];

export const cbtSubjects = [
  { name: 'Use of English', key: 'english', tone: 'blue', count: 60 },
  { name: 'Mathematics', key: 'mathematics', tone: 'green', count: 60 },
  { name: 'Chemistry', key: 'chemistry', tone: 'amber', count: 60 },
  { name: 'Physics', key: 'physics', tone: 'blue', count: 60 },
  { name: 'Biology', key: 'biology', tone: 'green', count: 60 },
];

export const sampleQuestions = [
  { id: 1, text: 'Which option is closest in meaning to “rapid”?', options: ['Slow', 'Fast', 'Heavy', 'Quiet'], correct: 1, explanation: 'Rapid means happening quickly or at high speed.' },
  { id: 2, text: 'If 3x = 18, what is x?', options: ['3', '6', '9', '12'], correct: 1, explanation: 'Divide both sides by 3: x = 6.' },
  { id: 3, text: 'What is the chemical symbol for sodium?', options: ['So', 'Sd', 'Na', 'Sn'], correct: 2, explanation: 'Sodium is represented by Na.' },
  { id: 4, text: 'What unit is commonly used for electrical current?', options: ['Volt', 'Ohm', 'Ampere', 'Watt'], correct: 2, explanation: 'Electric current is measured in amperes.' },
  { id: 5, text: 'Which organ pumps blood around the human body?', options: ['Liver', 'Heart', 'Kidney', 'Lung'], correct: 1, explanation: 'The heart pumps blood through the circulatory system.' },
];

export const newsItems = [
  { slug: 'jamb-caps-status-guide', tag: 'JAMB', title: 'JAMB CAPS: What Students Should Check Before Accepting Admission', date: 'Quick guide', excerpt: 'A compact checklist for checking admission status, CAPS details and the next step.', verified: true },
  { slug: 'nelfund-student-loan-checklist', tag: 'NELFUND', title: 'NELFUND Student Loan: Information to Organise Before You Apply', date: 'Student guide', excerpt: 'Keep your contact, institution and academic details ready before starting a loan request.', verified: true },
  { slug: 'waec-neco-result-checking', tag: 'WAEC / NECO', title: 'WAEC / NECO Result Checking: Keep Your PIN and Candidate Details Safe', date: 'Reminder', excerpt: 'Simple safety steps for result-checking tokens and official portals.', verified: true },
  { slug: 'campus-gist-week', tag: 'Campus Gist', title: 'Campus Gist: What Students Should Watch This Week', date: 'Weekly', excerpt: 'A sample campus roundup layout for deadlines, notices and useful student updates.', verified: false },
  { slug: 'student-opportunities', tag: 'Opportunities', title: 'Student Opportunities: Keep Your Documents Ready', date: 'Guide', excerpt: 'How to keep an application-ready student folder for scholarships, internships and opportunities.', verified: false },
];

export const jobs = [
  { title: 'Student Content Contributor', type: 'Part-time', mode: 'Remote', note: 'Help turn verified academic updates into short student-friendly posts.' },
  { title: 'Campus Community Rep', type: 'Volunteer', mode: 'Campus', note: 'Share official EduReach updates and report useful campus information.' },
  { title: 'Frontend Support Intern', type: 'Internship', mode: 'Hybrid', note: 'Support UI testing, accessibility checks and student-facing product improvements.' },
];
