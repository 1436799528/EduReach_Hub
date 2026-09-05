export type Course = {
  id: string;
  title: string;
  category: string;
  lessons: number;
  duration: string;
  price: string;
  level: string;
  rating: string;
  image: string;
  description: string;
};

export type Instructor = {
  id: string;
  name: string;
  role: string;
  courses: number;
  students: number;
  bio: string;
  initials: string;
};

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

export const stats = [
  { value: '4,500+', label: 'Active student' },
  { value: '134', label: 'Our Online Course' },
  { value: '29', label: 'Academic Programs' },
  { value: '684', label: 'Certified Students' },
  { value: '9,410', label: 'Enrolled Students' },
];

export const categories = [
  { name: 'Electrical Engineering', count: 18, image: `${theme}/cat1.jpg` },
  { name: 'Programming', count: 26, image: `${theme}/cat2.jpg` },
  { name: 'UI/UX Design', count: 14, image: `${theme}/cat3.jpg` },
  { name: 'Digital Marketing', count: 21, image: `${theme}/cat4.jpg` },
  { name: 'Data Science', count: 12, image: `${theme}/cat5.jpg` },
  { name: 'Business & Finance', count: 16, image: `${theme}/cat6.jpg` },
  { name: 'Graphic Design', count: 15, image: `${theme}/cat7.jpg` },
  { name: 'Personal Development', count: 12, image: `${theme}/cat8.jpg` },
];

export const courses: Course[] = [
  {
    id: 'electrical-fundamentals',
    title: 'Electrical Engineering Fundamentals',
    category: 'Electrical Engineering',
    lessons: 28,
    duration: '8 Hrs 20 Min',
    price: '₦15,000',
    level: 'Beginner',
    rating: '4.9',
    image: `${theme}/cat1.jpg`,
    description: 'Build a strong foundation in circuits, measurements, Ohm’s law, power systems basics and safe laboratory practice.',
  },
  {
    id: 'python-engineering',
    title: 'Python for Engineers: From Zero to Projects',
    category: 'Programming',
    lessons: 34,
    duration: '10 Hrs 15 Min',
    price: '₦12,500',
    level: 'Beginner',
    rating: '4.8',
    image: `${theme}/cat2.jpg`,
    description: 'Learn Python through engineering examples, data handling, plotting and practical mini-projects.',
  },
  {
    id: 'uiux-student',
    title: 'UI/UX Design for Student Portfolios',
    category: 'UI/UX Design',
    lessons: 22,
    duration: '6 Hrs 40 Min',
    price: '₦10,000',
    level: 'Intermediate',
    rating: '4.7',
    image: `${theme}/cat3.jpg`,
    description: 'Turn ideas into simple, useful interfaces and build a portfolio that demonstrates your design thinking.',
  },
  {
    id: 'data-analysis',
    title: 'Practical Data Analysis with Excel & Python',
    category: 'Data Science',
    lessons: 31,
    duration: '9 Hrs 05 Min',
    price: '₦18,000',
    level: 'Intermediate',
    rating: '4.9',
    image: `${theme}/cat5.jpg`,
    description: 'Clean datasets, calculate useful metrics and communicate findings with professional charts and reports.',
  },
  {
    id: 'digital-marketing',
    title: 'Digital Marketing for Small Businesses',
    category: 'Digital Marketing',
    lessons: 19,
    duration: '5 Hrs 50 Min',
    price: '₦9,500',
    level: 'Beginner',
    rating: '4.6',
    image: `${theme}/cat4.jpg`,
    description: 'Create practical marketing campaigns, understand social media funnels and measure results.',
  },
  {
    id: 'technical-drawing',
    title: 'Technical Drawing & Engineering Graphics',
    category: 'Engineering',
    lessons: 24,
    duration: '7 Hrs 30 Min',
    price: '₦11,000',
    level: 'Beginner',
    rating: '4.8',
    image: `${theme}/cat7.jpg`,
    description: 'Understand drawing standards, dimensioning, orthographic views and clear technical communication.',
  },
  {
    id: 'career-readiness',
    title: 'Career Readiness for Final-Year Students',
    category: 'Personal Development',
    lessons: 16,
    duration: '4 Hrs 10 Min',
    price: 'Free',
    level: 'All levels',
    rating: '4.9',
    image: `${theme}/cat8.jpg`,
    description: 'Prepare a strong CV, portfolio and interview strategy for your first internship, placement or graduate role.',
  },
  {
    id: 'entrepreneurship',
    title: 'Student Entrepreneurship & Business Basics',
    category: 'Business & Finance',
    lessons: 20,
    duration: '5 Hrs 35 Min',
    price: '₦8,500',
    level: 'Beginner',
    rating: '4.7',
    image: `${theme}/cat6.jpg`,
    description: 'Learn how to validate an idea, price a service, track money and grow a small student-led business.',
  },
];

