import React from 'react';
import {
  GraduationCap,
  BookOpen,
  FileCheck2,
  FileText,
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
  Briefcase,
  MessageCircle,
  BookOpenCheck,
} from 'lucide-react';

export interface CleanIdentity {
  icon: React.ElementType;
  image?: string;
  label?: string;
  badge?: string;
  tone: 'crimson' | 'emerald' | 'blue' | 'amber' | 'purple' | 'slate';
  ariaLabel: string;
}

export function resolveIdentity(
  value: string,
  type: 'service' | 'news' | 'upcoming' | 'content' = 'service'
): CleanIdentity {
  const v = (value || '').toLowerCase();

  // Explicit service artwork takes precedence when the service itself is named.
  if (v.includes('admission watch')) {
    return { icon: FileText, image: '/news/photos/campus.jpg', label: 'ADMISSION WATCH', tone: 'purple', ariaLabel: 'Admission Watch' };
  }
  if (v.includes('student funding') || v.includes('funding alert')) {
    return { icon: Wallet, image: '/news/photos/nelfund.webp', label: 'FUNDING ALERT', tone: 'amber', ariaLabel: 'Student Funding' };
  }
  if (v.includes('jamb slip') || (v.includes('slip') && v.includes('jamb')) || v.includes('exam slip')) {
    return { icon: Printer, image: '/icons/brands/jamb.png', label: 'JAMB', tone: 'crimson', ariaLabel: 'JAMB Exam Slip Printing' };
  }

  // Brand-first resolution: an explicitly named organisation uses its real brand mark.
  if (v.includes('jamb')) {
    return { icon: GraduationCap, image: '/icons/brands/jamb.png', label: 'JAMB', tone: 'crimson', ariaLabel: 'JAMB Services' };
  }
  if (v.includes('neco')) {
    return { icon: Award, image: '/icons/brands/neco.webp', label: 'NECO', tone: 'blue', ariaLabel: 'NECO Services' };
  }
  if (v.includes('waec')) {
    return { icon: FileCheck2, image: '/icons/brands/waec.webp', label: 'WAEC', tone: 'blue', ariaLabel: 'WAEC Services' };
  }
  if (v.includes('nabteb')) {
    return { icon: Award, image: '/icons/brands/nabteb.png', label: 'NABTEB', tone: 'blue', ariaLabel: 'NABTEB Services' };
  }
  if (v.includes('nelfund')) {
    return { icon: Wallet, image: '/icons/brands/nelfund.png', label: 'NELFUND', tone: 'emerald', ariaLabel: 'NELFUND Services' };
  }

  // News (brand-named stories already returned above with real marks)
  if (type === 'news' || v.includes('news') || v.includes('gist')) {
    if (v.includes('result')) {
      return { icon: FileCheck2, image: '/icons/brands/waec.webp', label: 'EXAMS', tone: 'blue', ariaLabel: 'Exam News' };
    }
    if (v.includes('admission') || v.includes('screening')) {
      return { icon: FileText, label: 'ADMISSION', tone: 'purple', ariaLabel: 'Admission News' };
    }
    if (v.includes('scholarship') || v.includes('opportun')) {
      return { icon: Award, label: 'GRANTS', tone: 'amber', ariaLabel: 'Scholarship News' };
    }
    return { icon: Newspaper, label: 'UPDATES', tone: 'slate', ariaLabel: 'Campus News' };
  }

  // Upcoming
  if (type === 'upcoming' || v === 'deadline' || v === 'exam') {
    if (v === 'deadline' || v.includes('dead')) {
      return { icon: Clock, label: 'DUE', tone: 'amber', ariaLabel: 'Important Deadline' };
    }
    return { icon: Laptop, label: 'EXAM', tone: 'crimson', ariaLabel: 'Upcoming Examination' };
  }

  // Services and Tools
  if (v.includes('nelfund') || v.includes('student-loan') || v.includes('loan')) {
    return {
      icon: Wallet,
      image: '/icons/brands/nelfund.png',
      label: 'NELFUND',
      badge: 'LOAN',
      tone: 'emerald',
      ariaLabel: 'NELFUND Student Loan',
    };
  }
  if (v.includes('slip') || v.includes('print')) {
    return {
      icon: Printer,
      image: '/icons/brands/jamb.png',
      label: 'JAMB SLIP',
      badge: 'PRINT',
      tone: 'crimson',
      ariaLabel: 'JAMB Exam Slip Printing',
    };
  }
  if (v.includes('result') || (v.includes('waec') && v.includes('neco'))) {
    return {
      icon: FileCheck2,
      image: '/icons/brands/waec.webp',
      label: 'RESULTS',
      badge: 'CHECK',
      tone: 'blue',
      ariaLabel: 'WAEC / NECO Result Checking',
    };
  }
  if (v.includes('admission') || v.includes('letter')) {
    return {
      icon: FileText,
      label: 'ADMISSION',
      badge: 'PORTAL',
      tone: 'purple',
      ariaLabel: 'Admission Letters & Clearance',
    };
  }
  if (v.includes('transcript') || v.includes('certificate') || v.includes('verific')) {
    return {
      icon: FileCheck2,
      label: 'RECORDS',
      badge: 'VERIFY',
      tone: 'blue',
      ariaLabel: 'Transcripts & Certificate Verification',
    };
  }
  if (v.includes('document')) {
    return {
      icon: FileText,
      label: 'DOCS',
      badge: 'REQUEST',
      tone: 'slate',
      ariaLabel: 'Document Requests',
    };
  }
  if (v.includes('track') || v.includes('reference') || v.includes('request')) {
    return {
      icon: Search,
      label: 'TRACK',
      badge: 'STATUS',
      tone: 'crimson',
      ariaLabel: 'Track Service Request',
    };
  }
  if (v.includes('post-utme') || v.includes('postutme')) {
    return {
      icon: GraduationCap,
      image: '/icons/brands/jamb.png',
      label: 'POST-UTME',
      badge: 'SCREENING',
      tone: 'blue',
      ariaLabel: 'Post-UTME Practice',
    };
  }
  if (v.includes('jamb') || v.includes('utme')) {
    return {
      icon: GraduationCap,
      image: '/icons/brands/jamb.png',
      label: 'JAMB',
      badge: 'UTME',
      tone: 'crimson',
      ariaLabel: 'JAMB Services',
    };
  }
  if (v.includes('waec')) {
    return {
      icon: FileCheck2,
      image: '/icons/brands/waec.webp',
      label: 'WAEC',
      badge: 'SSCE',
      tone: 'blue',
      ariaLabel: 'WAEC Examination',
    };
  }
  if (v.includes('neco')) {
    return {
      icon: Award,
      image: '/icons/brands/neco.webp',
      label: 'NECO',
      badge: 'SSCE',
      tone: 'blue',
      ariaLabel: 'NECO Examination',
    };
  }
  if (v.includes('cbt') || v.includes('practice') || v.includes('test') || v.includes('simulator')) {
    return {
      icon: Laptop,
      label: 'CBT',
      badge: 'CLASSROOM',
      tone: 'crimson',
      ariaLabel: 'CBT Classroom Simulator',
    };
  }
  if (v.includes('past') || v.includes('question')) {
    return {
      icon: BookOpen,
      label: 'PAST Q',
      badge: 'STUDY',
      tone: 'purple',
      ariaLabel: 'Past Questions Bank',
    };
  }
  if (v.includes('cgpa') || v.includes('gpa') || v.includes('calc') || v.includes('screen') || v.includes('aggregate')) {
    return {
      icon: Calculator,
      label: 'CALC',
      badge: 'TOOL',
      tone: 'crimson',
      ariaLabel: 'Screening & Aggregate Calculator',
    };
  }
  if (v.includes('school') || v.includes('universit') || v.includes('finder') || v.includes('polytechnic') || v.includes('college')) {
    return {
      icon: School,
      label: 'SCHOOLS',
      badge: 'FINDER',
      tone: 'blue',
      ariaLabel: 'School Finder',
    };
  }
  if (v.includes('event') || v.includes('calendar')) {
    return {
      icon: Calendar,
      label: 'EVENTS',
      badge: 'DATES',
      tone: 'purple',
      ariaLabel: 'Academic Events',
    };
  }
  if (v.includes('wallet') || v.includes('balance')) {
    return {
      icon: Wallet,
      label: 'WALLET',
      badge: 'FUNDS',
      tone: 'emerald',
      ariaLabel: 'Student Wallet',
    };
  }
  if (v.includes('regist') || v.includes('timetable') || v.includes('countdown') || v.includes('course') || v === 'exam' || v.includes(' exam')) {
    return {
      icon: BookOpenCheck,
      label: 'STUDY',
      badge: 'ACADEMIC',
      tone: 'purple',
      ariaLabel: 'Academic Tools',
    };
  }
  if (v.includes('scholarship') || v.includes('grant') || v.includes('fund')) {
    return {
      icon: Award,
      label: 'GRANTS',
      badge: 'SCHOLARSHIP',
      tone: 'amber',
      ariaLabel: 'Scholarships & Grants',
    };
  }
  if (v.includes('job') || v.includes('opportun') || v.includes('career') || v.includes('intern') || v.includes('part-time') || v.includes('parttime') || v.includes('campus') || v.includes('volunteer') || v.includes('contributor') || v.includes('ambassador') || v.includes('mentor') || v.includes('tutor')) {
    return {
      icon: Briefcase,
      label: 'CAREERS',
      badge: 'OPPORTUNITY',
      tone: 'slate',
      ariaLabel: 'Student Opportunities',
    };
  }

  if (v.includes('support') || v.includes('help') || v.includes('contact')) {
    return {
      icon: MessageCircle,
      label: 'HELP',
      badge: 'SUPPORT',
      tone: 'blue',
      ariaLabel: 'Student Support',
    };
  }
  return {
    icon: Layers,
    label: 'EDUREACH',
    badge: 'PORTAL',
    tone: 'crimson',
    ariaLabel: 'EduReach Academic Service',
  };
}

export default function CardIdentityMark({
  value,
  type = 'service',
  size = 'md',
}: {
  value: string;
  type?: 'service' | 'news' | 'upcoming' | 'content';
  size?: 'sm' | 'md' | 'lg';
}) {
  const { icon: Icon, image, label, tone, ariaLabel } = resolveIdentity(value, type);

  // Real brand marks are wide, not square: fix the height and let the width
  // follow the natural aspect ratio so emblems never stretch.
  const imgHeight = size === 'sm' ? 20 : size === 'lg' ? 36 : 26;

  return (
    <div className={`ms-identity-mark ms-mark-tone-${tone} ms-mark-${size}`} aria-label={ariaLabel}>
      {image ? (
        <img
          src={image}
          alt={ariaLabel}
          className="ms-identity-img"
          height={imgHeight}
          style={{ width: 'auto', maxWidth: imgHeight * 2.6, objectFit: 'contain' }}
          loading="lazy"
        />
      ) : (
        <Icon className="ms-identity-icon" size={size === 'sm' ? 14 : size === 'lg' ? 22 : 17} strokeWidth={2.2} />
      )}
      {label && <span className="ms-identity-label">{label}</span>}
    </div>
  );
}
