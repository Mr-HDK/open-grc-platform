-- Internal audit planning and execution core.

do $$
begin
  create type public.audit_plan_cycle as enum ('annual', 'semiannual');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.audit_plan_status as enum ('draft', 'approved', 'in_progress', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.audit_plan_item_status as enum ('planned', 'in_progress', 'completed', 'deferred');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.audit_engagement_status as enum ('planned', 'fieldwork', 'reporting', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.audit_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  title text not null,
  plan_year integer not null check (plan_year between 2000 and 2100),
  cycle public.audit_plan_cycle not null default 'annual',
  status public.audit_plan_status not null default 'draft',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  summary text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint audit_plans_title_check check (char_length(trim(title)) >= 2)
);

create table if not exists public.audit_plan_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  audit_plan_id uuid not null references public.audit_plans (id) on delete cascade,
  topic text not null,
  auditable_entity_id uuid references public.auditable_entities (id) on delete set null,
  risk_id uuid references public.risks (id) on delete set null,
  status public.audit_plan_item_status not null default 'planned',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint audit_plan_items_topic_check check (char_length(trim(topic)) >= 2)
);

create table if not exists public.audit_engagements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  audit_plan_item_id uuid not null references public.audit_plan_items (id) on delete cascade,
  title text not null,
  scope text not null,
  objectives text not null,
  lead_auditor_profile_id uuid references public.profiles (id) on delete set null,
  status public.audit_engagement_status not null default 'planned',
  planned_start_date date not null,
  planned_end_date date not null check (planned_end_date >= planned_start_date),
  actual_start_date date,
  actual_end_date date,
  summary text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint audit_engagements_title_check check (char_length(trim(title)) >= 2),
  constraint audit_engagements_actual_dates_check check (
    actual_end_date is null
    or (
      actual_start_date is not null
      and actual_end_date >= actual_start_date
    )
  )
);

create table if not exists public.audit_workpapers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  audit_engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  title text not null,
  procedure text not null,
  conclusion text not null,
  reviewer_profile_id uuid references public.profiles (id) on delete set null,
  evidence_id uuid references public.evidence (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint audit_workpapers_title_check check (char_length(trim(title)) >= 2)
);

create table if not exists public.audit_engagement_findings (
  audit_engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (audit_engagement_id, finding_id)
);

