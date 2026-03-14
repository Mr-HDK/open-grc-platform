-- Policy registry and user attestations.

do $$
begin
  create type public.policy_status as enum ('draft', 'active', 'archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  title text not null,
  version text not null,
  status public.policy_status not null default 'draft',
  effective_date date not null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  content text,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint policies_title_check check (char_length(trim(title)) >= 3),
  constraint policies_version_check check (char_length(trim(version)) >= 1)
);

create table if not exists public.policy_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  acknowledged_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, policy_id, profile_id)
);

create unique index if not exists policies_title_version_unique_idx
  on public.policies (organization_id, title, version)
  where deleted_at is null;
create unique index if not exists policies_single_active_version_idx
  on public.policies (organization_id, title)
  where status = 'active' and deleted_at is null;
create index if not exists policies_organization_id_idx on public.policies (organization_id);
create index if not exists policies_status_idx on public.policies (status);
create index if not exists policies_owner_profile_id_idx on public.policies (owner_profile_id);
create index if not exists policies_effective_date_idx on public.policies (effective_date);
create index if not exists policies_deleted_at_idx on public.policies (deleted_at);
create index if not exists policy_attestations_policy_id_idx on public.policy_attestations (policy_id);
create index if not exists policy_attestations_profile_id_idx on public.policy_attestations (profile_id);

create trigger set_policies_updated_at
before update on public.policies
for each row
execute function public.set_updated_at_timestamp();

alter table public.policies enable row level security;
alter table public.policy_attestations enable row level security;

drop policy if exists "policies_select_authenticated" on public.policies;
create policy "policies_select_authenticated"
  on public.policies
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "policies_insert_authenticated" on public.policies;
create policy "policies_insert_authenticated"
  on public.policies
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "policies_update_authenticated" on public.policies;
create policy "policies_update_authenticated"
  on public.policies
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

drop policy if exists "policy_attestations_select_authenticated" on public.policy_attestations;
create policy "policy_attestations_select_authenticated"
  on public.policy_attestations
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      profile_id = auth.uid()
      or public.has_min_role('manager'::public.app_role)
    )
  );

drop policy if exists "policy_attestations_insert_authenticated" on public.policy_attestations;
create policy "policy_attestations_insert_authenticated"
  on public.policy_attestations
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and profile_id = auth.uid()
  );

drop policy if exists "policy_attestations_update_authenticated" on public.policy_attestations;
create policy "policy_attestations_update_authenticated"
  on public.policy_attestations
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and profile_id = auth.uid()
  )
  with check (
    organization_id = public.current_organization_id()
    and profile_id = auth.uid()
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
      'policy_attestation'
    )
  );
