-- Policy governance v2: review workflow, approvals, audience targeting, campaigns, and waivers.

do $$
begin
  alter type public.policy_status add value if not exists 'in_review';
exception
  when undefined_object then null;
end $$;

do $$
begin
  create type public.policy_approval_decision as enum ('approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.policy_campaign_audience_type as enum ('role', 'profiles', 'group');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.policy_attestation_status as enum ('pending', 'acknowledged', 'overdue');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.policy_exception_status as enum ('active', 'expired', 'revoked');
exception
  when duplicate_object then null;
end $$;

alter table public.policies
  add column if not exists next_review_date date;

update public.policies
set next_review_date = coalesce(next_review_date, (effective_date + interval '365 day')::date)
where next_review_date is null;

create index if not exists policies_next_review_date_idx on public.policies (next_review_date);

create table if not exists public.policy_audience_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  audience_key text not null,
  name text not null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint policy_audience_groups_audience_key_check check (char_length(trim(audience_key)) >= 2),
  constraint policy_audience_groups_name_check check (char_length(trim(name)) >= 2)
);

create unique index if not exists policy_audience_groups_unique_idx
  on public.policy_audience_groups (organization_id, audience_key)
  where deleted_at is null;
create index if not exists policy_audience_groups_org_idx on public.policy_audience_groups (organization_id);
create index if not exists policy_audience_groups_deleted_idx on public.policy_audience_groups (deleted_at);

drop trigger if exists set_policy_audience_groups_updated_at on public.policy_audience_groups;
create trigger set_policy_audience_groups_updated_at
before update on public.policy_audience_groups
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.policy_audience_group_members (
  group_id uuid not null references public.policy_audience_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, profile_id)
);

create index if not exists policy_audience_group_members_profile_idx
  on public.policy_audience_group_members (profile_id);

create table if not exists public.policy_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  approver_profile_id uuid not null references public.profiles (id) on delete cascade,
  decision public.policy_approval_decision not null,
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint policy_approvals_comment_check check (comment is null or char_length(trim(comment)) <= 2000)
);

create unique index if not exists policy_approvals_policy_approver_idx
  on public.policy_approvals (policy_id, approver_profile_id);
create index if not exists policy_approvals_org_idx on public.policy_approvals (organization_id);
create index if not exists policy_approvals_policy_idx on public.policy_approvals (policy_id);

create table if not exists public.policy_attestation_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  name text not null,
  due_date date not null,
  audience_type public.policy_campaign_audience_type not null,
  audience_role public.app_role,
  audience_group_id uuid references public.policy_audience_groups (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint policy_attestation_campaigns_name_check check (char_length(trim(name)) >= 3),
  constraint policy_attestation_campaigns_audience_scope_check check (
    (audience_type = 'role' and audience_role is not null and audience_group_id is null)
    or (audience_type = 'group' and audience_group_id is not null and audience_role is null)
    or (audience_type = 'profiles' and audience_role is null and audience_group_id is null)
  )
);

create index if not exists policy_attestation_campaigns_org_idx on public.policy_attestation_campaigns (organization_id);
create index if not exists policy_attestation_campaigns_policy_idx on public.policy_attestation_campaigns (policy_id);
create index if not exists policy_attestation_campaigns_due_idx on public.policy_attestation_campaigns (due_date);
create index if not exists policy_attestation_campaigns_deleted_idx on public.policy_attestation_campaigns (deleted_at);

drop trigger if exists set_policy_attestation_campaigns_updated_at on public.policy_attestation_campaigns;
create trigger set_policy_attestation_campaigns_updated_at
before update on public.policy_attestation_campaigns
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.policy_attestation_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  campaign_id uuid not null references public.policy_attestation_campaigns (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  due_date date not null,
  status public.policy_attestation_status not null default 'pending',
  acknowledged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, profile_id),
  constraint policy_attestation_targets_ack_check check (
    (status = 'acknowledged' and acknowledged_at is not null)
    or (status in ('pending', 'overdue') and acknowledged_at is null)
  )
);

create index if not exists policy_attestation_targets_org_idx on public.policy_attestation_targets (organization_id);
create index if not exists policy_attestation_targets_policy_idx on public.policy_attestation_targets (policy_id);
create index if not exists policy_attestation_targets_profile_idx on public.policy_attestation_targets (profile_id);
create index if not exists policy_attestation_targets_status_idx on public.policy_attestation_targets (status);
create index if not exists policy_attestation_targets_due_idx on public.policy_attestation_targets (due_date);