create table if not exists public.audit_engagement_action_plans (
  audit_engagement_id uuid not null references public.audit_engagements (id) on delete cascade,
  action_plan_id uuid not null references public.action_plans (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (audit_engagement_id, action_plan_id)
);

create index if not exists audit_plans_organization_id_idx on public.audit_plans (organization_id);
create index if not exists audit_plans_plan_year_idx on public.audit_plans (plan_year);
create index if not exists audit_plans_cycle_idx on public.audit_plans (cycle);
create index if not exists audit_plans_status_idx on public.audit_plans (status);
create index if not exists audit_plans_owner_profile_id_idx on public.audit_plans (owner_profile_id);
create index if not exists audit_plans_deleted_at_idx on public.audit_plans (deleted_at);

create index if not exists audit_plan_items_organization_id_idx on public.audit_plan_items (organization_id);
create index if not exists audit_plan_items_audit_plan_id_idx on public.audit_plan_items (audit_plan_id);
create index if not exists audit_plan_items_auditable_entity_id_idx on public.audit_plan_items (auditable_entity_id);
create index if not exists audit_plan_items_risk_id_idx on public.audit_plan_items (risk_id);
create index if not exists audit_plan_items_status_idx on public.audit_plan_items (status);
create index if not exists audit_plan_items_deleted_at_idx on public.audit_plan_items (deleted_at);

create index if not exists audit_engagements_organization_id_idx on public.audit_engagements (organization_id);
create index if not exists audit_engagements_audit_plan_item_id_idx on public.audit_engagements (audit_plan_item_id);
create index if not exists audit_engagements_lead_auditor_profile_id_idx on public.audit_engagements (lead_auditor_profile_id);
create index if not exists audit_engagements_status_idx on public.audit_engagements (status);
create index if not exists audit_engagements_planned_start_date_idx on public.audit_engagements (planned_start_date);
create index if not exists audit_engagements_deleted_at_idx on public.audit_engagements (deleted_at);

create index if not exists audit_workpapers_organization_id_idx on public.audit_workpapers (organization_id);
create index if not exists audit_workpapers_audit_engagement_id_idx on public.audit_workpapers (audit_engagement_id);
create index if not exists audit_workpapers_reviewer_profile_id_idx on public.audit_workpapers (reviewer_profile_id);
create index if not exists audit_workpapers_evidence_id_idx on public.audit_workpapers (evidence_id);
create index if not exists audit_workpapers_deleted_at_idx on public.audit_workpapers (deleted_at);

create index if not exists audit_engagement_findings_finding_id_idx on public.audit_engagement_findings (finding_id);
create index if not exists audit_engagement_action_plans_action_plan_id_idx on public.audit_engagement_action_plans (action_plan_id);

create trigger set_audit_plans_updated_at
before update on public.audit_plans
for each row
execute function public.set_updated_at_timestamp();

create trigger set_audit_plan_items_updated_at
before update on public.audit_plan_items
for each row
execute function public.set_updated_at_timestamp();

create trigger set_audit_engagements_updated_at
before update on public.audit_engagements
for each row
execute function public.set_updated_at_timestamp();

create trigger set_audit_workpapers_updated_at
before update on public.audit_workpapers
for each row
execute function public.set_updated_at_timestamp();

alter table public.audit_plans enable row level security;
alter table public.audit_plan_items enable row level security;
alter table public.audit_engagements enable row level security;
alter table public.audit_workpapers enable row level security;
alter table public.audit_engagement_findings enable row level security;
alter table public.audit_engagement_action_plans enable row level security;

drop policy if exists "audit_plans_select_authenticated" on public.audit_plans;
create policy "audit_plans_select_authenticated"
  on public.audit_plans
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "audit_plans_insert_authenticated" on public.audit_plans;
create policy "audit_plans_insert_authenticated"
  on public.audit_plans
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "audit_plans_update_authenticated" on public.audit_plans;
create policy "audit_plans_update_authenticated"
  on public.audit_plans
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "audit_plan_items_select_authenticated" on public.audit_plan_items;
create policy "audit_plan_items_select_authenticated"
  on public.audit_plan_items
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "audit_plan_items_insert_authenticated" on public.audit_plan_items;
create policy "audit_plan_items_insert_authenticated"
  on public.audit_plan_items
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_plans audit_plans
      where audit_plans.id = audit_plan_items.audit_plan_id
        and audit_plans.organization_id = public.current_organization_id()
        and audit_plans.deleted_at is null
    )
  );

drop policy if exists "audit_plan_items_update_authenticated" on public.audit_plan_items;
create policy "audit_plan_items_update_authenticated"
  on public.audit_plan_items
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_plans audit_plans
      where audit_plans.id = audit_plan_items.audit_plan_id
        and audit_plans.organization_id = public.current_organization_id()
        and audit_plans.deleted_at is null
    )
  );

drop policy if exists "audit_engagements_select_authenticated" on public.audit_engagements;
create policy "audit_engagements_select_authenticated"
  on public.audit_engagements
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "audit_engagements_insert_authenticated" on public.audit_engagements;
create policy "audit_engagements_insert_authenticated"
  on public.audit_engagements
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_plan_items audit_plan_items
      where audit_plan_items.id = audit_engagements.audit_plan_item_id
        and audit_plan_items.organization_id = public.current_organization_id()
        and audit_plan_items.deleted_at is null
    )
  );

drop policy if exists "audit_engagements_update_authenticated" on public.audit_engagements;
create policy "audit_engagements_update_authenticated"
  on public.audit_engagements
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_plan_items audit_plan_items
      where audit_plan_items.id = audit_engagements.audit_plan_item_id
        and audit_plan_items.organization_id = public.current_organization_id()
        and audit_plan_items.deleted_at is null
    )
  );

