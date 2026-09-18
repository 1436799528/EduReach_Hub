const imageBase = 'https://themewagon.github.io/eduleb/assets/img';

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
