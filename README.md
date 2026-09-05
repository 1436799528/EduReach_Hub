# Eduleb Landing Page

This repository now contains one public Eduleb-style landing page.

## Public navigation

The landing page contains exactly five sections:

- Home
- About
- Services
- Blog
- Contact

Sign In and Sign Up remain available from the header as working Supabase email/password authentication modals.

## Main source files

- `index.html` — the single browser entry point
- `pages/HomePage.tsx` — the complete landing page
- `src/components/EdulebShared.tsx` — shared header, footer and page shell
- `src/components/AuthModal.tsx` — Supabase sign-in/sign-up interface
- `src/lib/supabase.ts` — Supabase browser client
- `src/data/edulebMock.ts` — editable landing-page content data
- `src/index.css` — Eduleb-compatible styling and landing-page overrides

All obsolete public pages and their route modules have been removed from the frontend.

## Authentication

The authentication UI uses the Supabase browser client with email/password sign-up and sign-in. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` for local development; the code also has the current project configuration as a frontend-safe fallback.

## Development

```bash
npm install
npm run dev
```

Open the development server on port 3000.
