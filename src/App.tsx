import { Home01 } from '../pages/Home01';
import { Home02 } from '../pages/Home02';
import AboutPage from '../pages/AboutPage';
import CoursePage, { CourseDetailsPage } from '../pages/CoursePage';
import InstructorPage, { InstructorDetailsPage } from '../pages/InstructorPage';
import PricingPage from '../pages/PricingPage';
import FAQPage from '../pages/FAQPage';
import BlogPage, { BlogDetailsPage } from '../pages/BlogPage';
import ContactPage from '../pages/ContactPage';
import ErrorPage from '../pages/ErrorPage';

const aliases: Record<string, string> = {
  '/ins_details.html': '/instructor_details.html',
  '/pricing.html': '/pricing_plan.html',
  '/blog_single.html': '/blog_details.html',
};

export default function App() {
  const raw = window.location.pathname.replace(/\/+$/, '') || '/';
  const path = aliases[raw] || raw;
  switch (path) {
    case '/':
    case '/index.html': return <Home01 />;
    case '/index2.html': return <Home02 />;
    case '/about.html': return <AboutPage />;
    case '/course.html': return <CoursePage />;
    case '/course_details.html': return <CourseDetailsPage />;
    case '/instructor.html': return <InstructorPage />;
    case '/instructor_details.html': return <InstructorDetailsPage />;
    case '/pricing_plan.html': return <PricingPage />;
    case '/faq.html': return <FAQPage />;
    case '/blog.html': return <BlogPage />;
    case '/blog_details.html': return <BlogDetailsPage />;
    case '/contact.html': return <ContactPage />;
    case '/404.html': return <ErrorPage />;
    default: return <ErrorPage />;
  }
}