export const instructors: Instructor[] = [
  {
    id: 'amara-okafor', name: 'Amara Okafor', role: 'Electrical Engineering Tutor', courses: 9, students: 1280,
    bio: 'University lecturer and practical engineering educator focused on circuits, machines and laboratory skills.', initials: 'AO',
  },
  {
    id: 'daniel-obi', name: 'Daniel Obi', role: 'Software & Python Instructor', courses: 11, students: 1940,
    bio: 'Software engineer who teaches programming with beginner-friendly projects and clear engineering examples.', initials: 'DO',
  },
  {
    id: 'fatima-bello', name: 'Fatima Bello', role: 'UI/UX & Creative Design', courses: 7, students: 860,
    bio: 'Product designer helping students learn practical design, portfolio building and user-centred thinking.', initials: 'FB',
  },
  {
    id: 'emeka-nwachukwu', name: 'Emeka Nwachukwu', role: 'Data & Business Analytics', courses: 8, students: 1120,
    bio: 'Analytics consultant focused on turning real-world data into simple decisions and useful dashboards.', initials: 'EN',
  },
];

export const testimonials = [
  { name: 'Blessing Ekanem', company: 'UNICAL', text: 'The lessons are easy to follow and the project examples make the topics much easier to understand.' },
  { name: 'Samuel Peter', company: 'Student Entrepreneur', text: 'I used the business lessons to organise my small service, price it better and track what I was actually earning.' },
  { name: 'Miriam James', company: 'Engineering Student', text: 'The engineering course helped me connect what I read in class with practical circuit and measurement problems.' },
];

export const blogPosts: BlogPost[] = [
  { id: 'study-smarter', title: '7 Simple Ways to Study Smarter Before Exams', category: 'Education', date: 'Sep 02, 2026', author: 'Eduleb Team', excerpt: 'A practical study routine for students who want better results without spending every hour at their desk.', image: `${theme}/cat3.jpg` },
  { id: 'python-engineering', title: 'Why Engineering Students Should Learn Python', category: 'Programming', date: 'Aug 26, 2026', author: 'Daniel Obi', excerpt: 'From calculations to automation and data analysis, Python can become a useful part of an engineer’s toolkit.', image: `${theme}/cat2.jpg` },
  { id: 'portfolio', title: 'Build a Portfolio Before You Start Applying', category: 'Career', date: 'Aug 19, 2026', author: 'Fatima Bello', excerpt: 'Your portfolio does not need to be huge. It needs to clearly show what you can do and how you think.', image: `${theme}/cat7.jpg` },
  { id: 'study-groups', title: 'How to Make Student Study Groups Actually Work', category: 'Education', date: 'Aug 12, 2026', author: 'Eduleb Team', excerpt: 'Set a clear goal, assign roles and keep meetings short enough that people stay consistent.', image: `${theme}/cat1.jpg` },
  { id: 'internship', title: 'What to Prepare Before Your Engineering Internship', category: 'Career', date: 'Aug 05, 2026', author: 'Amara Okafor', excerpt: 'The best internship preparation starts before your first day. Here is a practical checklist.', image: `${theme}/cat6.jpg` },
  { id: 'learning-online', title: 'How to Learn Online Without Losing Focus', category: 'Learning', date: 'Jul 28, 2026', author: 'Eduleb Team', excerpt: 'Use a simple weekly plan, remove distractions and track small wins to stay consistent.', image: `${theme}/cat8.jpg` },
];

export const faqs = [
  { question: 'Is the content on this site real?', answer: 'No. This first production-style build is intentionally populated with realistic mock data so you can review the layout, information hierarchy and user flow before replacing it with real records.' },
  { question: 'Can students search for courses?', answer: 'Yes. The course search on the demo filters the seeded course catalogue by title, category and level.' },
  { question: 'Can an instructor have a profile page?', answer: 'Yes. The instructor list links to an instructor detail route that can later be backed by a database record.' },
  { question: 'Can paid and free courses exist together?', answer: 'Yes. Courses already support a simple display price such as Free or a naira amount. Payment processing can be connected later without changing the public page structure.' },
  { question: 'Is the site responsive?', answer: 'Yes. The layout follows the Bootstrap/Eduleb responsive pattern and includes mobile navigation for smaller screens.' },
];

export const pricingPlans = [
  { name: 'Starter', price: 'Free', period: 'Forever', description: 'For students exploring the platform.', features: ['Access to free courses', 'Course bookmarks', 'Basic progress tracking', 'Community learning content'] },
  { name: 'Learner', price: '₦4,500', period: 'per month', description: 'For students who want more structured learning.', features: ['All free courses', 'Premium course catalogue', 'Learning progress dashboard', 'Certificates on eligible courses', 'Priority support'] },
  { name: 'Campus', price: '₦35,000', period: 'per semester', description: 'For departments, clubs and study groups.', features: ['Group learner seats', 'Department learning spaces', 'Instructor management', 'Progress reporting', 'Priority onboarding'] },
];

export const getCourse = (id: string) => courses.find((course) => course.id === id);
export const getInstructor = (id: string) => instructors.find((instructor) => instructor.id === id);
export const getBlogPost = (id: string) => blogPosts.find((post) => post.id === id);
