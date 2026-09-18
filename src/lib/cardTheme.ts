export type CardIdentity = {
  label: string;
  secondary?: string;
  kind: 'wordmark' | 'icon';
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate';
  icon?:
    | 'banknote'
    | 'brain'
    | 'briefcase'
    | 'calendar'
    | 'card'
    | 'file'
    | 'news'
    | 'printer'
    | 'user'
    | 'wallet'
    | 'receipt'
    | 'graduation'
    | 'clipboard';
  ariaLabel: string;
};

/**
 * Visual identity is data, not photography.
 * Keep service identity here so the same recognizable mark is reused on
 * cards, lists, side rails, CBT, news, dashboard and future screens.
 */
export const serviceVisuals: Record<string, CardIdentity> = {
  'nelfund-loan': {
    label: 'NELFUND',
    secondary: 'LOAN',
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'NELFUND student loan application',
  },
  results: {
    label: 'WAEC',
    secondary: 'NECO',
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'WAEC and NECO result checking',
  },
  'scratch-cards': {
    label: 'WAEC',
    secondary: 'NECO PIN',
    kind: 'wordmark',
    tone: 'amber',
    ariaLabel: 'WAEC and NECO scratch cards',
  },
  'jamb-slip': {
    label: 'JAMB',
    secondary: 'SLIP',
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB examination slip printing',
  },
  'admission-letters': {
    label: 'ADM',
    kind: 'icon',
    icon: 'file',
    tone: 'purple',
    ariaLabel: 'Admission deferment and supplementary letters',
  },
  cbt: {
    label: 'JAMB',
    secondary: 'CBT',
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB computer based test practice',
  },
  services: {
    label: 'ER',
    kind: 'icon',
    icon: 'briefcase',
    tone: 'slate',
    ariaLabel: 'EduReach student services',
  },
};

export const contentVisuals: Record<string, CardIdentity> = {
  news: {
    label: '',
    kind: 'icon',
    icon: 'news',
    tone: 'slate',
    ariaLabel: 'News and academic updates',
  },
  jobs: {
    label: '',
    kind: 'icon',
    icon: 'briefcase',
    tone: 'purple',
    ariaLabel: 'Student jobs and opportunities',
  },
  admissions: {
    label: 'ADM',
    kind: 'icon',
    icon: 'graduation',
    tone: 'purple',
    ariaLabel: 'Admissions',
  },
  payments: {
    label: '',
    kind: 'icon',
    icon: 'wallet',
    tone: 'green',
    ariaLabel: 'Student payments',
  },
  profile: {
    label: '',
    kind: 'icon',
    icon: 'user',
    tone: 'slate',
    ariaLabel: 'Student profile',
  },
  results: serviceVisuals.results,
  jamb: {
    label: 'JAMB',
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB',
  },
  cbt: serviceVisuals.cbt,
  nelfund: serviceVisuals['nelfund-loan'],
};

export function serviceCardIdentity(serviceKey: string): CardIdentity {
  return serviceVisuals[serviceKey] ?? {
    label: 'ER',
    kind: 'wordmark',
    tone: 'slate',
    ariaLabel: 'EduReach service',
  };
}

export function newsCardIdentity(category: string): CardIdentity {
  const key = category.toLowerCase();

  if (key.includes('jamb')) {
    return { ...serviceVisuals.jamb, ariaLabel: 'JAMB news' };
  }
  if (key.includes('fund') || key.includes('nelfund')) {
    return { ...serviceVisuals.nelfund, ariaLabel: 'NELFUND news' };
  }
  if (key.includes('admission') || key.includes('post-utme')) {
    return {
      label: 'ADM',
      kind: 'icon',
      icon: 'graduation',
      tone: 'purple',
      ariaLabel: 'Admission news',
    };
  }
  if (key.includes('result') || key.includes('waec') || key.includes('neco')) {
    return { ...serviceVisuals.results, ariaLabel: 'WAEC and NECO result news' };
  }
  if (key.includes('opportun') || key.includes('job') || key.includes('scholar')) {
    return contentVisuals.jobs;
  }

  return contentVisuals.news;
}

export function upcomingCardIdentity(kind: 'deadline' | 'exam'): CardIdentity {
  return kind === 'exam'
    ? {
        label: 'CBT',
        kind: 'icon',
        icon: 'brain',
        tone: 'blue',
        ariaLabel: 'Examination',
      }
    : {
        label: 'DUE',
        kind: 'icon',
        icon: 'calendar',
        tone: 'amber',
        ariaLabel: 'Deadline',
      };
}

export function contentCardIdentity(key: string): CardIdentity {
  return contentVisuals[key] ?? {
    label: 'ER',
    kind: 'wordmark',
    tone: 'slate',
    ariaLabel: 'EduReach',
  };
}
