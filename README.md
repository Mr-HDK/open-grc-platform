# Open GRC Platform

Bootstrap of an internal GRC MVP stack based on Next.js App Router, TypeScript, Tailwind, and Supabase.

## What is included

- Next.js 15 App Router project scaffold
- TypeScript strict mode
- Tailwind CSS setup
- Basic UI primitives (`Button`, `Input`, `Card`)
- Supabase browser/server clients and middleware session refresh
- Protected dashboard layout (`/dashboard` redirects to `/login` if no session)
- Initial login page using Supabase email/password auth
- Placeholder SQL migration and seed files
- E2E smoke test scaffold with Playwright
- ESLint + Prettier configuration

## Project structure

```text
app/
  (auth)/login/
  dashboard/
components/
  layout/
  ui/
lib/
  auth/
  permissions/
  supabase/
  utils/
supabase/
  migrations/
  seed/
tests/
  e2e/
```

## Prerequisites

- Node.js 20+
- A Supabase project

## Environment variables

Copy `.env.example` to `.env.local` and set values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:e2e
```

## Current limitations

- Business modules are placeholders only (risks, controls, actions, evidence, frameworks)
- No database schema yet beyond placeholder migration
- No role persistence yet (role helper exists, profiles table not added)

## Next implementation step

- Implement auth + role bootstrap in database (`profiles`) and enforce permissions in dashboard routes.
