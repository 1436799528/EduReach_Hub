import {
  Banknote,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  CreditCard,
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
  brain: BrainCircuit,
  briefcase: BriefcaseBusiness,
  calendar: CalendarClock,
  card: CreditCard,
  file: FileText,
  news: Newspaper,
  printer: Printer,
  user: UserRound,
  wallet: WalletCards,
  receipt: ReceiptText,
  graduation: GraduationCap,
  clipboard: ClipboardList,
} as const;

function renderIdentity(identity: CardIdentity) {
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
