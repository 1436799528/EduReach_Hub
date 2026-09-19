export type CardIdentity = {
  label: string;
  secondary?: string;
  kind: 'wordmark' | 'icon';
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate';
  imageUrls?: string[];
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
// Use recognizable examination/service identities rather than generic coloured card icons.
// JAMB and WAEC URLs are served by their official portals; NELFUND and the neutral
// study/CBT marks use stable Wikimedia-hosted assets.
const JAMB_LOGO_URL = 'https://centres.jamb.gov.ng/assets/images/icon/jamblogo.png';
const WAEC_LOGO_URL = 'https://examiners.waecnigeria.org/seapdc/images/bgLogo.png';
const NECO_LOGO_URL = 'https://raw.githubusercontent.com/Drslope-99/gradeup/edb86d539020b90996899b00721237350717d7d7/public/images/neco.png';
const NELFUND_LOGO_URL = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nigerian_Education_Loan_Fund_%28NELFUND%29.png';
const CBT_ICON_URL = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/ComputerScreen.svg';
const PAST_QUESTIONS_ICON_URL = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Book_with_bookmark_Pinhead_icon.svg';

export const serviceVisuals: Record<string, CardIdentity> = {
  'nelfund-loan': {
    label: 'NELFUND',
    imageUrls: [NELFUND_LOGO_URL],
    secondary: 'LOAN',
    kind: 'wordmark',
    tone: 'green',
    ariaLabel: 'NELFUND student loan application',
  },
  results: {
    label: 'WAEC',
    secondary: 'NECO',
    imageUrls: [WAEC_LOGO_URL, NECO_LOGO_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'WAEC and NECO result checking',
  },
  'scratch-cards': {
    label: 'WAEC',
    secondary: 'NECO PIN',
    imageUrls: [WAEC_LOGO_URL, NECO_LOGO_URL],
    kind: 'wordmark',
    tone: 'amber',
    ariaLabel: 'WAEC and NECO scratch cards',
  },
  'jamb-slip': {
    label: 'JAMB',
    secondary: 'SLIP',
    imageUrls: [JAMB_LOGO_URL],
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
    label: 'CBT',
    secondary: 'PRACTICE',
    imageUrls: [CBT_ICON_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'Computer based test practice',
  },
  'jamb-result': {
    label: 'JAMB',
    secondary: 'RESULT',
    imageUrls: [JAMB_LOGO_URL],
    kind: 'wordmark',
    tone: 'blue',
    ariaLabel: 'JAMB result checking',
  },
  'past-questions': {
    label: 'PAST',
    secondary: 'QUESTIONS',
    imageUrls: [PAST_QUESTIONS_ICON_URL],
    kind: 'wordmark',
    tone: 'purple',
    ariaLabel: 'Past questions and exam practice',
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
  const key = serviceKey.toLowerCase();

  // Exact mappings take priority so the same identity is reused everywhere.
  if (serviceVisuals[key]) return serviceVisuals[key];

  // Future service_catalog rows can use descriptive keys without needing another
  // component or another card-specific icon mapping.
  if (key.includes('nelfund') || key.includes('student-loan')) return serviceVisuals['nelfund-loan'];
  if (key.includes('jamb') && key.includes('result')) return serviceVisuals['jamb-result'];
  if (key.includes('jamb')) return serviceVisuals['jamb-slip'];
  if (key.includes('waec') && key.includes('neco')) return serviceVisuals.results;
  if (key.includes('waec') || key.includes('neco')) {
    return {
      ...(key.includes('neco') ? serviceVisuals.results : serviceVisuals.results),
      ariaLabel: key.includes('neco') ? 'NECO result or examination service' : 'WAEC result or examination service',
    };
  }
  if (key.includes('past') || key.includes('question') || key.includes('practice')) return serviceVisuals['past-questions'];
  if (key.includes('cbt')) return serviceVisuals.cbt;

  return {
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
