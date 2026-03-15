-- Third-party risk management v2: richer vendor profile, questionnaire reviews, and document requests.

do $$
begin
  create type public.third_party_tier as enum ('tier_1', 'tier_2', 'tier_3');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.third_party_inherent_risk as enum ('low', 'medium', 'high', 'critical');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.third_party_onboarding_status as enum ('planned', 'in_progress', 'completed', 'blocked');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.third_party_review_response_value as enum (
    'yes',
    'partial',
    'no',
    'not_applicable'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.third_party_review_conclusion as enum (
    'low_risk',
    'moderate_risk',
    'high_risk',
    'critical_risk'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.third_party_document_request_status as enum (
    'requested',
    'submitted',
    'accepted',
    'rejected',
    'waived'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.third_parties
  add column if not exists tier public.third_party_tier not null default 'tier_2',
  add column if not exists inherent_risk public.third_party_inherent_risk not null default 'medium',
  add column if not exists contract_owner_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists renewal_date date,
  add column if not exists onboarding_status public.third_party_onboarding_status not null default 'in_progress',
  add column if not exists reassessment_interval_days integer not null default 90;

alter table public.third_parties drop constraint if exists third_parties_reassessment_interval_days_check;
alter table public.third_parties
  add constraint third_parties_reassessment_interval_days_check
  check (reassessment_interval_days between 7 and 730);

create index if not exists third_parties_tier_idx on public.third_parties (tier);
create index if not exists third_parties_inherent_risk_idx on public.third_parties (inherent_risk);
create index if not exists third_parties_contract_owner_profile_id_idx on public.third_parties (contract_owner_profile_id);
create index if not exists third_parties_renewal_date_idx on public.third_parties (renewal_date);
create index if not exists third_parties_onboarding_status_idx on public.third_parties (onboarding_status);

alter table public.third_party_reviews
  add column if not exists questionnaire_score integer,
  add column if not exists conclusion public.third_party_review_conclusion;

update public.third_party_reviews
set questionnaire_score = coalesce(questionnaire_score, assessment_score)
where questionnaire_score is null;

update public.third_party_reviews
set conclusion = coalesce(
  conclusion,
  case
    when coalesce(questionnaire_score, assessment_score) >= 80 then 'low_risk'::public.third_party_review_conclusion
    when coalesce(questionnaire_score, assessment_score) >= 60 then 'moderate_risk'::public.third_party_review_conclusion
    when coalesce(questionnaire_score, assessment_score) >= 40 then 'high_risk'::public.third_party_review_conclusion
    else 'critical_risk'::public.third_party_review_conclusion
  end
)
where conclusion is null;

alter table public.third_party_reviews
  alter column questionnaire_score set default 0,
  alter column questionnaire_score set not null,
  alter column conclusion set default 'moderate_risk'::public.third_party_review_conclusion,
  alter column conclusion set not null;

alter table public.third_party_reviews drop constraint if exists third_party_reviews_questionnaire_score_check;
alter table public.third_party_reviews
  add constraint third_party_reviews_questionnaire_score_check
  check (questionnaire_score between 0 and 100);

create index if not exists third_party_reviews_conclusion_idx on public.third_party_reviews (conclusion);

create table if not exists public.third_party_review_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  question_key text not null,
  prompt text not null,
  weight integer not null default 25 check (weight between 1 and 100),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint third_party_review_questions_key_check check (char_length(trim(question_key)) >= 2),
  constraint third_party_review_questions_prompt_check check (char_length(trim(prompt)) >= 8)
);

create unique index if not exists third_party_review_questions_unique_idx
  on public.third_party_review_questions (organization_id, question_key)
  where deleted_at is null;
create index if not exists third_party_review_questions_org_idx on public.third_party_review_questions (organization_id);
create index if not exists third_party_review_questions_deleted_idx on public.third_party_review_questions (deleted_at);

drop trigger if exists set_third_party_review_questions_updated_at on public.third_party_review_questions;
create trigger set_third_party_review_questions_updated_at
before update on public.third_party_review_questions
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.third_party_review_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  third_party_review_id uuid not null references public.third_party_reviews (id) on delete cascade,
  question_id uuid not null references public.third_party_review_questions (id) on delete cascade,
  response_value public.third_party_review_response_value not null,
  response_notes text,
  score integer not null default 0 check (score between 0 and 100),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (third_party_review_id, question_id),
  constraint third_party_review_responses_notes_check check (
    response_notes is null or char_length(trim(response_notes)) <= 4000
  )
);

create index if not exists third_party_review_responses_org_idx on public.third_party_review_responses (organization_id);
create index if not exists third_party_review_responses_review_idx on public.third_party_review_responses (third_party_review_id);
create index if not exists third_party_review_responses_question_idx on public.third_party_review_responses (question_id);

drop trigger if exists set_third_party_review_responses_updated_at on public.third_party_review_responses;
create trigger set_third_party_review_responses_updated_at
before update on public.third_party_review_responses
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.third_party_document_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  title text not null,
  description text,
  status public.third_party_document_request_status not null default 'requested',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  requested_by_profile_id uuid references public.profiles (id) on delete set null,
  due_date date not null,
  evidence_id uuid references public.evidence (id) on delete set null,
  response_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint third_party_document_requests_title_check check (char_length(trim(title)) >= 3),
  constraint third_party_document_requests_description_check check (
    description is null or char_length(trim(description)) <= 4000
  ),
  constraint third_party_document_requests_response_notes_check check (
    response_notes is null or char_length(trim(response_notes)) <= 4000
  )
);

