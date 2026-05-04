-- Risk Control Self-Assessment (RCSA) core.

do $$
begin
  create type public.rcsa_campaign_status as enum (
    'draft',
    'in_progress',
    'submitted',
    'reviewed',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rcsa_result as enum ('satisfactory', 'needs_attention', 'critical');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rcsa_question_category as enum (
    'design_adequacy',
    'operating_effectiveness',
    'recent_incidents',
    'evidence_available',
    'actions_needed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rcsa_response_value as enum ('strong', 'adequate', 'weak', 'critical');
exception
  when duplicate_object then null;
end $$;

alter table public.audit_log
  drop constraint if exists audit_log_entity_type_check;

alter table public.audit_log
  add constraint audit_log_entity_type_check check (
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
      'control_evidence_request',
      'rcsa_campaign',
      'rcsa_response'
    )
  );

create table if not exists public.rcsa_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  question_key text not null,
  category public.rcsa_question_category not null,
  prompt text not null,
  weight integer not null check (weight between 1 and 100),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint rcsa_questions_prompt_check check (char_length(trim(prompt)) >= 10),
  constraint rcsa_questions_unique_active_key unique (organization_id, question_key)
);

create table if not exists public.rcsa_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  title text not null,
  description text,
  status public.rcsa_campaign_status not null default 'draft',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  auditable_entity_id uuid references public.auditable_entities (id) on delete set null,
  risk_id uuid references public.risks (id) on delete set null,
  control_id uuid references public.controls (id) on delete set null,
  period_start_date date,
  period_end_date date,
  due_date date,
  score integer check (score between 0 and 100),
  result public.rcsa_result,
  manager_review_notes text,
  reviewed_by_profile_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint rcsa_campaigns_title_check check (char_length(trim(title)) >= 3),
  constraint rcsa_campaigns_period_check check (
    period_start_date is null
    or period_end_date is null
    or period_end_date >= period_start_date
  ),
  constraint rcsa_campaigns_scope_check check (
    owner_profile_id is not null
    or auditable_entity_id is not null
    or risk_id is not null
    or control_id is not null
  )
);

create table if not exists public.rcsa_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  campaign_id uuid not null references public.rcsa_campaigns (id) on delete cascade,
  question_id uuid not null references public.rcsa_questions (id) on delete restrict,
  response_value public.rcsa_response_value not null,
  response_score integer not null check (response_score between 0 and 100),
  notes text,
  evidence_available boolean not null default false,
  action_required boolean not null default false,
  suggested_action text,
  issue_id uuid references public.issues (id) on delete set null,
  action_plan_id uuid references public.action_plans (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint rcsa_responses_unique_question unique (campaign_id, question_id)
);

create index if not exists rcsa_questions_org_idx on public.rcsa_questions (organization_id);
create index if not exists rcsa_questions_active_idx on public.rcsa_questions (is_active, deleted_at);

create index if not exists rcsa_campaigns_org_idx on public.rcsa_campaigns (organization_id);
create index if not exists rcsa_campaigns_status_idx on public.rcsa_campaigns (status);
create index if not exists rcsa_campaigns_result_idx on public.rcsa_campaigns (result);
create index if not exists rcsa_campaigns_owner_idx on public.rcsa_campaigns (owner_profile_id);
create index if not exists rcsa_campaigns_due_date_idx on public.rcsa_campaigns (due_date);
create index if not exists rcsa_campaigns_deleted_at_idx on public.rcsa_campaigns (deleted_at);

create index if not exists rcsa_responses_org_idx on public.rcsa_responses (organization_id);
create index if not exists rcsa_responses_campaign_idx on public.rcsa_responses (campaign_id);
create index if not exists rcsa_responses_question_idx on public.rcsa_responses (question_id);
create index if not exists rcsa_responses_deleted_at_idx on public.rcsa_responses (deleted_at);

drop trigger if exists set_rcsa_questions_updated_at on public.rcsa_questions;
create trigger set_rcsa_questions_updated_at
before update on public.rcsa_questions
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists set_rcsa_campaigns_updated_at on public.rcsa_campaigns;
create trigger set_rcsa_campaigns_updated_at
before update on public.rcsa_campaigns
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists set_rcsa_responses_updated_at on public.rcsa_responses;
create trigger set_rcsa_responses_updated_at
before update on public.rcsa_responses
for each row
execute function public.set_updated_at_timestamp();

