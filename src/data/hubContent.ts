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
  { slug: 'results', title: 'WAEC / NECO Result Checking', short: 'Result Checking', description: 'Get guided support for WAEC and NECO result checking while keeping candidate details private.', price: 'Result support', action: 'Apply Now', tone: 'blue' },
  { slug: 'jamb-slip', title: 'JAMB Exam Slip Printing', short: 'JAMB Slip', description: 'Support for locating, verifying and preparing your examination slip for printing.', price: 'Printing support', action: 'Apply Now', tone: 'blue' },
  { slug: 'admission-letters', title: 'Admission Deferment & Supplementary Letters', short: 'Admission Letters', description: 'Prepare a clear application letter around your institution’s actual requirements.', price: 'Letter support', action: 'Apply Now', tone: 'green' },
];

export type JobCategory = 'scholarship' | 'internship' | 'campus' | 'part-time';

export type JobListing = {
  title: string;
  type: string;
  mode: string;
  category: JobCategory;
  note: string;
};

export const jobs: JobListing[] = [
  { title: 'Student Content Contributor', type: 'Part-time', mode: 'Remote', category: 'part-time', note: 'Help turn verified academic updates into short student-friendly posts.' },
  { title: 'Campus Community Rep', type: 'Volunteer', mode: 'Campus', category: 'campus', note: 'Share official EduReach updates and report useful campus information.' },
  { title: 'Frontend Support Intern', type: 'Internship', mode: 'Hybrid', category: 'internship', note: 'Support UI testing, accessibility checks and student-facing product improvements.' },
];

export const EDUREACH_WHATSAPP = '2349130134969';
export const EDUREACH_WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029Va5klNXBqbrFpObq350A';

export function jobApplyHref(title: string): string {
  return `https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent(`Hello EduReach, I want to apply for: ${title}`)}`;
}
