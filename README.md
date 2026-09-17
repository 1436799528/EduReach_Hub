# EduReach Hub

EduReach Hub is a student-focused platform for Nigerian tertiary students, combining student services, CBT practice, academic updates and opportunities in one responsive workspace.

## Final application architecture

The browser entry point is `src/main.tsx`, which renders `src/HubApp.tsx`. There is one active page system; the old Eduleb page layer has been removed.

### Public routes

- `/` — student services and updates hub
- `/login` or `/signin` — sign in
- `/register` or `/signup` — create account
- `/forgot-password` — password reset
- `/dashboard` — student workspace
- `/cbt` — CBT setup
- `/cbt/practice` — active CBT session
- `/cbt/results` — CBT result review
- `/services` — service catalogue
- `/services/:service-slug` — direct service entry
- `/services/apply/:service-slug` — service application wizard
- `/services/track` — request tracker
- `/news` — academic/news feed
- `/news/:slug` — article detail
- `/jobs` — student opportunities

### Admin routes

- `/admin` — operations dashboard
- `/admin/queue` — service processing queue
- `/admin/cbt` — CBT question bank
- `/admin/vouchers` — scratch-card inventory
- `/admin/users` — student accounts

## Layout direction

Content-heavy student pages use a MySchool-style desktop composition: the main page stays on the left while a reusable student rail fills the right side with quick tools, service shortcuts, recent updates and tracking support. On tablets and phones, the rail becomes a normal section beneath the main content so nothing is squeezed horizontally.

The home page and student dashboard already have their own multi-column layouts, so the shared rail is used where it improves density without duplicating existing sidebars.

## Core services

1. NELFUND Loan Application
2. WAEC / NECO Result Checking
3. WAEC / NECO Scratch Cards
4. JAMB Exam Slip Printing
5. Admission Deferment & Supplementary Letters

## Stack

- React + Vite + TypeScript
- Supabase Auth + PostgreSQL
- Lucide React icons
- Custom EduReach Hub visual system
- Responsive desktop / tablet / mobile layouts

## Development

```bash
npm install
npm run dev
```
