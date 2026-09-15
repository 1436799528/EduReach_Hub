# Edurecah

Edurecah is a student platform for Nigerian tertiary students.

## Product architecture

The frontend now follows the 22-page Edurecah architecture:

1. `/` — student action dashboard
2. `/search` — global search
3. `/about` — platform overview
4. `/login`, `/register`, `/forgot-password` — authentication
5. `/cbt` — CBT lobby
6. `/cbt/:exam-type` — exam and subject selection
7. `/cbt/session/:id` — active CBT session
8. `/cbt/result/:id` — performance analytics
9. `/services` — services directory
10. `/services/:service-slug` — service application
11. `/services/track` — request tracking
12. `/news` — news feed
13. `/schools` — school directory
14. `/news/:slug` — article detail
15. `/opportunities` — jobs and scholarships
16. `/opportunities/:slug` — opportunity detail
17. `/community` — Q&A/community
18. `/groups` — study groups
19. `/dashboard` — student dashboard
20. `/dashboard/orders` — order and transaction history
21. `/dashboard/profile` — profile settings
22. `/admin` — admin control panel

The old Eduleb page structure, shared shell, styles, mock data and frontend route modules have been removed from the active product architecture.

## Stack

- React + Vite + TypeScript
- Supabase Auth + PostgreSQL
- lucide-react
- Responsive custom Edurecah design system

## Development

```bash
npm install
npm run dev
```
