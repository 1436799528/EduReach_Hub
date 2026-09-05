export type ServiceItem = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  image: string;
  cta: string;
};

export type BlogPost = {
  id: string;
  title: string;
  category: string;
  date: string;
  author: string;
  excerpt: string;
  image: string;
  badge?: string;
  readTime?: string;
};

const theme = 'https://themewagon.github.io/eduleb/assets/img';

export const siteConfig = {
  brand: 'EduReach Hub',
  tagline: 'Practical support for Nigerian tertiary students',
  email: 'Use the Contact form',
  phone: 'Contact us online',
  address: 'Nigeria',
  description: 'Student services, academic updates and practical support in one place.',
};

export const services: ServiceItem[] = [
  { id: 'nelfund-loan', title: 'NELFUND Loan Application', shortTitle: 'NELFUND Loan', description: 'Guidance for preparing and navigating the NELFUND student loan application process.', icon: 'ti-money', image: `${theme}/cat1.jpg`, cta: 'Apply For Loan' },
  { id: 'results', title: 'WAEC / NECO Result Checking', shortTitle: 'Result Checking', description: 'Clear guidance for students who need to check WAEC or NECO results.', icon: 'ti-check-box', image: `${theme}/cat2.jpg`, cta: 'Check Result' },
  { id: 'scratch-cards', title: 'WAEC / NECO Scratch Cards', shortTitle: 'Scratch Cards', description: 'Find the right result-checking card option and know what you need before starting.', icon: 'ti-credit-card', image: `${theme}/cat3.jpg`, cta: 'Get Card' },
  { id: 'jamb-slip', title: 'JAMB Exam Slip Printing', shortTitle: 'JAMB Slip', description: 'Support for locating, confirming and printing your JAMB examination slip.', icon: 'ti-printer', image: `${theme}/cat4.jpg`, cta: 'Print Slip' },
  { id: 'admission-letters', title: 'Admission Deferment & Supplementary Letters', shortTitle: 'Admission Letters', description: 'Structured help for admission deferment and supplementary application letters.', icon: 'ti-file', image: `${theme}/cat5.jpg`, cta: 'Get Letter Help' },
];

export const testimonials = [
  { name: 'Nigerian Tertiary Student', company: 'EduReach User', text: 'EduReach puts useful student services and important academic information in one place.' },
  { name: 'Admission Candidate', company: 'EduReach User', text: 'The service structure is simple and makes the next step easier to understand.' },
  { name: 'University Student', company: 'EduReach User', text: 'The updates focus on the kind of information students actually look for.' },
];

export const blogPosts: BlogPost[] = [
  { id: 'nelfund-application-guide', title: 'NELFUND Student Loan Application: What Students Should Prepare First', category: 'Funding', date: 'Sep 04, 2026', author: 'EduReach News Desk', badge: 'Update', readTime: '4 min read', excerpt: 'A practical guide to the information students should keep ready before starting a NELFUND loan application.', image: `${theme}/cat1.jpg` },
  { id: 'jamb-slip-update', title: 'JAMB Exam Slip Printing: Check These Details Before You Print', category: 'JAMB', date: 'Sep 03, 2026', author: 'EduReach News Desk', badge: 'Quick Update', readTime: '3 min read', excerpt: 'Important checks students should make when preparing to access and print an examination slip.', image: `${theme}/cat4.jpg` },
  { id: 'waec-result-checking', title: 'WAEC Result Checking: Common Errors Students Should Avoid', category: 'WAEC', date: 'Sep 02, 2026', author: 'EduReach News Desk', badge: 'Guide', readTime: '5 min read', excerpt: 'Simple reminders to help students avoid common mistakes when checking a WAEC result.', image: `${theme}/cat2.jpg` },
  { id: 'neco-result-checking', title: 'NECO Result Checking: What You Need Before You Start', category: 'NECO', date: 'Sep 01, 2026', author: 'EduReach News Desk', badge: 'Guide', readTime: '4 min read', excerpt: 'A straightforward checklist for students getting ready to check their NECO results.', image: `${theme}/cat3.jpg` },
  { id: 'campus-gist-week', title: 'Campus Gist: What Students Are Talking About This Week', category: 'Campus Gist', date: 'Aug 31, 2026', author: 'EduReach Campus Desk', badge: 'Campus Gist', readTime: '6 min read', excerpt: 'A roundup of campus conversations around registration, results, admissions and student life.', image: `${theme}/cat7.jpg` },
  { id: 'admission-deferment-letter', title: 'Need To Defer Admission? What To Include In Your Letter', category: 'Admissions', date: 'Aug 30, 2026', author: 'EduReach Guides', badge: 'Student Guide', readTime: '5 min read', excerpt: 'Key information students should prepare before drafting an admission deferment request.', image: `${theme}/cat5.jpg` },
  { id: 'supplementary-admission', title: 'Supplementary Admission: Questions Students Should Ask Before Accepting', category: 'Admissions', date: 'Aug 29, 2026', author: 'EduReach News Desk', badge: 'Update', readTime: '5 min read', excerpt: 'Practical questions to ask about supplementary admission offers, deadlines and next steps.', image: `${theme}/cat6.jpg` },
  { id: 'academic-calendar-alerts', title: 'Academic Calendar Watch: Dates Students Should Keep An Eye On', category: 'Academic Update', date: 'Aug 28, 2026', author: 'EduReach News Desk', badge: 'Quick Update', readTime: '3 min read', excerpt: 'A student-focused reminder to monitor registration windows, examinations and other key dates.', image: `${theme}/cat8.jpg` },
  { id: 'school-fees-reminder', title: 'School Fees: Why Waiting Until The Deadline Can Become A Problem', category: 'Student Guide', date: 'Aug 27, 2026', author: 'EduReach Guides', badge: 'Advice', readTime: '4 min read', excerpt: 'Why students should confirm deadlines early and keep proof of successful transactions.', image: `${theme}/cat2.jpg` },
  { id: 'project-season-campus', title: 'Campus Gist: Project Season Is Here — Simple Ways To Stay Organised', category: 'Campus Gist', date: 'Aug 26, 2026', author: 'EduReach Campus Desk', badge: 'Campus Gist', readTime: '6 min read', excerpt: 'A practical roundup for students balancing project work, coursework and deadlines.', image: `${theme}/cat4.jpg` },
  { id: 'result-release-follow-up', title: 'Your Result Is Out — What Should You Do Next?', category: 'Results', date: 'Aug 25, 2026', author: 'EduReach Guides', badge: 'Quick Tips', readTime: '4 min read', excerpt: 'Useful next steps after checking a result, including keeping records and watching for school instructions.', image: `${theme}/cat3.jpg` },
  { id: 'student-opportunities', title: 'Student Opportunities: Skills, Scholarships And Opportunities To Watch', category: 'Opportunities', date: 'Aug 24, 2026', author: 'EduReach News Desk', badge: 'Opportunities', readTime: '6 min read', excerpt: 'A general roundup of the opportunities tertiary students should keep on their radar.', image: `${theme}/cat6.jpg` },
];
