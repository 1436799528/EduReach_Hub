export type ServiceCategory = 'Examinations' | 'Admission' | 'Financial Aid' | 'Documents' | 'Student Tools' | 'Support';
export type ServiceKind = 'brand' | 'edureach';
export type ServiceDefinition = {
  key: string; title: string; category: ServiceCategory; route: string; icon: string;
  type: ServiceKind; description: string; requiresApplication: boolean;
};

/**
 * Product-level source of truth for EduReach service names, categories, routes
 * and visual identity. Supabase service_catalog remains the runtime source
 * for availability, pricing, descriptions and external portal links.
 */
export const services: ServiceDefinition[] = [
  { key: 'jamb', title: 'JAMB Services', category: 'Examinations', route: '/jamb', icon: '/icons/brands/jamb.png', type: 'brand', description: 'JAMB information, guidance and related student services.', requiresApplication: false },
  { key: 'jamb-cbt', title: 'JAMB CBT', category: 'Examinations', route: '/cbt', icon: '/icons/brands/jamb.png', type: 'brand', description: 'Computer-based practice and examination preparation.', requiresApplication: false },
  { key: 'past-questions', title: 'Past Question Bank', category: 'Examinations', route: '/cbt', icon: '/news/photos/jamb-cbt.jpg', type: 'edureach', description: 'Timed CBT practice organised by examination.', requiresApplication: false },
  { key: 'waec', title: 'WAEC', category: 'Examinations', route: '/waec', icon: '/icons/brands/waec.webp', type: 'brand', description: 'WAEC information, preparation and result resources.', requiresApplication: false },
  { key: 'neco', title: 'NECO', category: 'Examinations', route: '/neco', icon: '/icons/brands/neco.webp', type: 'brand', description: 'NECO information, preparation and result resources.', requiresApplication: false },
  { key: 'nabteb', title: 'NABTEB', category: 'Examinations', route: '/nabteb', icon: '/icons/brands/nabteb.png', type: 'brand', description: 'NABTEB examination information and resources.', requiresApplication: false },
  { key: 'admission-consultation', title: 'Admission Consultation', category: 'Admission', route: '/admission/consultation', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Structured guidance for admission decisions and applications.', requiresApplication: true },
  { key: 'school-finder', title: 'School Finder', category: 'Admission', route: '/admission/schools', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Find institutions and compare admission information.', requiresApplication: false },
  { key: 'course-finder', title: 'Course Finder', category: 'Admission', route: '/admission/courses', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Explore courses and admission requirements.', requiresApplication: false },
  { key: 'admission-requirements', title: 'Admission Requirements', category: 'Admission', route: '/admission/requirements', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Check requirements before starting an application.', requiresApplication: false },
  { key: 'post-utme', title: 'Post-UTME', category: 'Admission', route: '/post-utme', icon: '/icons/brands/jamb.png', type: 'brand', description: 'Post-UTME information and preparation resources.', requiresApplication: false },
  { key: 'nelfund', title: 'NELFUND', category: 'Financial Aid', route: '/nelfund', icon: '/icons/brands/nelfund.png', type: 'brand', description: 'NELFUND eligibility, guidance and application information.', requiresApplication: false },
  { key: 'scholarships', title: 'Scholarships', category: 'Financial Aid', route: '/jobs', icon: '/news/photos/graduates.jpg', type: 'edureach', description: 'Find scholarship opportunities and application guidance.', requiresApplication: false },
  { key: 'school-fees', title: 'School Fees', category: 'Financial Aid', route: '/tools/school-fees', icon: '/news/photos/nelfund.webp', type: 'edureach', description: 'Student fee information and related support.', requiresApplication: false },
  { key: 'transcript', title: 'Transcript Request', category: 'Documents', route: '/services/transcript', icon: '/news/photos/waec-result.png', type: 'edureach', description: 'Guidance for academic transcript requests.', requiresApplication: true },
  { key: 'certificate-verification', title: 'Certificate Verification', category: 'Documents', route: '/services/certificate-verification', icon: '/news/photos/waec-result.png', type: 'edureach', description: 'Support for certificate and academic document verification.', requiresApplication: true },
  { key: 'result-verification', title: 'Result Verification', category: 'Documents', route: '/services/result-verification', icon: '/news/photos/waec-result.png', type: 'edureach', description: 'Support for verifying examination or academic results.', requiresApplication: true },
  { key: 'document-request', title: 'Document Request', category: 'Documents', route: '/services/document', icon: '/news/photos/waec-result.png', type: 'edureach', description: 'Structured support for student document requests.', requiresApplication: true },
  { key: 'cgpa-calculator', title: 'CGPA Calculator', category: 'Student Tools', route: '/tools/cgpa', icon: '/news/photos/waec-result.png', type: 'edureach', description: 'Calculate and plan academic performance.', requiresApplication: false },
  { key: 'gpa-calculator', title: 'GPA Calculator', category: 'Student Tools', route: '/tools/gpa', icon: '/news/photos/waec-result.png', type: 'edureach', description: 'Calculate semester GPA from courses and grades.', requiresApplication: false },
  { key: 'course-registration', title: 'Course Registration', category: 'Student Tools', route: '/tools/course-registration', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Organise courses before registration.', requiresApplication: false },
  { key: 'timetable', title: 'Timetable', category: 'Student Tools', route: '/tools/timetable', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Keep an academic timetable in one place.', requiresApplication: false },
  { key: 'academic-calendar', title: 'Academic Calendar', category: 'Student Tools', route: '/tools/calendar', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Track academic dates and deadlines.', requiresApplication: false },
  { key: 'exam-countdown', title: 'Exam Countdown', category: 'Student Tools', route: '/tools/exam-countdown', icon: '/news/photos/jamb-cbt.jpg', type: 'edureach', description: 'Track important examination dates.', requiresApplication: false },
  { key: 'support', title: 'Student Support', category: 'Support', route: '/support', icon: '/news/photos/campus.jpg', type: 'edureach', description: 'Help with EduReach services and student tasks.', requiresApplication: false },
];

export const serviceByKey = Object.fromEntries(services.map((service) => [service.key, service])) as Record<string, ServiceDefinition | undefined>;
export function getServiceDefinition(key: string): ServiceDefinition | undefined {
  return serviceByKey[key.toLowerCase()];
}