create index if not exists third_party_document_requests_org_idx on public.third_party_document_requests (organization_id);
create index if not exists third_party_document_requests_third_party_idx on public.third_party_document_requests (third_party_id);
create index if not exists third_party_document_requests_status_idx on public.third_party_document_requests (status);
create index if not exists third_party_document_requests_due_date_idx on public.third_party_document_requests (due_date);
create index if not exists third_party_document_requests_owner_profile_idx on public.third_party_document_requests (owner_profile_id);
create index if not exists third_party_document_requests_deleted_idx on public.third_party_document_requests (deleted_at);

drop trigger if exists set_third_party_document_requests_updated_at on public.third_party_document_requests;
create trigger set_third_party_document_requests_updated_at
before update on public.third_party_document_requests
for each row
execute function public.set_updated_at_timestamp();

alter table public.third_party_review_questions enable row level security;
alter table public.third_party_review_responses enable row level security;
alter table public.third_party_document_requests enable row level security;

drop policy if exists "third_parties_insert_authenticated" on public.third_parties;
create policy "third_parties_insert_authenticated"
  on public.third_parties
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
        where profiles.id = third_parties.owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
    and (
      contract_owner_profile_id is null
      or exists (
        select 1
        from public.profiles profiles
        where profiles.id = third_parties.contract_owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "third_parties_update_authenticated" on public.third_parties;
create policy "third_parties_update_authenticated"
  on public.third_parties
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
        where profiles.id = third_parties.owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
    and (
      contract_owner_profile_id is null
      or exists (
        select 1
        from public.profiles profiles
        where profiles.id = third_parties.contract_owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "third_party_review_questions_select_authenticated" on public.third_party_review_questions;
create policy "third_party_review_questions_select_authenticated"
  on public.third_party_review_questions
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "third_party_review_questions_insert_authenticated" on public.third_party_review_questions;
create policy "third_party_review_questions_insert_authenticated"
  on public.third_party_review_questions
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "third_party_review_questions_update_authenticated" on public.third_party_review_questions;
create policy "third_party_review_questions_update_authenticated"
  on public.third_party_review_questions
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

drop policy if exists "third_party_review_responses_select_authenticated" on public.third_party_review_responses;
create policy "third_party_review_responses_select_authenticated"
  on public.third_party_review_responses
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists "third_party_review_responses_insert_authenticated" on public.third_party_review_responses;
create policy "third_party_review_responses_insert_authenticated"
  on public.third_party_review_responses
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_party_reviews reviews
      join public.third_parties third_parties on third_parties.id = reviews.third_party_id
      where reviews.id = third_party_review_responses.third_party_review_id
        and reviews.organization_id = public.current_organization_id()
        and third_parties.organization_id = public.current_organization_id()
        and third_parties.deleted_at is null
    )
    and exists (
      select 1
      from public.third_party_review_questions questions
      where questions.id = third_party_review_responses.question_id
        and questions.organization_id = public.current_organization_id()
        and questions.deleted_at is null
    )
  );

drop policy if exists "third_party_review_responses_update_authenticated" on public.third_party_review_responses;
create policy "third_party_review_responses_update_authenticated"
  on public.third_party_review_responses
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
      from public.third_party_reviews reviews
      join public.third_parties third_parties on third_parties.id = reviews.third_party_id
      where reviews.id = third_party_review_responses.third_party_review_id
        and reviews.organization_id = public.current_organization_id()
        and third_parties.organization_id = public.current_organization_id()
        and third_parties.deleted_at is null
    )
    and exists (
      select 1
      from public.third_party_review_questions questions
      where questions.id = third_party_review_responses.question_id
        and questions.organization_id = public.current_organization_id()
        and questions.deleted_at is null
    )
  );

drop policy if exists "third_party_document_requests_select_authenticated" on public.third_party_document_requests;
create policy "third_party_document_requests_select_authenticated"
  on public.third_party_document_requests
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "third_party_document_requests_insert_authenticated" on public.third_party_document_requests;
create policy "third_party_document_requests_insert_authenticated"
  on public.third_party_document_requests
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      where third_parties.id = third_party_document_requests.third_party_id
        and third_parties.organization_id = public.current_organization_id()
        and third_parties.deleted_at is null
    )
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = third_party_document_requests.owner_profile_id
          and owner_profile.organization_id = public.current_organization_id()
      )
    )
    and (
      requested_by_profile_id is null
      or exists (
        select 1
        from public.profiles requester
        where requester.id = third_party_document_requests.requested_by_profile_id
          and requester.organization_id = public.current_organization_id()
      )
    )
    and (
      evidence_id is null
      or exists (
        select 1
        from public.evidence evidence
        where evidence.id = third_party_document_requests.evidence_id
          and evidence.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "third_party_document_requests_update_authenticated" on public.third_party_document_requests;
create policy "third_party_document_requests_update_authenticated"
  on public.third_party_document_requests
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
      from public.third_parties third_parties
      where third_parties.id = third_party_document_requests.third_party_id
        and third_parties.organization_id = public.current_organization_id()
        and third_parties.deleted_at is null
    )
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = third_party_document_requests.owner_profile_id
          and owner_profile.organization_id = public.current_organization_id()
      )
    )
    and (
      requested_by_profile_id is null
      or exists (
        select 1
        from public.profiles requester
        where requester.id = third_party_document_requests.requested_by_profile_id
          and requester.organization_id = public.current_organization_id()
      )
    )
    and (
      evidence_id is null
      or exists (
        select 1
        from public.evidence evidence
        where evidence.id = third_party_document_requests.evidence_id
          and evidence.organization_id = public.current_organization_id()
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
      'issue',
      'policy_approval',
      'policy_attestation_campaign',
      'policy_exception',
      'third_party_review_response',
      'third_party_document_request'
    )
  );
