-- Control testing campaigns and findings tracking.

do $$
begin
  create type public.control_test_result as enum ('passed', 'failed', 'partial');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.finding_status as enum ('open', 'in_progress', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.finding_severity as enum ('low', 'medium', 'high', 'critical');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.control_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  control_id uuid not null references public.controls (id) on delete cascade,
  test_period_start date not null,
  test_period_end date not null check (test_period_end >= test_period_start),
  tester_profile_id uuid not null references public.profiles (id),
  result public.control_test_result not null default 'passed',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists control_tests_control_id_idx on public.control_tests (control_id);
create index if not exists control_tests_result_idx on public.control_tests (result);
create index if not exists control_tests_tester_profile_id_idx on public.control_tests (tester_profile_id);
create index if not exists control_tests_period_start_idx on public.control_tests (test_period_start);
create index if not exists control_tests_deleted_at_idx on public.control_tests (deleted_at);

create trigger set_control_tests_updated_at
before update on public.control_tests
for each row
execute function public.set_updated_at_timestamp();

alter table public.control_tests enable row level security;

drop policy if exists "control_tests_select_authenticated" on public.control_tests;
create policy "control_tests_select_authenticated"
  on public.control_tests
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "control_tests_insert_authenticated" on public.control_tests;
create policy "control_tests_insert_authenticated"
  on public.control_tests
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "control_tests_update_authenticated" on public.control_tests;
create policy "control_tests_update_authenticated"
  on public.control_tests
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  control_id uuid not null references public.controls (id) on delete cascade,
  source_control_test_id uuid references public.control_tests (id) on delete set null,
  resolved_by_control_test_id uuid references public.control_tests (id) on delete set null,
  title text not null,
  description text not null,
  status public.finding_status not null default 'open',
  severity public.finding_severity not null default 'medium',
  root_cause text,
  remediation_plan text,
  due_date date,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint findings_closed_consistency check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed')
  )
);

create index if not exists findings_control_id_idx on public.findings (control_id);
create index if not exists findings_status_idx on public.findings (status);
create index if not exists findings_severity_idx on public.findings (severity);
create index if not exists findings_due_date_idx on public.findings (due_date);
create index if not exists findings_owner_profile_id_idx on public.findings (owner_profile_id);
create index if not exists findings_source_control_test_id_idx on public.findings (source_control_test_id);
create index if not exists findings_deleted_at_idx on public.findings (deleted_at);

create trigger set_findings_updated_at
before update on public.findings
for each row
execute function public.set_updated_at_timestamp();

alter table public.findings enable row level security;

drop policy if exists "findings_select_authenticated" on public.findings;
create policy "findings_select_authenticated"
  on public.findings
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "findings_insert_authenticated" on public.findings;
create policy "findings_insert_authenticated"
  on public.findings
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "findings_update_authenticated" on public.findings;
create policy "findings_update_authenticated"
  on public.findings
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

alter table public.audit_log drop constraint if exists audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (
    entity_type in (
      'risk',
      'control',
      'action_plan',
      'incident',
      'control_review',
      'control_test',
      'finding'
    )
  );