drop trigger if exists set_policy_attestation_targets_updated_at on public.policy_attestation_targets;
create trigger set_policy_attestation_targets_updated_at
before update on public.policy_attestation_targets
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.policy_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  justification text not null,
  expiration_date date not null,
  approved_by_profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.policy_exception_status not null default 'active',
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint policy_exceptions_justification_check check (char_length(trim(justification)) >= 10),
  constraint policy_exceptions_revocation_check check (
    (status = 'revoked' and revoked_at is not null and revoked_by_profile_id is not null)
    or (status <> 'revoked' and revoked_at is null and revoked_by_profile_id is null)
  )
);

create index if not exists policy_exceptions_org_idx on public.policy_exceptions (organization_id);
create index if not exists policy_exceptions_policy_idx on public.policy_exceptions (policy_id);
create index if not exists policy_exceptions_profile_idx on public.policy_exceptions (profile_id);
create index if not exists policy_exceptions_status_idx on public.policy_exceptions (status);
create index if not exists policy_exceptions_expiration_idx on public.policy_exceptions (expiration_date);
create index if not exists policy_exceptions_deleted_idx on public.policy_exceptions (deleted_at);

drop trigger if exists set_policy_exceptions_updated_at on public.policy_exceptions;
create trigger set_policy_exceptions_updated_at
before update on public.policy_exceptions
for each row
execute function public.set_updated_at_timestamp();

alter table public.policy_audience_groups enable row level security;
alter table public.policy_audience_group_members enable row level security;
alter table public.policy_approvals enable row level security;
alter table public.policy_attestation_campaigns enable row level security;
alter table public.policy_attestation_targets enable row level security;
alter table public.policy_exceptions enable row level security;

drop policy if exists "policy_audience_groups_select_authenticated" on public.policy_audience_groups;
create policy "policy_audience_groups_select_authenticated"
  on public.policy_audience_groups
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "policy_audience_groups_insert_authenticated" on public.policy_audience_groups;
create policy "policy_audience_groups_insert_authenticated"
  on public.policy_audience_groups
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "policy_audience_groups_update_authenticated" on public.policy_audience_groups;
create policy "policy_audience_groups_update_authenticated"
  on public.policy_audience_groups
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

drop policy if exists "policy_audience_group_members_select_authenticated" on public.policy_audience_group_members;
create policy "policy_audience_group_members_select_authenticated"
  on public.policy_audience_group_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.policy_audience_groups groups
      where groups.id = policy_audience_group_members.group_id
        and groups.organization_id = public.current_organization_id()
        and groups.deleted_at is null
    )
  );

drop policy if exists "policy_audience_group_members_insert_authenticated" on public.policy_audience_group_members;
create policy "policy_audience_group_members_insert_authenticated"
  on public.policy_audience_group_members
  for insert
  to authenticated
  with check (
    public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.policy_audience_groups groups
      join public.profiles profiles on profiles.id = policy_audience_group_members.profile_id
      where groups.id = policy_audience_group_members.group_id
        and groups.organization_id = public.current_organization_id()
        and groups.deleted_at is null
        and profiles.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "policy_audience_group_members_delete_authenticated" on public.policy_audience_group_members;
create policy "policy_audience_group_members_delete_authenticated"
  on public.policy_audience_group_members
  for delete
  to authenticated
  using (
    public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.policy_audience_groups groups
      where groups.id = policy_audience_group_members.group_id
        and groups.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "policy_approvals_select_authenticated" on public.policy_approvals;
create policy "policy_approvals_select_authenticated"
  on public.policy_approvals
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists "policy_approvals_insert_authenticated" on public.policy_approvals;
create policy "policy_approvals_insert_authenticated"
  on public.policy_approvals
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and approver_profile_id = auth.uid()
    and exists (
      select 1
      from public.policies policies
      where policies.id = policy_approvals.policy_id
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
    )
  );

drop policy if exists "policy_attestation_campaigns_select_authenticated" on public.policy_attestation_campaigns;
create policy "policy_attestation_campaigns_select_authenticated"
  on public.policy_attestation_campaigns
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "policy_attestation_campaigns_insert_authenticated" on public.policy_attestation_campaigns;
create policy "policy_attestation_campaigns_insert_authenticated"
  on public.policy_attestation_campaigns
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.policies policies
      where policies.id = policy_attestation_campaigns.policy_id
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
    )
    and (
      audience_group_id is null
      or exists (
        select 1
        from public.policy_audience_groups groups
        where groups.id = policy_attestation_campaigns.audience_group_id
          and groups.organization_id = public.current_organization_id()
          and groups.deleted_at is null
      )
    )
  );

