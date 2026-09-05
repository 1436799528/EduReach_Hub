import React from 'react';

const EDULEB_BASE = 'https://themewagon.github.io/eduleb';

const EDULEB_PAGES: Record<string, string> = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/index2.html': 'index2.html',
  '/about.html': 'about.html',
  '/course.html': 'course.html',
  '/course_details.html': 'course_details.html',
  '/instructor.html': 'instructor.html',
  '/instructor_details.html': 'instructor_details.html',
  '/pricing_plan.html': 'pricing_plan.html',
  '/faq.html': 'faq.html',
  '/404.html': '404.html',
  '/blog.html': 'blog.html',
  '/blog_details.html': 'blog_details.html',
  '/contact.html': 'contact.html',
};

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = EDULEB_PAGES[path] ?? EDULEB_PAGES['/404.html'];

  return (
    <main className="eduleb-shell">
      <iframe
        title="Eduleb"
        src={`${EDULEB_BASE}/${page}`}
        className="eduleb-frame"
        loading="eager"
        allowFullScreen
      />
    </main>
  );
}
