# Open GRC Platform

Internal GRC MVP scaffold based on Next.js App Router, TypeScript, Tailwind, and Supabase.

## Current implementation status

- Auth/login/logout with Supabase Auth
- Role model with 4 roles: `admin`, `manager`, `contributor`, `viewer`
- Profile bootstrap (`profiles` table + `auth.users` trigger)
- Protected dashboard routes and role-aware navigation
- Risk Register module:
  - list + search + filters
  - create + edit + detail
  - soft archive (manager+)
  - score calculation (`impact * likelihood`)
  - derived risk level (`low/medium/high/critical`)
- Controls module:
  - controls migration + pivot table `risk_controls`
  - list + search + filters
  - create + edit + detail
  - soft archive (manager+)
  - control-to-many-risks linking
  - effectiveness status, owner, and review frequency
  - detail view with linked risks
- SQL migrations and seed data
- Playwright E2E smoke test + optional risk/control creation E2E tests

## Project structure

```text
app/
  (auth)/login/
  dashboard/
    risks/
    controls/
components/
  layout/
  risks/
  controls/
  ui/
lib/
  auth/
  permissions/
  scoring/
  supabase/
  validators/
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

Optional E2E credentials for risk/control creation tests:

```bash
E2E_RISK_TEST_EMAIL=
E2E_RISK_TEST_PASSWORD=
```

## Database setup

Apply migrations in order:

1. `supabase/migrations/00000000000001_auth_profiles.sql`
2. `supabase/migrations/00000000000002_risks.sql`
3. `supabase/migrations/00000000000003_controls.sql`

Run seed:

- `supabase/seed/seed.sql`

Role seed mapping by email:

- `admin@open-grc.local` -> `admin`
- `manager@open-grc.local` -> `manager`
- `contributor@open-grc.local` -> `contributor`
- any other user -> `viewer`

Create those users in Supabase Auth first, then run seed.

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

## Notes

- `tests/e2e/risks.create.spec.ts` and `tests/e2e/controls.create.spec.ts` are skipped automatically if test credentials are not set.
- `tests/e2e/controls.create.spec.ts` also skips when no risks exist to link.
- Framework mappings and settings pages are currently admin-only.
