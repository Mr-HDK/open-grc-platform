-- Control assurance cycles, attestations, and evidence requests.

do $$
begin
  create type public.control_attestation_status as enum ('pending', 'submitted', 'reviewed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.control_evidence_request_status as enum (
    'requested',
    'submitted',
    'accepted',
    'rejected',
    'waived'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.control_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  control_id uuid not null references public.controls (id) on delete cascade,
  cycle_name text not null,
  due_date date not null,
  status public.control_attestation_status not null default 'pending',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  attested_effectiveness_status public.control_effectiveness_status,
  owner_comment text,
  attested_at timestamptz,
  reviewer_profile_id uuid references public.profiles (id) on delete set null,
  review_comment text,
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint control_attestations_cycle_name_check check (char_length(trim(cycle_name)) >= 3),
  constraint control_attestations_owner_comment_check check (
    owner_comment is null or char_length(trim(owner_comment)) <= 4000
  ),
  constraint control_attestations_review_comment_check check (
    review_comment is null or char_length(trim(review_comment)) <= 4000
  ),
  constraint control_attestations_status_consistency check (
    status = 'pending'
    or (
      status in ('submitted', 'reviewed')
      and attested_effectiveness_status is not null
      and attested_at is not null
    )
  ),
  constraint control_attestations_review_consistency check (
    status <> 'reviewed'
    or reviewed_at is not null
  )
);

create index if not exists control_attestations_org_idx
  on public.control_attestations (organization_id);
create index if not exists control_attestations_control_idx
  on public.control_attestations (control_id);
create index if not exists control_attestations_status_idx
  on public.control_attestations (status);
create index if not exists control_attestations_due_date_idx
  on public.control_attestations (due_date);
create index if not exists control_attestations_owner_profile_idx
  on public.control_attestations (owner_profile_id);
create index if not exists control_attestations_deleted_idx
  on public.control_attestations (deleted_at);

drop trigger if exists set_control_attestations_updated_at on public.control_attestations;
create trigger set_control_attestations_updated_at
before update on public.control_attestations
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.control_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  control_id uuid not null references public.controls (id) on delete cascade,
  control_attestation_id uuid references public.control_attestations (id) on delete set null,
  title text not null,
  description text,
  status public.control_evidence_request_status not null default 'requested',
  due_date date not null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  requested_by_profile_id uuid references public.profiles (id) on delete set null,
  evidence_id uuid references public.evidence (id) on delete set null,
  response_notes text,
  review_comment text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint control_evidence_requests_title_check check (char_length(trim(title)) >= 3),
  constraint control_evidence_requests_description_check check (
    description is null or char_length(trim(description)) <= 4000
  ),
  constraint control_evidence_requests_response_notes_check check (
    response_notes is null or char_length(trim(response_notes)) <= 4000
  ),
  constraint control_evidence_requests_review_comment_check check (
    review_comment is null or char_length(trim(review_comment)) <= 4000
  ),
  constraint control_evidence_requests_status_consistency check (
    status in ('requested', 'waived')
    or evidence_id is not null
  )
);

create index if not exists control_evidence_requests_org_idx
  on public.control_evidence_requests (organization_id);
create index if not exists control_evidence_requests_control_idx
  on public.control_evidence_requests (control_id);
create index if not exists control_evidence_requests_attestation_idx
  on public.control_evidence_requests (control_attestation_id);
create index if not exists control_evidence_requests_status_idx
  on public.control_evidence_requests (status);
create index if not exists control_evidence_requests_due_date_idx
  on public.control_evidence_requests (due_date);
create index if not exists control_evidence_requests_owner_profile_idx
  on public.control_evidence_requests (owner_profile_id);
create index if not exists control_evidence_requests_evidence_idx
  on public.control_evidence_requests (evidence_id);
create index if not exists control_evidence_requests_deleted_idx
  on public.control_evidence_requests (deleted_at);

drop trigger if exists set_control_evidence_requests_updated_at on public.control_evidence_requests;
create trigger set_control_evidence_requests_updated_at
before update on public.control_evidence_requests
for each row
execute function public.set_updated_at_timestamp();

alter table public.control_attestations enable row level security;
alter table public.control_evidence_requests enable row level security;

