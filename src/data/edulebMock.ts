export type BlogPost = {
  id: string;
  title: string;
  category: string;
  date: string;
  author: string;
  excerpt: string;
  image: string;
};

const theme = 'https://themewagon.github.io/eduleb/assets/img';

export const siteConfig = {
  brand: 'EduReach Hub',
  tagline: 'Practical support for Nigerian tertiary students',
  email: 'hello@edureachhub.com',
  phone: '+234 803 555 0123',
  address: 'Nigeria',
  description: 'School information, documents, resources, and everyday academic tools in one place.',
};

export const testimonials = [
  { name: 'Nigerian Tertiary Student', company: 'EduReach User', text: 'EduReach brings the small academic things I need into one place instead of making me search everywhere.' },
  { name: 'Engineering Student', company: 'EduReach User', text: 'The platform makes it easier to find guidance, tools and useful information when school work becomes difficult.' },
  { name: 'University Student', company: 'EduReach User', text: 'I like the simple approach. I can find what I need without moving through many confusing pages.' },
];

export const blogPosts: BlogPost[] = [
  { id: 'study-smarter', title: '7 Simple Ways to Study Smarter Before Exams', category: 'Education', date: 'Sep 02, 2026', author: 'EduReach Team', excerpt: 'Simple study habits that help you prepare better without turning every day into a long study session.', image: `${theme}/cat3.jpg` },
  { id: 'school-documents', title: 'Important School Documents Every Student Should Know', category: 'Student Guide', date: 'Aug 26, 2026', author: 'EduReach Team', excerpt: 'A practical guide to the letters, forms and academic documents students commonly need.', image: `${theme}/cat2.jpg` },
  { id: 'student-tools', title: 'Useful Tools That Can Make Student Life Easier', category: 'Student Support', date: 'Aug 19, 2026', author: 'EduReach Team', excerpt: 'From grade calculations to finding academic information, small tools can save students time and stress.', image: `${theme}/cat7.jpg` },
];
