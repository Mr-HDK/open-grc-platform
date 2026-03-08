# Open GRC Platform

Internal GRC MVP scaffold based on Next.js App Router, TypeScript, Tailwind, and Supabase.

## Current implementation status

- Auth/login/logout with Supabase Auth
- Role model with 4 roles: `admin`, `manager`, `contributor`, `viewer`
- Profile bootstrap (`profiles` table + `auth.users` trigger)
- Protected dashboard routes and role-aware navigation
- Risk Register module:
  - list + search + filters (status, level, owner, category)
  - create + edit + detail
  - soft archive (manager+)
  - score calculation (`impact * likelihood`)
  - derived risk level (`low/medium/high/critical`)
  - explicit owner assignment
  - risk detail links to related controls and action plans
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
  - signed download links with short-lived URL expiration
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
- Audit Log module:
  - `audit_log` table
  - create/update/soft-delete tracking for risks, controls, and action plans
  - audit history displayed on risk/control/action detail pages
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
  audit/
  layout/
  risks/
  controls/
  actions/
  evidence/
  ui/
lib/
  audit/
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
DIRECT_URL=
```

Optional E2E credentials:

```bash
E2E_RISK_TEST_EMAIL=
E2E_RISK_TEST_PASSWORD=
E2E_ADMIN_TEST_EMAIL=
E2E_ADMIN_TEST_PASSWORD=
```

## Database setup

Use the automated setup flow:

```bash
npm run db:setup
```

This command:

- applies all migrations in `supabase/migrations`
- ensures test users exist in Supabase Auth
- assigns expected roles in `profiles`
- seeds baseline data from `supabase/seed/seed.sql`
- backfills seed-dependent action/evidence rows when needed

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Installation checklist

1. Install dependencies with `npm install`.
2. Configure `.env.local` with Supabase keys.
3. Run `npm run db:setup`.
4. Start local server with `npm run dev`.
5. Login with a seeded account and verify access by role.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:e2e
npm run test:e2e:parallel
npm run test:e2e:ci
```

## CI workflow

GitHub Actions workflow:

- `.github/workflows/e2e.yml`

Required repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DIRECT_URL`

The workflow runs:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:e2e:ci` (`db:setup` + serial E2E)

## Operations notes

- Critical permissions:
  - `viewer`: read-only access to dashboard modules
  - `contributor`: can create and edit records
  - `manager`: can archive records
  - `admin`: can manage framework mappings
- Server-side validation now enforces:
  - strict UUID/date format checks on linked fields
  - linked-record existence checks before write operations
  - normalized user-facing error messages for common database errors
- Database RLS now enforces minimum app roles for write operations:
  - `contributor+` for risks/controls/actions/evidence creation and updates
  - `manager+` for evidence archive updates
  - `admin` for framework mapping writes
- Organization scoping is enforced in database defaults and RLS policies for transactional entities.
- Audit log events are best-effort and do not block core create/update/archive operations.
- Default E2E run is serial (`npm run test:e2e`) for deterministic CI/dev baselines.
- `npm run test:e2e:parallel` is available for faster local stress runs.

## Notes

- `tests/e2e/risks.create.spec.ts`, `tests/e2e/controls.create.spec.ts`, `tests/e2e/actions.create.spec.ts`, `tests/e2e/evidence.create.spec.ts`, and `tests/e2e/frameworks.mapping.spec.ts` skip automatically if required credentials are not set.
- `frameworks.mapping.spec.ts` requires admin credentials and at least one seeded control + framework requirement.
- Framework mappings page is admin-only by design.

## Post-MVP TODO

- Add dedicated E2E coverage for audit log history entries.
- Add optimistic UI feedback for form submissions (pending/success state).
- Add an admin settings page for role reassignment and user lifecycle.