alter table public.rcsa_questions enable row level security;
alter table public.rcsa_campaigns enable row level security;
alter table public.rcsa_responses enable row level security;

drop policy if exists "rcsa_questions_select_authenticated" on public.rcsa_questions;
create policy "rcsa_questions_select_authenticated"
  on public.rcsa_questions
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "rcsa_questions_insert_manager" on public.rcsa_questions;
create policy "rcsa_questions_insert_manager"
  on public.rcsa_questions
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "rcsa_questions_update_manager" on public.rcsa_questions;
create policy "rcsa_questions_update_manager"
  on public.rcsa_questions
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

drop policy if exists "rcsa_campaigns_select_authenticated" on public.rcsa_campaigns;
create policy "rcsa_campaigns_select_authenticated"
  on public.rcsa_campaigns
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "rcsa_campaigns_insert_manager" on public.rcsa_campaigns;
create policy "rcsa_campaigns_insert_manager"
  on public.rcsa_campaigns
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "rcsa_campaigns_update_owner_or_manager" on public.rcsa_campaigns;
create policy "rcsa_campaigns_update_owner_or_manager"
  on public.rcsa_campaigns
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_min_role('manager'::public.app_role)
      or owner_profile_id = auth.uid()
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_min_role('manager'::public.app_role)
      or owner_profile_id = auth.uid()
    )
  );

drop policy if exists "rcsa_responses_select_authenticated" on public.rcsa_responses;
create policy "rcsa_responses_select_authenticated"
  on public.rcsa_responses
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "rcsa_responses_insert_contributor" on public.rcsa_responses;
create policy "rcsa_responses_insert_contributor"
  on public.rcsa_responses
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.rcsa_campaigns campaigns
      where campaigns.id = rcsa_responses.campaign_id
        and campaigns.organization_id = public.current_organization_id()
        and campaigns.deleted_at is null
    )
    and exists (
      select 1
      from public.rcsa_questions questions
      where questions.id = rcsa_responses.question_id
        and questions.organization_id = public.current_organization_id()
        and questions.deleted_at is null
    )
  );

drop policy if exists "rcsa_responses_update_contributor" on public.rcsa_responses;
create policy "rcsa_responses_update_contributor"
  on public.rcsa_responses
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

with organizations as (
  select id as organization_id
  from public.organizations
),
question_rows (question_key, category, prompt, weight) as (
  values
    (
      'design_adequacy',
      'design_adequacy'::public.rcsa_question_category,
      'Control design is documented, understood, and aligned with the current risk scenario.',
      25
    ),
    (
      'operating_effectiveness',
      'operating_effectiveness'::public.rcsa_question_category,
      'Control execution operated as expected during the assessment period.',
      25
    ),
    (
      'recent_incidents',
      'recent_incidents'::public.rcsa_question_category,
      'Recent incidents, issues, or exceptions do not indicate control degradation.',
      20
    ),
    (
      'evidence_available',
      'evidence_available'::public.rcsa_question_category,
      'Current evidence exists and is sufficient to support the self-assessment.',
      15
    ),
    (
      'actions_needed',
      'actions_needed'::public.rcsa_question_category,
      'Required remediation actions are identified, owned, and time-bound.',
      15
    )
),
seed as (
  select
    organizations.organization_id,
    question_rows.question_key,
    question_rows.category,
    question_rows.prompt,
    question_rows.weight,
    (
      select profiles.id
      from public.profiles profiles
      where profiles.organization_id = organizations.organization_id
      order by profiles.created_at
      limit 1
    ) as actor_id
  from organizations
  cross join question_rows
)
insert into public.rcsa_questions (
  organization_id,
  question_key,
  category,
  prompt,
  weight,
  is_active,
  created_by,
  updated_by
)
select
  seed.organization_id,
  seed.question_key,
  seed.category,
  seed.prompt,
  seed.weight,
  true,
  seed.actor_id,
  seed.actor_id
from seed
where seed.actor_id is not null
on conflict (organization_id, question_key) do nothing;
