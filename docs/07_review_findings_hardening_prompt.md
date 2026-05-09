# Prompt - Review Findings Hardening

Use this prompt to address the review findings from the whole-app review.

## Objective

Fix the three review findings without changing the overall architecture or adding unrelated features.

The goal is to harden account lifecycle authorization, make list-page search input robust, and bring the public landing page in line with the current product.

## Context

The application is an internal GRC platform built with:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage
- SQL migrations with RLS
- Zod validation
- Playwright E2E tests

Keep the existing monolithic Next.js + Supabase architecture.

## Finding 1 - Deactivated profiles still authorize

Priority: P1

Files likely involved:

- `lib/auth/profile.ts`
- `supabase/migrations/*`
- possibly `app/dashboard/settings/actions.ts`
- tests under `tests/e2e/`

Problem:

`requireSessionProfile` checks role rank but does not block profiles whose `status` is `deactivated`. `normalizeProfile` drops the profile status. The SQL helper `public.current_user_role()` also returns the stored role regardless of profile status, so RLS can still treat a deactivated user as authorized if their session remains valid.

Expected fix:

- Include profile `status` in the session profile model or explicitly evaluate it before returning an authorized profile.
- Block `deactivated` users from dashboard routes and server actions.
- Keep `invited` behavior intentional: if an invited user signs in successfully, the app may activate them as it does today, but this should not accidentally activate deactivated users.
- Add a SQL migration updating role helper behavior so non-active profiles do not pass elevated RLS checks.
- Prefer treating missing, invited, or deactivated status as least privilege in SQL helpers unless there is a clear reason otherwise.
- Ensure deactivation remains compatible with Supabase Auth admin ban behavior.

Acceptance criteria:

- A deactivated profile cannot access protected pages.
- A deactivated profile cannot execute server actions.
- RLS helper functions do not return elevated roles for deactivated profiles.
- Existing active users keep normal access.
- Settings admin lifecycle still works.

Test expectations:

- Add or update E2E coverage for deactivation/access behavior if feasible.
- Add focused unit or integration coverage if that is simpler than a full auth-state E2E.

## Finding 2 - Search text can break PostgREST filters

Priority: P2

Files likely involved:

- `app/dashboard/controls/page.tsx`
- `app/dashboard/assets/page.tsx`
- `app/dashboard/auditable-entities/page.tsx`
- `app/dashboard/evidence/page.tsx`
- `app/dashboard/policies/page.tsx`
- `app/dashboard/third-parties/page.tsx`
- possibly a new helper under `lib/`

Problem:

Several pages interpolate raw `q` values into Supabase/PostgREST `.or(...)` filter strings. Values containing grammar characters such as commas or parentheses can produce query errors or malformed filters.

Expected fix:

- Centralize a safe helper for escaping or sanitizing search values used in `.or(...)`.
- Apply the helper to every page that interpolates user input into `.or(...)`.
- Keep current search behavior for normal words.
- Do not rewrite all list pages or introduce a search service.

Acceptance criteria:

- Searches with commas, parentheses, quotes, percent signs, and normal text do not crash the page.
- Existing search behavior still works for title/code/name/service/file searches.
- The helper is small and documented only if the escaping rules are not obvious.

Test expectations:

- Add at least one test that loads a list page with a problematic `q` value.
- If practical, test two pages that use `.or(...)`, such as controls and third parties.

## Finding 3 - Public landing page is stale

Priority: P3

Files likely involved:

- `app/page.tsx`
- possibly `app/layout.tsx` metadata

Problem:

The public landing page still says the app is an MVP bootstrap with initial scaffold/protected dashboard routes, while the repository now contains a broad operational GRC platform.

Expected fix:

- Update the landing page copy to describe the current internal GRC platform.
- Mention the real modules at a high level without turning the page into a marketing site.
- Keep the page simple and operational: primary actions should remain dashboard and login.
- Update metadata description if it is stale.

Acceptance criteria:

- Landing page no longer says "MVP bootstrap" or "initial scaffold".
- Copy matches the README's current implementation status.
- Existing smoke test still passes or is updated to the new heading.

## Constraints

- Do not change the app architecture.
- Do not introduce new external services.
- Do not rebuild auth.
- Do not add broad redesign work.
- Keep changes scoped to the findings.
- Preserve existing user changes and generated files.
- Add migrations only where database/RLS behavior changes.
- Keep TypeScript strict and validation patterns consistent with the repo.

## Suggested implementation order

1. Fix app-level profile status handling.
2. Add SQL migration for RLS helper status handling.
3. Add or update tests for deactivated-user authorization.
4. Add safe PostgREST search helper and apply it to all `.or(...)` search pages.
5. Add search regression coverage.
6. Update landing page and metadata copy.
7. Run verification commands.

## Verification commands

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

If the full E2E suite is too slow during iteration, run targeted tests first, then the full suite before final delivery.

## Final response format

Return:

1. Summary of fixes.
2. Files changed.
3. Migration created or changed.
4. Tests run and results.
5. Any remaining risks or follow-up work.
6. Suggested commit message.
