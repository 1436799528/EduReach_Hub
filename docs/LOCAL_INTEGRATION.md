# EduReach Hub — Local Application Integration

## Current architecture

EduReach Hub uses Vite + React + Express + Supabase. It does not use Next.js or Prisma, so local setup should follow the existing stack instead of creating a second database layer.

The Supabase database contains the service catalog and service-request workflow. The application seed migration adds:

- a seed CBT practice exam with 10 questions;
- three prototype news articles;
- an automatic `ER-YYYY-XXXXXX` reference code for every new service request.

The active service catalogue covers NELFUND guidance, WAEC/NECO result checking, JAMB slip support and admission-letter guidance. Legacy scratch-card inventory is retired and is not part of the browser or admin workflow.

## Local environment

Create `.env.local` from `.env.example` and provide:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `VITE_` or expose it in browser code.

## Run the prototype

```bash
npm install
npm run dev
```

The existing `server.ts` starts the Vite development server and exposes protected administration and application-support endpoints.

## Supabase local database workflow

For a local Supabase CLI database, apply the repository migrations with the normal Supabase workflow. The migration that seeds application-integration data is:

```text
supabase/migrations/20260915_application_integration_seed.sql
```

After a local reset, the database should contain the active service definitions, the seed CBT practice exam/question bank and the prototype news records. Apply the later retirement migration to deactivate legacy service-catalog rows.

## Manual end-to-end checks

1. Open `/` and confirm the student-facing EduReach homepage loads.
2. Open `/cbt`, choose an exam and complete its setup page.
3. Confirm the timer starts and the question palette changes when answers are selected.
4. Submit the CBT and confirm the result screen appears.
5. Sign in, open `/services`, choose a supported service, complete its form and submit.
6. Confirm the request appears in the authenticated dashboard under My Requests.
7. Confirm the saved service request contains an `ER-YYYY-XXXXXX` reference code in `reference_code` and `form_data.reference_code`.
