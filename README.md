# EduReach Hub

EduReach Hub is a student-focused platform for Nigerian tertiary students, combining student services, CBT practice, verified academic updates and student opportunities in one responsive workspace.

## Application architecture

The browser entry point is `src/main.tsx`, which renders `src/HubApp.tsx`. The active frontend is React + Vite with an Express production server. Supabase provides authentication and database access; server-side endpoints handle trusted operations such as CBT scoring and payment verification.

### Public routes

- `/` — student services and verified updates hub
- `/login` or `/signin` — sign in
- `/register` or `/signup` — create account
- `/forgot-password` — password recovery / password update
- `/dashboard` — authenticated student workspace
- `/cbt` — CBT setup
- `/cbt/practice` — active CBT session
- `/cbt/results` — authenticated CBT result review
- `/services` — service catalogue
- `/services/:service-slug` — direct service entry
- `/services/apply/:service-slug` — authenticated service request wizard
- `/services/track` — authenticated request tracker
- `/news` — verified academic/news feed
- `/news/:slug` — verified article detail
- `/jobs` — student opportunities

### Admin routes

- `/admin` — operations dashboard
- `/admin/queue` — service processing queue
- `/admin/cbt` — CBT question bank
- `/admin/vouchers` — scratch-card inventory
- `/admin/users` — student accounts

## Core services

1. NELFUND Loan Application
2. WAEC / NECO Result Checking
3. WAEC / NECO Scratch Cards
4. JAMB Exam Slip Printing
5. Admission Deferment & Supplementary Letters

## Production backend

### Supabase

The current production schema already contains the main service, account, CBT, wallet and announcement tables. RLS is enabled on the exposed tables. Service requests are tied to the authenticated user and receive server/database-generated reference codes.

Key tables include:

- `profiles`
- `service_catalog`
- `service_requests`
- `cbt_exams`
- `exam_questions`
- `cbt_attempts`
- `cbt_answers`
- `news_articles`
- `student_wallets`
- `wallet_transactions`

### Server API

- `GET /api/health` — service health/configuration check
- `GET /api/news` — verified published announcements
- `GET /api/news/:slug` — verified announcement detail
- `GET /api/cbt/exams/:examId/questions` — active exam questions without answer keys
- `POST /api/cbt/submit` — authenticated server-side scoring and attempt persistence
- `POST /api/wallet/verify` — authenticated Paystack verification and wallet credit
- `POST /api/webhooks/paystack` — signed Paystack webhook handler
- `/api/admin/*` — protected administrative endpoints

### Security rules

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` to the browser. Browser code uses the Supabase publishable key only. Authentication is enforced before service requests, student dashboards, CBT submissions and wallet verification. New Supabase accounts automatically receive their student profile and wallet through the canonical auth triggers.

Wallet credit is idempotent on the Paystack provider reference, service request references are unique, and a student cannot have two concurrent in-progress attempts for the same CBT exam. CBT answer keys are not browser-readable.

## Environment

Copy `.env.example` to the appropriate local environment and provide:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_PAYSTACK_PUBLIC_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYSTACK_SECRET_KEY=
```

Optional integrations are documented in `.env.production.example`.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run lint
npm run build
npm start
```

Before deployment, configure the Supabase Auth redirect URLs and Paystack webhook URL for the production domain. The production server must have the server-only Supabase and Paystack secrets configured in its runtime environment.


## Admin student view

Administrators retain their administrative identity but can enter the same `/dashboard` student-facing workspace through **View Student Site**. This uses the existing student pages and authenticated user data; it does not create a duplicate student dashboard or weaken server-side admin authorization.
