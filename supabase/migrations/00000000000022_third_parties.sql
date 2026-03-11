-- Third-party risk lite register and periodic reviews.

do $$
begin
  create type public.third_party_assessment_status as enum ('acceptable', 'monitoring', 'elevated', 'critical');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.third_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  name text not null,
  service text not null,
  criticality public.asset_criticality not null default 'medium',
  assessment_status public.third_party_assessment_status not null default 'monitoring',
  assessment_score integer not null default 50 check (assessment_score between 0 and 100),
  next_review_date date,
  last_reviewed_at timestamptz,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint third_parties_name_check check (char_length(trim(name)) >= 2),
  constraint third_parties_service_check check (char_length(trim(service)) >= 2)
);

create table if not exists public.third_party_risks (
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  risk_id uuid not null references public.risks (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (third_party_id, risk_id)
);

create table if not exists public.third_party_controls (
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (third_party_id, control_id)
);

create table if not exists public.third_party_actions (
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  action_plan_id uuid not null references public.action_plans (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (third_party_id, action_plan_id)
);

create table if not exists public.third_party_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  review_date date not null,
  reviewer_profile_id uuid references public.profiles (id) on delete set null,
  assessment_status public.third_party_assessment_status not null,
  assessment_score integer not null check (assessment_score between 0 and 100),
  notes text,
  next_review_date date,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists third_parties_organization_id_idx on public.third_parties (organization_id);
create index if not exists third_parties_owner_profile_id_idx on public.third_parties (owner_profile_id);
create index if not exists third_parties_criticality_idx on public.third_parties (criticality);
create index if not exists third_parties_status_idx on public.third_parties (assessment_status);
create index if not exists third_parties_next_review_date_idx on public.third_parties (next_review_date);
create index if not exists third_parties_deleted_at_idx on public.third_parties (deleted_at);
create index if not exists third_party_risks_risk_id_idx on public.third_party_risks (risk_id);
create index if not exists third_party_controls_control_id_idx on public.third_party_controls (control_id);
create index if not exists third_party_actions_action_plan_id_idx on public.third_party_actions (action_plan_id);
create index if not exists third_party_reviews_third_party_id_idx on public.third_party_reviews (third_party_id);
create index if not exists third_party_reviews_review_date_idx on public.third_party_reviews (review_date);

create trigger set_third_parties_updated_at
before update on public.third_parties
for each row
execute function public.set_updated_at_timestamp();

create trigger set_third_party_reviews_updated_at
before update on public.third_party_reviews
for each row
execute function public.set_updated_at_timestamp();

alter table public.third_parties enable row level security;
alter table public.third_party_risks enable row level security;
alter table public.third_party_controls enable row level security;
alter table public.third_party_actions enable row level security;
alter table public.third_party_reviews enable row level security;

drop policy if exists "third_parties_select_authenticated" on public.third_parties;
create policy "third_parties_select_authenticated"
  on public.third_parties
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "third_parties_insert_authenticated" on public.third_parties;
create policy "third_parties_insert_authenticated"
  on public.third_parties
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
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
  );

drop policy if exists "third_party_risks_select_authenticated" on public.third_party_risks;
create policy "third_party_risks_select_authenticated"
  on public.third_party_risks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.third_parties third_parties
      join public.risks risks on risks.id = third_party_risks.risk_id
      where third_parties.id = third_party_risks.third_party_id
        and third_parties.deleted_at is null
        and risks.deleted_at is null
        and third_parties.organization_id = public.current_organization_id()
        and risks.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_risks_insert_authenticated" on public.third_party_risks;
create policy "third_party_risks_insert_authenticated"
  on public.third_party_risks
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      join public.risks risks on risks.id = third_party_risks.risk_id
      where third_parties.id = third_party_risks.third_party_id
        and third_parties.deleted_at is null
        and risks.deleted_at is null
        and third_parties.organization_id = public.current_organization_id()
        and risks.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_risks_delete_authenticated" on public.third_party_risks;
create policy "third_party_risks_delete_authenticated"
  on public.third_party_risks
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      join public.risks risks on risks.id = third_party_risks.risk_id
      where third_parties.id = third_party_risks.third_party_id
        and third_parties.organization_id = public.current_organization_id()
        and risks.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_controls_select_authenticated" on public.third_party_controls;
create policy "third_party_controls_select_authenticated"
  on public.third_party_controls
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.third_parties third_parties
      join public.controls controls on controls.id = third_party_controls.control_id
      where third_parties.id = third_party_controls.third_party_id
        and third_parties.deleted_at is null
        and controls.deleted_at is null
        and third_parties.organization_id = public.current_organization_id()
        and controls.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_controls_insert_authenticated" on public.third_party_controls;
create policy "third_party_controls_insert_authenticated"
  on public.third_party_controls
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      join public.controls controls on controls.id = third_party_controls.control_id
      where third_parties.id = third_party_controls.third_party_id
        and third_parties.deleted_at is null
        and controls.deleted_at is null
        and third_parties.organization_id = public.current_organization_id()
        and controls.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_controls_delete_authenticated" on public.third_party_controls;
create policy "third_party_controls_delete_authenticated"
  on public.third_party_controls
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      join public.controls controls on controls.id = third_party_controls.control_id
      where third_parties.id = third_party_controls.third_party_id
        and third_parties.organization_id = public.current_organization_id()
        and controls.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_actions_select_authenticated" on public.third_party_actions;
create policy "third_party_actions_select_authenticated"
  on public.third_party_actions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.third_parties third_parties
      join public.action_plans action_plans on action_plans.id = third_party_actions.action_plan_id
      where third_parties.id = third_party_actions.third_party_id
        and third_parties.deleted_at is null
        and action_plans.deleted_at is null
        and third_parties.organization_id = public.current_organization_id()
        and action_plans.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_actions_insert_authenticated" on public.third_party_actions;
create policy "third_party_actions_insert_authenticated"
  on public.third_party_actions
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      join public.action_plans action_plans on action_plans.id = third_party_actions.action_plan_id
      where third_parties.id = third_party_actions.third_party_id
        and third_parties.deleted_at is null
        and action_plans.deleted_at is null
        and third_parties.organization_id = public.current_organization_id()
        and action_plans.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_actions_delete_authenticated" on public.third_party_actions;
create policy "third_party_actions_delete_authenticated"
  on public.third_party_actions
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.third_parties third_parties
      join public.action_plans action_plans on action_plans.id = third_party_actions.action_plan_id
      where third_parties.id = third_party_actions.third_party_id
        and third_parties.organization_id = public.current_organization_id()
        and action_plans.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "third_party_reviews_select_authenticated" on public.third_party_reviews;
create policy "third_party_reviews_select_authenticated"
  on public.third_party_reviews
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists "third_party_reviews_insert_authenticated" on public.third_party_reviews;
create policy "third_party_reviews_insert_authenticated"
  on public.third_party_reviews
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "third_party_reviews_update_authenticated" on public.third_party_reviews;
create policy "third_party_reviews_update_authenticated"
  on public.third_party_reviews
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
      'finding',
      'risk_acceptance',
      'framework_requirement_assessment',
      'asset',
      'third_party',
      'third_party_review'
    )
  );