drop policy if exists "policy_attestation_campaigns_update_authenticated" on public.policy_attestation_campaigns;
create policy "policy_attestation_campaigns_update_authenticated"
  on public.policy_attestation_campaigns
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
      from public.policies policies
      where policies.id = policy_attestation_campaigns.policy_id
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
    )
    and (
      audience_group_id is null
      or exists (
        select 1
        from public.policy_audience_groups groups
        where groups.id = policy_attestation_campaigns.audience_group_id
          and groups.organization_id = public.current_organization_id()
          and groups.deleted_at is null
      )
    )
  );

drop policy if exists "policy_attestation_targets_select_authenticated" on public.policy_attestation_targets;
create policy "policy_attestation_targets_select_authenticated"
  on public.policy_attestation_targets
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      profile_id = auth.uid()
      or public.has_min_role('manager'::public.app_role)
    )
  );

drop policy if exists "policy_attestation_targets_insert_authenticated" on public.policy_attestation_targets;
create policy "policy_attestation_targets_insert_authenticated"
  on public.policy_attestation_targets
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.policy_attestation_campaigns campaigns
      join public.policies policies on policies.id = policy_attestation_targets.policy_id
      join public.profiles profiles on profiles.id = policy_attestation_targets.profile_id
      where campaigns.id = policy_attestation_targets.campaign_id
        and campaigns.id = policy_attestation_targets.campaign_id
        and campaigns.policy_id = policy_attestation_targets.policy_id
        and campaigns.organization_id = public.current_organization_id()
        and campaigns.deleted_at is null
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
        and profiles.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "policy_attestation_targets_update_authenticated" on public.policy_attestation_targets;
create policy "policy_attestation_targets_update_authenticated"
  on public.policy_attestation_targets
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      profile_id = auth.uid()
      or public.has_min_role('manager'::public.app_role)
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      profile_id = auth.uid()
      or public.has_min_role('manager'::public.app_role)
    )
    and exists (
      select 1
      from public.policy_attestation_campaigns campaigns
      join public.policies policies on policies.id = policy_attestation_targets.policy_id
      where campaigns.id = policy_attestation_targets.campaign_id
        and campaigns.policy_id = policy_attestation_targets.policy_id
        and campaigns.organization_id = public.current_organization_id()
        and campaigns.deleted_at is null
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
    )
  );

drop policy if exists "policy_exceptions_select_authenticated" on public.policy_exceptions;
create policy "policy_exceptions_select_authenticated"
  on public.policy_exceptions
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "policy_exceptions_insert_authenticated" on public.policy_exceptions;
create policy "policy_exceptions_insert_authenticated"
  on public.policy_exceptions
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and exists (
      select 1
      from public.policies policies
      where policies.id = policy_exceptions.policy_id
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
    )
    and exists (
      select 1
      from public.profiles approver
      where approver.id = policy_exceptions.approved_by_profile_id
        and approver.organization_id = public.current_organization_id()
    )
    and (
      profile_id is null
      or exists (
        select 1
        from public.profiles profile_scope
        where profile_scope.id = policy_exceptions.profile_id
          and profile_scope.organization_id = public.current_organization_id()
      )
    )
    and (
      revoked_by_profile_id is null
      or exists (
        select 1
        from public.profiles revoker
        where revoker.id = policy_exceptions.revoked_by_profile_id
          and revoker.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "policy_exceptions_update_authenticated" on public.policy_exceptions;
create policy "policy_exceptions_update_authenticated"
  on public.policy_exceptions
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
      from public.policies policies
      where policies.id = policy_exceptions.policy_id
        and policies.organization_id = public.current_organization_id()
        and policies.deleted_at is null
    )
    and exists (
      select 1
      from public.profiles approver
      where approver.id = policy_exceptions.approved_by_profile_id
        and approver.organization_id = public.current_organization_id()
    )
    and (
      profile_id is null
      or exists (
        select 1
        from public.profiles profile_scope
        where profile_scope.id = policy_exceptions.profile_id
          and profile_scope.organization_id = public.current_organization_id()
      )
    )
    and (
      revoked_by_profile_id is null
      or exists (
        select 1
        from public.profiles revoker
        where revoker.id = policy_exceptions.revoked_by_profile_id
          and revoker.organization_id = public.current_organization_id()
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
      'policy_exception'
    )
  );
