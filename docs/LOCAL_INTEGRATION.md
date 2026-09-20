# EduReach Hub — Local Application Integration

## Current architecture

EduReach Hub uses Vite + React + Express + Supabase. It does not use Next.js or Prisma, so local setup should follow the existing stack instead of creating a second database layer.

The Supabase database already contains the service catalog and service-request workflow. The application seed migration adds:

- a seed CBT practice exam with 10 questions;
- three prototype news articles;
- an automatic `ER-YYYY-XXXXXX` reference code for every new service request.

## Local environment

Create `.env.local` from `.env.example` and provide:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PAYSTACK_SECRET_KEY=...
PAYSTACK_PUBLIC_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` are server-only secrets. Never prefix them with `VITE_` and never expose them in browser code.

## Run the prototype

```bash
npm install
npm run dev
```

The existing `server.ts` starts the Vite development server and also exposes the payment API scaffolding under `/api/payments/*`.

## Supabase local database workflow

For a local Supabase CLI database, apply the repository migrations with the normal Supabase workflow. The migration that seeds application-integration data is:

```text
supabase/migrations/20260915_application_integration_seed.sql
```

After a local reset, the database should contain the five service definitions, the seed CBT practice exam/question bank, and the three prototype news records.

## Payment API

The prototype now contains:

```text
POST /api/payments/initialize
POST /api/payments/verify
```

The backend keeps the Paystack secret key server-side, initializes transactions through Paystack, and verifies the returned transaction reference before moving a service request to `processing`. Paystack recommends server-side initialization and server-side verification, including checking both transaction status and amount before delivering value.

The frontend payment button is intentionally not hard-coded to a service price yet. Service prices must be decided and stored server-side before production use. For local integration work, the payment endpoints accept a test amount supplied by the prototype client.

## Manual end-to-end checks

1. Open `/` and confirm the dashboard-style EduReach homepage loads.
2. Open `/cbt`, choose an exam and launch a session.
3. Confirm the 30-minute timer starts and the question palette changes when answers are selected.
4. Submit the CBT and confirm the local result screen appears.
5. Sign in, open `/services`, choose a service, complete its form and submit.
6. Confirm the request appears in `/services/track` and `/dashboard`.
7. Confirm the saved service request contains an `ER-YYYY-XXXXXX` reference code in `reference_code` and `form_data.reference_code`.
8. For Paystack testing, configure server-only Paystack credentials and exercise the initialize/verify API before wiring a production service fee into the UI.
