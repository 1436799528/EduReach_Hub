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
  brand: 'Eduleb',
  tagline: 'Smart Study Where Knowledge Meets the Web',
  email: 'hello@eduleb-demo.com',
  phone: '+234 803 555 0123',
  address: '12 Learning Avenue, Calabar, Cross River, Nigeria',
  description: 'A modern online learning platform for practical skills, academic support and career development.',
};

export const testimonials = [
  { name: 'Blessing Ekanem', company: 'UNICAL', text: 'The lessons are easy to follow and the project examples make the topics much easier to understand.' },
  { name: 'Samuel Peter', company: 'Student Entrepreneur', text: 'I used the support to organise my small service, price it better and track what I was actually earning.' },
  { name: 'Miriam James', company: 'Engineering Student', text: 'The guidance helped me connect what I read in class with practical academic problems.' },
];

export const blogPosts: BlogPost[] = [
  { id: 'study-smarter', title: '7 Simple Ways to Study Smarter Before Exams', category: 'Education', date: 'Sep 02, 2026', author: 'Eduleb Team', excerpt: 'A practical study routine for students who want better results without spending every hour at their desk.', image: `${theme}/cat3.jpg` },
  { id: 'python-engineering', title: 'Why Engineering Students Should Learn Python', category: 'Programming', date: 'Aug 26, 2026', author: 'Eduleb Team', excerpt: 'From calculations to automation and data analysis, Python can become a useful part of an engineer’s toolkit.', image: `${theme}/cat2.jpg` },
  { id: 'portfolio', title: 'Build a Portfolio Before You Start Applying', category: 'Career', date: 'Aug 19, 2026', author: 'Eduleb Team', excerpt: 'Your portfolio does not need to be huge. It needs to clearly show what you can do and how you think.', image: `${theme}/cat7.jpg` },
];
