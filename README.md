# Eduleb Demo Site

This repository contains the React implementation of the Eduleb educational website architecture, populated with editable mock data.

## Editable page map

The active page source is the top-level `pages/` directory:

- `index.html` -> `pages/Home01.tsx`
- `index2.html` -> `pages/Home02.tsx`
- `about.html` -> `pages/AboutPage.tsx`
- `course.html` -> `pages/CoursePage.tsx`
- `course_details.html` -> `pages/CoursePage.tsx` (`CourseDetailsPage`)
- `instructor.html` -> `pages/InstructorPage.tsx`
- `instructor_details.html` -> `pages/InstructorPage.tsx` (`InstructorDetailsPage`)
- `pricing_plan.html` -> `pages/PricingPage.tsx`
- `faq.html` -> `pages/FAQPage.tsx`
- `blog.html` -> `pages/BlogPage.tsx`
- `blog_details.html` -> `pages/BlogPage.tsx` (`BlogDetailsPage`)
- `contact.html` -> `pages/ContactPage.tsx`
- `404.html` -> `pages/ErrorPage.tsx`

The aliases `ins_details.html`, `pricing.html`, and `blog_single.html` point to the corresponding active page components.

## Shared architecture

- `src/App.tsx` handles the page map.
- `src/components/EdulebShared.tsx` contains the shared header, banner, footer and shell.
- `src/components/EdulebCards.tsx` contains reusable course, instructor, blog and homepage cards.
- `src/data/edulebMock.ts` contains the editable mock catalogue, instructors, blog posts, FAQs and pricing plans.
- `src/index.css` contains project overrides while the native Eduleb/Bootstrap assets are loaded consistently for every page entry.

## Development

```bash
npm install
npm run dev
```

Open the development server on port 3000.
