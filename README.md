# EduReach Hub

EduReach Hub is a student-focused platform for Nigerian tertiary students, built around practical services, academic updates and clear next-step guidance.

## Final public architecture

The active frontend intentionally uses one public page structure with no duplicate legacy page implementations:

- `/` — EduReach home
- `/about` — platform overview
- `/services` — five core student services
- `/services/:service-key` — individual service guidance and support request
- `/blog` — news, updates and campus gist
- `/blog/:article-id` — article details
- `/contact` — general support contact

Authentication is handled through the shared Sign In / Sign Up modal and Supabase Auth.

## Layout direction

Interior pages use an Eduleb-inspired main-content layout with a reusable student rail on wider screens. The rail contains quick links, service shortcuts, recent updates and support navigation. On smaller screens it moves below the main content so it remains useful without wasting horizontal space.

## Core services

1. NELFUND Loan Application
2. WAEC / NECO Result Checking
3. WAEC / NECO Scratch Cards
4. JAMB Exam Slip Printing
5. Admission Deferment & Supplementary Letters

## Stack

- React + Vite + TypeScript
- Supabase Auth + PostgreSQL
- Eduleb visual/template foundation
- Custom EduReach content and service architecture

## Development

```bash
npm install
npm run dev
```
