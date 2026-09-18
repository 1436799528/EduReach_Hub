const imageBase = 'https://themewagon.github.io/eduleb/assets/img';

export type CardIdentity = {
  label: string;
  secondary?: string;
  kind: 'wordmark' | 'icon';
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate';
  icon?: 'banknote' | 'brain' | 'briefcase' | 'calendar' | 'card' | 'file' | 'news' | 'printer';
  ariaLabel: string;
};

export const cardImages = {
  'nelfund-loan': `${imageBase}/cat1.jpg`,
  results: `${imageBase}/cat2.jpg`,
  'scratch-cards': `${imageBase}/cat3.jpg`,
  'jamb-slip': `${imageBase}/cat4.jpg`,
  'admission-letters': `${imageBase}/cat5.jpg`,
  cbt: `${imageBase}/cat1.jpg`,
  services: `${imageBase}/cat2.jpg`,
  news: `${imageBase}/cat3.jpg`,
  jobs: `${imageBase}/cat5.jpg`,
  default: `${imageBase}/cat1.jpg`,
} as const;

export function serviceCardImage(serviceKey: string) {
  return cardImages[serviceKey as keyof typeof cardImages] || cardImages.default;
}

export function newsCardImage(category: string) {
  const key = category.toLowerCase();
  if (key.includes('jamb')) return cardImages['jamb-slip'];
  if (key.includes('fund') || key.includes('nelfund')) return cardImages['nelfund-loan'];
  if (key.includes('admission')) return cardImages['admission-letters'];
  if (key.includes('result') || key.includes('waec') || key.includes('neco')) return cardImages.results;
  return cardImages.news;
}

export function upcomingCardImage(kind: 'deadline' | 'exam') {
  return kind === 'exam' ? cardImages.cbt : cardImages.news;
}

const serviceIdentities: Record<string, CardIdentity> = {
  'nelfund-loan': { label: 'NELFUND', kind: 'wordmark', tone: 'green', ariaLabel: 'NELFUND student loan' },
  results: { label: 'WAEC', secondary: 'NECO', kind: 'wordmark', tone: 'blue', ariaLabel: 'WAEC and NECO results' },
  'scratch-cards': { label: 'PIN', secondary: 'CARD', kind: 'wordmark', tone: 'amber', ariaLabel: 'WAEC and NECO result checking cards' },
  'jamb-slip': { label: 'JAMB', secondary: 'SLIP', kind: 'wordmark', tone: 'blue', ariaLabel: 'JAMB examination slip' },
  'admission-letters': { label: 'ADM', kind: 'icon', icon: 'file', tone: 'purple', ariaLabel: 'Admission letters' },
  cbt: { label: 'JAMB', secondary: 'CBT', kind: 'wordmark', tone: 'blue', ariaLabel: 'JAMB computer based test' },
  services: { label: 'ER', kind: 'icon', icon: 'briefcase', tone: 'slate', ariaLabel: 'EduReach student services' },
};

const contentIdentities: Record<string, CardIdentity> = {
  news: { label: '', kind: 'icon', icon: 'news', tone: 'slate', ariaLabel: 'News' },
  jobs: { label: '', kind: 'icon', icon: 'briefcase', tone: 'purple', ariaLabel: 'Student opportunities' },
};

export function serviceCardIdentity(serviceKey: string): CardIdentity {
  return serviceIdentities[serviceKey] || {
    label: 'ER',
    kind: 'wordmark',
    tone: 'slate',
    ariaLabel: 'EduReach service',
  };
}

export function newsCardIdentity(category: string): CardIdentity {
  const key = category.toLowerCase();
  if (key.includes('jamb')) return { label: 'JAMB', kind: 'wordmark', tone: 'blue', ariaLabel: 'JAMB news' };
  if (key.includes('fund') || key.includes('nelfund')) return { label: 'NELFUND', kind: 'wordmark', tone: 'green', ariaLabel: 'NELFUND news' };
  if (key.includes('admission')) return { label: 'ADM', kind: 'icon', icon: 'file', tone: 'purple', ariaLabel: 'Admission news' };
  if (key.includes('result') || key.includes('waec') || key.includes('neco')) return { label: 'WAEC', secondary: 'NECO', kind: 'wordmark', tone: 'blue', ariaLabel: 'WAEC and NECO results news' };
  if (key.includes('opportun') || key.includes('job')) return contentIdentities.jobs;
  return contentIdentities.news;
}

export function upcomingCardIdentity(kind: 'deadline' | 'exam'): CardIdentity {
  return kind === 'exam'
    ? { label: 'CBT', kind: 'icon', icon: 'brain', tone: 'blue', ariaLabel: 'Examination' }
    : { label: 'DUE', kind: 'icon', icon: 'calendar', tone: 'amber', ariaLabel: 'Deadline' };
}

export function contentCardIdentity(key: string): CardIdentity {
  return contentIdentities[key] || {
    label: 'ER',
    kind: 'wordmark',
    tone: 'slate',
    ariaLabel: 'EduReach',
  };
}
