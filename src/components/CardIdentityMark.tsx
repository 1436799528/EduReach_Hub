import {
  Banknote,
  BookOpen,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Calculator,
  CircleHelp,
  FileQuestion,
  FileCheck2,
  School,
  Award,
  BadgeCheck,
  Bell,
  Headset,
  LayoutDashboard,
  Monitor,
  Search,
  Settings,
  FileText,
  GraduationCap,
  Newspaper,
  Printer,
  ReceiptText,
  UserRound,
  WalletCards,
} from 'lucide-react';
import {
  contentCardIdentity,
  newsCardIdentity,
  serviceCardIdentity,
  upcomingCardIdentity,
  type CardIdentity,
} from '../lib/cardTheme';

const iconMap = {
  banknote: Banknote,
  monitor: Monitor,
  book: BookOpen,
  bookCheck: BookOpenCheck,
  brain: BrainCircuit,
  briefcase: BriefcaseBusiness,
  calendar: CalendarClock,
  card: CreditCard,
  calculator: Calculator,
  help: CircleHelp,
  file: FileText,
  fileQuestion: FileQuestion,
  fileCheck: FileCheck2,
  news: Newspaper,
  printer: Printer,
  user: UserRound,
  wallet: WalletCards,
  receipt: ReceiptText,
  graduation: GraduationCap,
  clipboard: ClipboardList,
  award: Award,
  check: BadgeCheck,
  headset: Headset,
  bell: Bell,
  settings: Settings,
  search: Search,
  school: School,
  dashboard: LayoutDashboard,
} as const;

const accentIconMap = {
  monitor: Monitor,
  graduation: GraduationCap,
  file: FileText,
  check: BadgeCheck,
  award: Award,
} as const;

function renderIdentity(identity: CardIdentity) {
  if (identity.imageUrls?.length) {
    return (
      <span className="hub-card-identity hub-card-identity--images" aria-hidden="true">
        {identity.imageUrls.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" decoding="async" />
        ))}
        {identity.accentIcon &&
          (() => {
            const AccentIcon = accentIconMap[identity.accentIcon];
            return <AccentIcon className="hub-card-identity-accent" size={14} strokeWidth={1.9} />;
          })()}
      </span>
    );
  }

  if (identity.kind === 'wordmark') {
    return (
      <span className="hub-card-identity hub-card-identity--wordmark" aria-hidden="true">
        <strong>{identity.label}</strong>
        {identity.secondary && <small>{identity.secondary}</small>}
      </span>
    );
  }

  const Icon = iconMap[identity.icon || 'file'];
  return (
    <span className="hub-card-identity hub-card-identity--icon" aria-hidden="true">
      <Icon size={21} strokeWidth={1.8} />
      {identity.label && <strong className="hub-card-identity-icon-label">{identity.label}</strong>}
    </span>
  );
}

export default function CardIdentityMark({
  value,
  type,
}: {
  value: string;
  type: 'service' | 'news' | 'upcoming' | 'content';
}) {
  const identity =
    type === 'service'
      ? serviceCardIdentity(value)
      : type === 'news'
        ? newsCardIdentity(value)
        : type === 'upcoming'
          ? upcomingCardIdentity(value as 'deadline' | 'exam')
          : contentCardIdentity(value);

  return (
    <span
      className={`hub-card-identity-wrap hub-card-identity-tone-${identity.tone}`}
      aria-label={identity.ariaLabel}
    >
      {renderIdentity(identity)}
    </span>
  );
}