drop policy if exists "control_attestations_select_authenticated" on public.control_attestations;
create policy "control_attestations_select_authenticated"
  on public.control_attestations
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "control_attestations_insert_authenticated" on public.control_attestations;
create policy "control_attestations_insert_authenticated"
  on public.control_attestations
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.controls controls
      where controls.id = control_attestations.control_id
        and controls.organization_id = public.current_organization_id()
        and controls.deleted_at is null
    )
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = control_attestations.owner_profile_id
          and owner_profile.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "control_attestations_update_authenticated" on public.control_attestations;
create policy "control_attestations_update_authenticated"
  on public.control_attestations
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.controls controls
      where controls.id = control_attestations.control_id
        and controls.organization_id = public.current_organization_id()
        and controls.deleted_at is null
    )
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = control_attestations.owner_profile_id
          and owner_profile.organization_id = public.current_organization_id()
      )
    )
    and (
      reviewer_profile_id is null
      or exists (
        select 1
        from public.profiles reviewer_profile
        where reviewer_profile.id = control_attestations.reviewer_profile_id
          and reviewer_profile.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "control_evidence_requests_select_authenticated" on public.control_evidence_requests;
create policy "control_evidence_requests_select_authenticated"
  on public.control_evidence_requests
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "control_evidence_requests_insert_authenticated" on public.control_evidence_requests;
create policy "control_evidence_requests_insert_authenticated"
  on public.control_evidence_requests
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.controls controls
      where controls.id = control_evidence_requests.control_id
        and controls.organization_id = public.current_organization_id()
        and controls.deleted_at is null
    )
    and (
      control_attestation_id is null
      or exists (
        select 1
        from public.control_attestations attestations
        where attestations.id = control_evidence_requests.control_attestation_id
          and attestations.organization_id = public.current_organization_id()
          and attestations.control_id = control_evidence_requests.control_id
          and attestations.deleted_at is null
      )
    )
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = control_evidence_requests.owner_profile_id
          and owner_profile.organization_id = public.current_organization_id()
      )
    )
    and (
      requested_by_profile_id is null
      or exists (
        select 1
        from public.profiles requester
        where requester.id = control_evidence_requests.requested_by_profile_id
          and requester.organization_id = public.current_organization_id()
      )
    )
    and (
      evidence_id is null
      or exists (
        select 1
        from public.evidence evidence
        where evidence.id = control_evidence_requests.evidence_id
          and evidence.organization_id = public.current_organization_id()
          and evidence.archived_at is null
      )
    )
  );

drop policy if exists "control_evidence_requests_update_authenticated" on public.control_evidence_requests;
create policy "control_evidence_requests_update_authenticated"
  on public.control_evidence_requests
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.controls controls
      where controls.id = control_evidence_requests.control_id
        and controls.organization_id = public.current_organization_id()
        and controls.deleted_at is null
    )
    and (
      control_attestation_id is null
      or exists (
        select 1
        from public.control_attestations attestations
        where attestations.id = control_evidence_requests.control_attestation_id
          and attestations.organization_id = public.current_organization_id()
          and attestations.control_id = control_evidence_requests.control_id
          and attestations.deleted_at is null
      )
    )
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = control_evidence_requests.owner_profile_id
          and owner_profile.organization_id = public.current_organization_id()
      )
    )
    and (
      requested_by_profile_id is null
      or exists (
        select 1
        from public.profiles requester
        where requester.id = control_evidence_requests.requested_by_profile_id
          and requester.organization_id = public.current_organization_id()
      )
    )
    and (
      evidence_id is null
      or exists (
        select 1
        from public.evidence evidence
        where evidence.id = control_evidence_requests.evidence_id
          and evidence.organization_id = public.current_organization_id()
          and evidence.archived_at is null
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
      'auditable_entity',
      'audit_plan',
      'audit_plan_item',
      'audit_engagement',
      'audit_workpaper',
      'issue',
      'policy',
      'policy_attestation',
      'policy_approval',
      'policy_attestation_campaign',
      'policy_exception',
      'third_party_review_response',
      'third_party_document_request',
      'control_attestation',
      'control_evidence_request'
    )
  );
