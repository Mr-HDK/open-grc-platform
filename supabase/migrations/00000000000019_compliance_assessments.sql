-- Requirement-level compliance assessments.

do $$
begin
  create type public.framework_requirement_assessment_status as enum ('compliant', 'partial', 'gap', 'not_applicable');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.framework_requirement_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  framework_requirement_id uuid not null references public.framework_requirements (id) on delete cascade,
  status public.framework_requirement_assessment_status not null,
  justification text,
  assessed_at timestamptz not null default timezone('utc', now()),
  assessed_by_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, framework_requirement_id),
  constraint framework_requirement_assessments_justification_check check (
    (
      status in ('partial', 'gap', 'not_applicable')
      and char_length(trim(coalesce(justification, ''))) >= 12
    )
    or status = 'compliant'
  )
);

create table if not exists public.framework_requirement_assessment_evidence (
  assessment_id uuid not null references public.framework_requirement_assessments (id) on delete cascade,
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (assessment_id, evidence_id)
);

create index if not exists framework_requirement_assessments_org_idx
  on public.framework_requirement_assessments (organization_id);
create index if not exists framework_requirement_assessments_requirement_idx
  on public.framework_requirement_assessments (framework_requirement_id);
create index if not exists framework_requirement_assessments_status_idx
  on public.framework_requirement_assessments (status);
create index if not exists framework_requirement_assessment_evidence_evidence_idx
  on public.framework_requirement_assessment_evidence (evidence_id);

create trigger set_framework_requirement_assessments_updated_at
before update on public.framework_requirement_assessments
for each row
execute function public.set_updated_at_timestamp();

alter table public.framework_requirement_assessments enable row level security;
alter table public.framework_requirement_assessment_evidence enable row level security;

drop policy if exists "framework_requirement_assessments_select_authenticated"
  on public.framework_requirement_assessments;
create policy "framework_requirement_assessments_select_authenticated"
  on public.framework_requirement_assessments
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists "framework_requirement_assessments_insert_authenticated"
  on public.framework_requirement_assessments;
create policy "framework_requirement_assessments_insert_authenticated"
  on public.framework_requirement_assessments
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "framework_requirement_assessments_update_authenticated"
  on public.framework_requirement_assessments;
create policy "framework_requirement_assessments_update_authenticated"
  on public.framework_requirement_assessments
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

drop policy if exists "framework_requirement_assessment_evidence_select_authenticated"
  on public.framework_requirement_assessment_evidence;
create policy "framework_requirement_assessment_evidence_select_authenticated"
  on public.framework_requirement_assessment_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.framework_requirement_assessments assessments
      where assessments.id = framework_requirement_assessment_evidence.assessment_id
        and assessments.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "framework_requirement_assessment_evidence_insert_authenticated"
  on public.framework_requirement_assessment_evidence;
create policy "framework_requirement_assessment_evidence_insert_authenticated"
  on public.framework_requirement_assessment_evidence
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.framework_requirement_assessments assessments
      where assessments.id = framework_requirement_assessment_evidence.assessment_id
        and assessments.organization_id = public.current_organization_id()
    )
    and exists (
      select 1
      from public.evidence
      where evidence.id = framework_requirement_assessment_evidence.evidence_id
        and evidence.organization_id = public.current_organization_id()
        and evidence.archived_at is null
    )
  );

drop policy if exists "framework_requirement_assessment_evidence_delete_authenticated"
  on public.framework_requirement_assessment_evidence;
create policy "framework_requirement_assessment_evidence_delete_authenticated"
  on public.framework_requirement_assessment_evidence
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.framework_requirement_assessments assessments
      where assessments.id = framework_requirement_assessment_evidence.assessment_id
        and assessments.organization_id = public.current_organization_id()
    )
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
      'finding',
      'risk_acceptance',
      'framework_requirement_assessment'
    )
  );
