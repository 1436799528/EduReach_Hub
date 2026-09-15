# Edurecah

Edurecah is a student platform for Nigerian tertiary students.

## Product architecture

The frontend follows the new Edurecah product architecture:

- `/` — student action dashboard
- `/search` — global search
- `/about` — platform overview
- `/login`, `/register`, `/forgot-password` — authentication
- `/cbt` — CBT lobby
- `/cbt/:exam-type` — exam and subject selection
- `/cbt/session/:id` — active CBT session
- `/cbt/result/:id` — performance analytics
- `/services` — services directory
- `/services/:service-slug` — service application
- `/services/track` — request tracking
- `/news` — news feed
- `/schools` — school directory
- `/news/:slug` — article detail
- `/opportunities` — jobs and scholarships
- `/opportunities/:slug` — opportunity detail
- `/community` — Q&A/community
- `/groups` — study groups
- `/dashboard` — student dashboard
- `/dashboard/orders` — order and transaction history
- `/dashboard/profile` — profile settings
- `/admin` — admin control panel

The old Eduleb page structure, shared shell, styles and mock content are being removed from the active product architecture.

## Stack

- React + Vite + TypeScript
- Supabase Auth + PostgreSQL
- lucide-react
- Custom Edurecah design system

## Development

```bash
npm install
npm run dev
```
