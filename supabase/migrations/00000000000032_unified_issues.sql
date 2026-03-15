-- Unified issues and exceptions register (progressive convergence layer).

do $$
begin
  create type public.issue_type as enum (
    'audit_finding',
    'control_failure',
    'policy_exception',
    'vendor_issue',
    'risk_exception',
    'incident_follow_up'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.issue_severity as enum ('low', 'medium', 'high', 'critical');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.issue_status as enum ('open', 'in_progress', 'blocked', 'resolved', 'closed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  title text not null,
  description text not null,
  issue_type public.issue_type not null,
  severity public.issue_severity not null default 'medium',
  status public.issue_status not null default 'open',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  due_date date,
  root_cause text,
  management_response text,
  resolution_notes text,
  source_finding_id uuid references public.findings (id) on delete set null,
  source_risk_acceptance_id uuid references public.risk_acceptances (id) on delete set null,
  risk_id uuid references public.risks (id) on delete set null,
  control_id uuid references public.controls (id) on delete set null,
  action_plan_id uuid references public.action_plans (id) on delete set null,
  incident_id uuid references public.incidents (id) on delete set null,
  policy_id uuid references public.policies (id) on delete set null,
  third_party_id uuid references public.third_parties (id) on delete set null,
  audit_engagement_id uuid references public.audit_engagements (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint issues_title_check check (char_length(trim(title)) >= 3),
  constraint issues_description_check check (char_length(trim(description)) >= 10),
  constraint issues_resolution_notes_required_check check (
    status not in ('resolved', 'closed')
    or (resolution_notes is not null and char_length(trim(resolution_notes)) >= 3)
  )
);

create index if not exists issues_organization_id_idx on public.issues (organization_id);
create index if not exists issues_issue_type_idx on public.issues (issue_type);
create index if not exists issues_severity_idx on public.issues (severity);
create index if not exists issues_status_idx on public.issues (status);
create index if not exists issues_owner_profile_id_idx on public.issues (owner_profile_id);
create index if not exists issues_due_date_idx on public.issues (due_date);
create index if not exists issues_deleted_at_idx on public.issues (deleted_at);
create index if not exists issues_source_finding_id_idx on public.issues (source_finding_id);
create index if not exists issues_source_risk_acceptance_id_idx on public.issues (source_risk_acceptance_id);
create index if not exists issues_risk_id_idx on public.issues (risk_id);
create index if not exists issues_control_id_idx on public.issues (control_id);
create index if not exists issues_action_plan_id_idx on public.issues (action_plan_id);
create index if not exists issues_incident_id_idx on public.issues (incident_id);
create index if not exists issues_policy_id_idx on public.issues (policy_id);
create index if not exists issues_third_party_id_idx on public.issues (third_party_id);
create index if not exists issues_audit_engagement_id_idx on public.issues (audit_engagement_id);

create trigger set_issues_updated_at
before update on public.issues
for each row
execute function public.set_updated_at_timestamp();

alter table public.issues enable row level security;

drop policy if exists "issues_select_authenticated" on public.issues;
create policy "issues_select_authenticated"
  on public.issues
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "issues_insert_authenticated" on public.issues;
create policy "issues_insert_authenticated"
  on public.issues
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles profiles
        where profiles.id = issues.owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
    and (
      source_finding_id is null
      or exists (
        select 1
        from public.findings findings
        where findings.id = issues.source_finding_id
          and findings.organization_id = public.current_organization_id()
          and findings.deleted_at is null
      )
    )
    and (
      source_risk_acceptance_id is null
      or exists (
        select 1
        from public.risk_acceptances risk_acceptances
        where risk_acceptances.id = issues.source_risk_acceptance_id
          and risk_acceptances.organization_id = public.current_organization_id()
          and risk_acceptances.deleted_at is null
      )
    )
    and (
      risk_id is null
      or exists (
        select 1
        from public.risks risks
        where risks.id = issues.risk_id
          and risks.organization_id = public.current_organization_id()
          and risks.deleted_at is null
      )
    )
    and (
      control_id is null
      or exists (
        select 1
        from public.controls controls
        where controls.id = issues.control_id
          and controls.organization_id = public.current_organization_id()
          and controls.deleted_at is null
      )
    )
    and (
      action_plan_id is null
      or exists (
        select 1
        from public.action_plans action_plans
        where action_plans.id = issues.action_plan_id
          and action_plans.organization_id = public.current_organization_id()
          and action_plans.deleted_at is null
      )
    )
    and (
      incident_id is null
      or exists (
        select 1
        from public.incidents incidents
        where incidents.id = issues.incident_id
          and incidents.organization_id = public.current_organization_id()
          and incidents.deleted_at is null
      )
    )
    and (
      policy_id is null
      or exists (
        select 1
        from public.policies policies
        where policies.id = issues.policy_id
          and policies.organization_id = public.current_organization_id()
          and policies.deleted_at is null
      )
    )
    and (
      third_party_id is null
      or exists (
        select 1
        from public.third_parties third_parties
        where third_parties.id = issues.third_party_id
          and third_parties.organization_id = public.current_organization_id()
          and third_parties.deleted_at is null
      )
    )
    and (
      audit_engagement_id is null
      or exists (
        select 1
        from public.audit_engagements audit_engagements
        where audit_engagements.id = issues.audit_engagement_id
          and audit_engagements.organization_id = public.current_organization_id()
          and audit_engagements.deleted_at is null
      )
    )
  );

drop policy if exists "issues_update_authenticated" on public.issues;
create policy "issues_update_authenticated"
  on public.issues
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles profiles
        where profiles.id = issues.owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
    and (
      source_finding_id is null
      or exists (
        select 1
        from public.findings findings
        where findings.id = issues.source_finding_id
          and findings.organization_id = public.current_organization_id()
          and findings.deleted_at is null
      )
    )
    and (
      source_risk_acceptance_id is null
      or exists (
        select 1
        from public.risk_acceptances risk_acceptances
        where risk_acceptances.id = issues.source_risk_acceptance_id
          and risk_acceptances.organization_id = public.current_organization_id()
          and risk_acceptances.deleted_at is null
      )
    )
    and (
      risk_id is null
      or exists (
        select 1
        from public.risks risks
        where risks.id = issues.risk_id
          and risks.organization_id = public.current_organization_id()
          and risks.deleted_at is null
      )
    )
    and (
      control_id is null
      or exists (
        select 1
        from public.controls controls
        where controls.id = issues.control_id
          and controls.organization_id = public.current_organization_id()
          and controls.deleted_at is null
      )
    )
    and (
      action_plan_id is null
      or exists (
        select 1
        from public.action_plans action_plans
        where action_plans.id = issues.action_plan_id
          and action_plans.organization_id = public.current_organization_id()
          and action_plans.deleted_at is null
      )
    )
    and (
      incident_id is null
      or exists (
        select 1
        from public.incidents incidents
        where incidents.id = issues.incident_id
          and incidents.organization_id = public.current_organization_id()
          and incidents.deleted_at is null
      )
    )
    and (
      policy_id is null
      or exists (
        select 1
        from public.policies policies
        where policies.id = issues.policy_id
          and policies.organization_id = public.current_organization_id()
          and policies.deleted_at is null
      )
    )
    and (
      third_party_id is null
      or exists (
        select 1
        from public.third_parties third_parties
        where third_parties.id = issues.third_party_id
          and third_parties.organization_id = public.current_organization_id()
          and third_parties.deleted_at is null
      )
    )
    and (
      audit_engagement_id is null
      or exists (
        select 1
        from public.audit_engagements audit_engagements
        where audit_engagements.id = issues.audit_engagement_id
          and audit_engagements.organization_id = public.current_organization_id()
          and audit_engagements.deleted_at is null
      )
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
      'framework_requirement_assessment',
      'asset',
      'third_party',
      'third_party_review',
      'policy',
      'policy_attestation',
      'auditable_entity',
      'audit_plan',
      'audit_plan_item',
      'audit_engagement',
      'audit_workpaper',
      'issue'
    )
  );
