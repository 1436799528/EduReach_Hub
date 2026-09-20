import {
  GraduationCap,
  BookOpen,
  FileCheck2,
  FileText,
  CreditCard,
  Printer,
  Calculator,
  Award,
  Clock,
  Laptop,
  Search,
  Newspaper,
  Wallet,
  Calendar,
  School,
  Layers,
  Sparkles,
  HelpCircle,
  Briefcase,
  BadgeCheck,
} from 'lucide-react';

export interface CleanIdentity {
  icon: React.ElementType;
  label?: string;
  badge?: string;
  tone: 'emerald' | 'blue' | 'amber' | 'purple' | 'slate';
  ariaLabel: string;
}

export function resolveIdentity(value: string, type: 'service' | 'news' | 'upcoming' | 'content' = 'service'): CleanIdentity {
  const v = (value || '').toLowerCase();

  // News
  if (type === 'news' || v.includes('news') || v.includes('gist')) {
    if (v.includes('jamb')) return { icon: GraduationCap, label: 'JAMB', tone: 'emerald', ariaLabel: 'JAMB Updates' };
    if (v.includes('nelfund') || v.includes('fund') || v.includes('loan')) return { icon: Wallet, label: 'NELFUND', tone: 'emerald', ariaLabel: 'NELFUND News' };
    if (v.includes('waec') || v.includes('neco') || v.includes('result')) return { icon: FileCheck2, label: 'EXAMS', tone: 'blue', ariaLabel: 'Exam News' };
    if (v.includes('admission')) return { icon: FileText, label: 'ADMISSION', tone: 'purple', ariaLabel: 'Admission News' };
    return { icon: Newspaper, label: 'UPDATES', tone: 'slate', ariaLabel: 'Campus News' };
  }

  // Upcoming
  if (type === 'upcoming' || v === 'deadline' || v === 'exam') {
    if (v === 'deadline' || v.includes('dead')) return { icon: Clock, label: 'DUE', tone: 'amber', ariaLabel: 'Important Deadline' };
    return { icon: Laptop, label: 'EXAM', tone: 'emerald', ariaLabel: 'Upcoming Examination' };
  }

  // Services and Tools
  if (v.includes('nelfund') || v.includes('student-loan') || v.includes('loan')) {
    return { icon: Wallet, label: 'NELFUND', badge: 'LOAN', tone: 'emerald', ariaLabel: 'NELFUND Student Loan' };
  }
  if (v.includes('scratch') || v.includes('card') || v.includes('pin') || v.includes('voucher')) {
    return { icon: CreditCard, label: 'CARDS', badge: 'TOKEN', tone: 'amber', ariaLabel: 'WAEC and NECO Scratch Cards' };
  }
  if (v.includes('slip') || v.includes('print')) {
    return { icon: Printer, label: 'JAMB SLIP', badge: 'PRINT', tone: 'blue', ariaLabel: 'JAMB Exam Slip Printing' };
  }
  if (v.includes('result') || (v.includes('waec') && v.includes('neco'))) {
    return { icon: FileCheck2, label: 'RESULTS', badge: 'CHECK', tone: 'blue', ariaLabel: 'WAEC / NECO Result Checking' };
  }
  if (v.includes('admission') || v.includes('letter')) {
    return { icon: FileText, label: 'ADMISSION', badge: 'DEFERMENT', tone: 'purple', ariaLabel: 'Admission Letters' };
  }
  if (v.includes('post-utme') || v.includes('postutme')) {
    return { icon: GraduationCap, label: 'POST-UTME', badge: 'SCREENING', tone: 'purple', ariaLabel: 'Post-UTME Practice' };
  }
  if (v.includes('jamb') || v.includes('utme')) {
    return { icon: GraduationCap, label: 'JAMB', badge: 'UTME', tone: 'emerald', ariaLabel: 'JAMB Services' };
  }
  if (v.includes('waec')) {
    return { icon: FileCheck2, label: 'WAEC', badge: 'SSCE', tone: 'blue', ariaLabel: 'WAEC Examination' };
  }
  if (v.includes('neco')) {
    return { icon: Award, label: 'NECO', badge: 'SSCE', tone: 'emerald', ariaLabel: 'NECO Examination' };
  }
  if (v.includes('nabteb')) {
    return { icon: Award, label: 'NABTEB', badge: 'TECHNICAL', tone: 'emerald', ariaLabel: 'NABTEB Examination' };
  }
  if (v.includes('cbt') || v.includes('practice') || v.includes('test')) {
    return { icon: Laptop, label: 'CBT', badge: 'PRACTICE', tone: 'blue', ariaLabel: 'CBT Practice' };
  }
  if (v.includes('past') || v.includes('question')) {
    return { icon: BookOpen, label: 'PAST Q', badge: 'STUDY', tone: 'purple', ariaLabel: 'Past Questions Bank' };
  }
  if (v.includes('cgpa') || v.includes('gpa') || v.includes('calc') || v.includes('screen')) {
    return { icon: Calculator, label: 'CALCULATOR', badge: 'TOOL', tone: 'purple', ariaLabel: 'Screening & GPA Calculator' };
  }
  if (v.includes('timetable') || v.includes('calendar') || v.includes('planner')) {
    return { icon: Calendar, label: 'SCHEDULE', badge: 'PLANNER', tone: 'blue', ariaLabel: 'Academic Calendar' };
  }
  if (v.includes('scholarship') || v.includes('job') || v.includes('opportun')) {
    return { icon: Award, label: 'CAREERS', badge: 'GRANTS', tone: 'amber', ariaLabel: 'Scholarships & Opportunities' };
  }
  if (v.includes('school') || v.includes('course')) {
    return { icon: School, label: 'FINDER', badge: 'DIRECTORY', tone: 'blue', ariaLabel: 'School & Course Finder' };
  }

  return { icon: Layers, label: 'EDUREACH', badge: 'SERVICE', tone: 'blue', ariaLabel: 'EduReach Service' };
}

export default function CardIdentityMark({
  value,
  type = 'service',
}: {
  value: string;
  type?: 'service' | 'news' | 'upcoming' | 'content';
}) {
  const { icon: Icon, label, tone, ariaLabel } = resolveIdentity(value, type);

  return (
    <div className={`ms-identity-mark ms-mark-tone-${tone}`} aria-label={ariaLabel}>
      <Icon className="ms-identity-icon" size={17} strokeWidth={2.2} />
      {label && <span className="ms-identity-label">{label}</span>}
    </div>
  );
}