drop policy if exists "audit_workpapers_select_authenticated" on public.audit_workpapers;
create policy "audit_workpapers_select_authenticated"
  on public.audit_workpapers
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "audit_workpapers_insert_authenticated" on public.audit_workpapers;
create policy "audit_workpapers_insert_authenticated"
  on public.audit_workpapers
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.audit_engagements audit_engagements
      where audit_engagements.id = audit_workpapers.audit_engagement_id
        and audit_engagements.organization_id = public.current_organization_id()
        and audit_engagements.deleted_at is null
    )
  );

drop policy if exists "audit_workpapers_update_authenticated" on public.audit_workpapers;
create policy "audit_workpapers_update_authenticated"
  on public.audit_workpapers
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
      from public.audit_engagements audit_engagements
      where audit_engagements.id = audit_workpapers.audit_engagement_id
        and audit_engagements.organization_id = public.current_organization_id()
        and audit_engagements.deleted_at is null
    )
  );

drop policy if exists "audit_engagement_findings_select_authenticated" on public.audit_engagement_findings;
create policy "audit_engagement_findings_select_authenticated"
  on public.audit_engagement_findings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_engagements audit_engagements
      join public.findings findings on findings.id = audit_engagement_findings.finding_id
      where audit_engagements.id = audit_engagement_findings.audit_engagement_id
        and audit_engagements.deleted_at is null
        and findings.deleted_at is null
        and audit_engagements.organization_id = public.current_organization_id()
        and findings.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "audit_engagement_findings_insert_authenticated" on public.audit_engagement_findings;
create policy "audit_engagement_findings_insert_authenticated"
  on public.audit_engagement_findings
  for insert
  to authenticated
  with check (
    public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_engagements audit_engagements
      join public.findings findings on findings.id = audit_engagement_findings.finding_id
      where audit_engagements.id = audit_engagement_findings.audit_engagement_id
        and audit_engagements.deleted_at is null
        and findings.deleted_at is null
        and audit_engagements.organization_id = public.current_organization_id()
        and findings.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "audit_engagement_findings_delete_authenticated" on public.audit_engagement_findings;
create policy "audit_engagement_findings_delete_authenticated"
  on public.audit_engagement_findings
  for delete
  to authenticated
  using (
    public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_engagements audit_engagements
      join public.findings findings on findings.id = audit_engagement_findings.finding_id
      where audit_engagements.id = audit_engagement_findings.audit_engagement_id
        and audit_engagements.organization_id = public.current_organization_id()
        and findings.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "audit_engagement_action_plans_select_authenticated" on public.audit_engagement_action_plans;
create policy "audit_engagement_action_plans_select_authenticated"
  on public.audit_engagement_action_plans
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_engagements audit_engagements
      join public.action_plans action_plans on action_plans.id = audit_engagement_action_plans.action_plan_id
      where audit_engagements.id = audit_engagement_action_plans.audit_engagement_id
        and audit_engagements.deleted_at is null
        and action_plans.deleted_at is null
        and audit_engagements.organization_id = public.current_organization_id()
        and action_plans.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "audit_engagement_action_plans_insert_authenticated" on public.audit_engagement_action_plans;
create policy "audit_engagement_action_plans_insert_authenticated"
  on public.audit_engagement_action_plans
  for insert
  to authenticated
  with check (
    public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_engagements audit_engagements
      join public.action_plans action_plans on action_plans.id = audit_engagement_action_plans.action_plan_id
      where audit_engagements.id = audit_engagement_action_plans.audit_engagement_id
        and audit_engagements.deleted_at is null
        and action_plans.deleted_at is null
        and audit_engagements.organization_id = public.current_organization_id()
        and action_plans.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "audit_engagement_action_plans_delete_authenticated" on public.audit_engagement_action_plans;
create policy "audit_engagement_action_plans_delete_authenticated"
  on public.audit_engagement_action_plans
  for delete
  to authenticated
  using (
    public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.audit_engagements audit_engagements
      join public.action_plans action_plans on action_plans.id = audit_engagement_action_plans.action_plan_id
      where audit_engagements.id = audit_engagement_action_plans.audit_engagement_id
        and audit_engagements.organization_id = public.current_organization_id()
        and action_plans.organization_id = public.current_organization_id()
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
      'audit_workpaper'
    )
  );
