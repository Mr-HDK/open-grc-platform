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
- Action Plans module:
  - `action_plans` migration
  - list + search + filters (status, priority, overdue)
  - create + edit + detail
  - linked risk and/or control
  - status + priority + target date + overdue indicator
  - soft archive (manager+)
- Evidence module:
  - `evidence` migration
  - Supabase Storage upload to `evidence` bucket
  - metadata + links to risk/control/action
  - evidence registry list + filters
  - simple archive flow
  - evidence sections on risk/control/action detail pages
- Framework Mappings module:
  - tables `frameworks`, `framework_requirements`, `control_framework_mappings`
  - seed for COBIT, ISO 27001, NIST CSF, NIS2
  - admin mapping UI for assigning multiple requirements to a control
  - mappings displayed on control detail page
- Dashboard module:
  - KPI cards
  - risks by status and level
  - impact x likelihood heatmap
  - overdue actions list
  - controls due for review within 30 days
- SQL migrations and seed data
- Playwright E2E smoke test + optional risk/control/action/evidence/framework tests

## Project structure

```text
app/
  (auth)/login/
  dashboard/
    risks/
    controls/
    actions/
    evidence/
    frameworks/
components/
  layout/
  risks/
  controls/
  actions/
  evidence/
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

Optional E2E credentials:

```bash
E2E_RISK_TEST_EMAIL=
E2E_RISK_TEST_PASSWORD=
E2E_ADMIN_TEST_EMAIL=
E2E_ADMIN_TEST_PASSWORD=
```

## Database setup

Apply migrations in order:

1. `supabase/migrations/00000000000001_auth_profiles.sql`
2. `supabase/migrations/00000000000002_risks.sql`
3. `supabase/migrations/00000000000003_controls.sql`
4. `supabase/migrations/00000000000004_action_plans.sql`
5. `supabase/migrations/00000000000005_evidence.sql`
6. `supabase/migrations/00000000000006_framework_mappings.sql`

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

- `tests/e2e/risks.create.spec.ts`, `tests/e2e/controls.create.spec.ts`, `tests/e2e/actions.create.spec.ts`, `tests/e2e/evidence.create.spec.ts`, and `tests/e2e/frameworks.mapping.spec.ts` skip automatically if required credentials are not set.
- `frameworks.mapping.spec.ts` requires admin credentials and at least one seeded control + framework requirement.
- Framework mappings page is admin-only by design.
