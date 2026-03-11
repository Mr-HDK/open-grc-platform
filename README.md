# Open GRC Platform

Internal GRC platform foundation based on Next.js App Router, TypeScript, Tailwind, and Supabase.

## Product phase

Phase 1 foundation is implemented. This repository is no longer managed as a greenfield initial build. The current objective is to extend the existing platform with higher-value operational, administrative, and collaboration features while keeping the architecture simple.

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
- Framework compliance module:
  - tables `frameworks`, `framework_requirements`, `control_framework_mappings`
  - tables `framework_requirement_assessments`, `framework_requirement_assessment_evidence`
  - seed for COBIT, ISO 27001, NIST CSF, NIS2
  - admin mapping UI for assigning multiple requirements to a control
  - requirement-level assessments (`compliant`, `partial`, `gap`, `not_applicable`)
  - mandatory justification for `partial`, `gap`, and `not_applicable`
  - optional evidence linkage per requirement assessment
  - consolidated framework coverage and gap-rate view
  - mappings displayed on control detail page
- Libraries module:
  - admin-only reusable bundle catalog
  - bundle application flow for risk/control template sets
  - idempotent import behavior (skips existing records by key fields)
  - starter bundles for SaaS baseline and ISO 27001 controls
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
- Admin Settings module:
  - admin-only settings route
  - organization-scoped profile list
  - role reassignment flow with server-side validation
  - invite, deactivate, and ownership transfer flows
- Reporting module:
  - CSV/JSON exports for risks and controls
  - CSV/JSON imports for risks and controls with validation
- Collaboration module:
  - comments on risks, controls, and action plans
  - activity visibility alongside audit history
- Notifications module:
  - overdue action reminders
  - control review reminders
- Incident Register module:
  - incident CRUD with status tracking
  - optional links to risks and action plans
- Control Reviews module:
  - scheduled review tracking for controls
  - status, target date, and completion tracking
- Control Testing & Findings module:
  - control test campaigns with period, tester, and result
  - automatic finding creation on failed tests
  - findings register with severity, remediation, owner, and due date
  - retest flow to close findings when tests pass
- Risk Acceptances module:
  - manager/admin approval records with mandatory justification
  - optional links to risk control/action scope
  - status lifecycle: active, expired, revoked
  - expiration reminders and revocation flow
- SQL migrations and seed data
- Playwright E2E smoke test + optional risk/control/action/evidence/framework/libraries/settings tests

## Current direction

The next development phase focuses on expanding product depth rather than rebuilding the foundation.

Priority areas:
- admin settings and user lifecycle management
- reusable risk/control starter libraries and bulk import flows
- exports and reporting for management and audit use
- collaboration features such as comments and notifications
- selective new modules that fit the current architecture, such as incidents or recurring control reviews

Guardrails:
- keep a monolithic Next.js + Supabase architecture
- avoid complex multi-tenant SaaS concerns unless there is a concrete need
- prefer incremental vertical slices over large rewrites
- preserve strict validation, RLS, and role-based access controls

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
    libraries/
    settings/
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
  libraries/
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
- Supabase CLI (available via `npx supabase`)

## Environment variables

Copy `.env.example` to `.env.local` and set values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DIRECT_URL=
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required for `npm run db:setup`.
- `DIRECT_URL` must point to the same Supabase project as `NEXT_PUBLIC_SUPABASE_URL`.

Optional E2E credentials:

```bash
E2E_RISK_TEST_EMAIL=
E2E_RISK_TEST_PASSWORD=
E2E_ADMIN_TEST_EMAIL=
E2E_ADMIN_TEST_PASSWORD=
E2E_CONTRIBUTOR_TEST_EMAIL=
E2E_CONTRIBUTOR_TEST_PASSWORD=
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

If you encounter `profile_missing` or `organization_missing` errors on login, re-run `npm run db:setup`
and confirm the project reference in `DIRECT_URL` matches your Supabase URL.

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

## Seeded test users

Default seeded credentials (change before production use):

- `admin@open-grc.local` / `ChangeMe123!`
- `manager@open-grc.local` / `ChangeMe123!`
- `contributor@open-grc.local` / `ChangeMe123!`
- `viewer@open-grc.local` / `ChangeMe123!`

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
  - `admin`: can manage framework mappings and user role reassignment
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
- If login redirects with `profile_missing`/`organization_missing`, re-run `npm run db:setup` and sign in again.

## Notes

- `tests/e2e/risks.create.spec.ts`, `tests/e2e/controls.create.spec.ts`, `tests/e2e/actions.create.spec.ts`, `tests/e2e/evidence.create.spec.ts`, `tests/e2e/frameworks.mapping.spec.ts`, `tests/e2e/libraries.bundles.spec.ts`, and `tests/e2e/settings.roles.spec.ts` skip automatically if required credentials are not set.
- `tests/e2e/control-tests.findings.spec.ts` validates failed control test -> finding creation -> retest closure.
- `tests/e2e/risk-acceptances.lifecycle.spec.ts` validates manager create + revoke lifecycle.
- `frameworks.mapping.spec.ts` requires admin credentials and at least one seeded control + framework requirement.
- Framework mappings page is admin-only by design.
- Libraries page is admin-only by design.
- Settings page is admin-only by design.

## Next-phase roadmap

- Expand admin lifecycle tooling (invite, deactivate, ownership transfer).
- Add audit pack exports and stronger reporting for management reviews.
- Increase E2E coverage for audit log entries, incidents, and control reviews.
- Introduce a lightweight background scheduler for reminders and overdue items.
