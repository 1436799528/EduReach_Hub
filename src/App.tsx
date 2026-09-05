import type { ReactElement } from 'react';
import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import ServicesPage from '../pages/ServicesPage';
import BlogPage from '../pages/BlogPage';
import ContactPage from '../pages/ContactPage';

export default function App(): ReactElement {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/about') return <AboutPage />;
  if (path === '/services') return <ServicesPage />;
  if (path === '/blog') return <BlogPage />;
  if (path === '/contact') return <ContactPage />;
  return <HomePage />;
}
