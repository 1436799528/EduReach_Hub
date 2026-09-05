import Home01 from '../pages/Home01';
import Home02 from '../pages/Home02';
import AboutPage from '../pages/AboutPage';
import CoursePage, { CourseDetailsPage } from '../pages/CoursePage';
import InstructorPage, { InstructorDetailsPage } from '../pages/InstructorPage';
import PricingPage from '../pages/PricingPage';
import FAQPage from '../pages/FAQPage';
import BlogPage, { BlogDetailsPage } from '../pages/BlogPage';
import ContactPage from '../pages/ContactPage';
import ErrorPage from '../pages/ErrorPage';

const routes: Record<string, () => JSX.Element> = {
  '/': Home01,
  '/index.html': Home01,
  '/index2.html': Home02,
  '/about.html': AboutPage,
  '/course.html': CoursePage,
  '/course_details.html': CourseDetailsPage,
  '/instructor.html': InstructorPage,
  '/instructor_details.html': InstructorDetailsPage,
  '/ins_details.html': InstructorDetailsPage,
  '/pricing_plan.html': PricingPage,
  '/pricing.html': PricingPage,
  '/faq.html': FAQPage,
  '/404.html': ErrorPage,
  '/blog.html': BlogPage,
  '/blog_details.html': BlogDetailsPage,
  '/blog_single.html': BlogDetailsPage,
  '/contact.html': ContactPage,
};

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const Page = routes[path] || ErrorPage;
  return <Page />;
}
