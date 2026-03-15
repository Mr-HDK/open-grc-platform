-- Auditable entity register and explicit links to core operational records.

do $$
begin
  create type public.auditable_entity_type as enum (
    'business_unit',
    'process',
    'application',
    'product',
    'vendor',
    'legal_entity',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.auditable_entity_status as enum ('active', 'inactive', 'retired');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.auditable_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  name text not null,
  entity_type public.auditable_entity_type not null default 'process',
  status public.auditable_entity_status not null default 'active',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  parent_entity_id uuid references public.auditable_entities (id) on delete set null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint auditable_entities_name_check check (char_length(trim(name)) >= 2),
  constraint auditable_entities_parent_check check (parent_entity_id is null or parent_entity_id <> id)
);

create table if not exists public.auditable_entity_risks (
  auditable_entity_id uuid not null references public.auditable_entities (id) on delete cascade,
  risk_id uuid not null references public.risks (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auditable_entity_id, risk_id)
);

create table if not exists public.auditable_entity_controls (
  auditable_entity_id uuid not null references public.auditable_entities (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auditable_entity_id, control_id)
);

create table if not exists public.auditable_entity_assets (
  auditable_entity_id uuid not null references public.auditable_entities (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auditable_entity_id, asset_id)
);

create table if not exists public.auditable_entity_third_parties (
  auditable_entity_id uuid not null references public.auditable_entities (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (auditable_entity_id, third_party_id)
);

create index if not exists auditable_entities_organization_id_idx on public.auditable_entities (organization_id);
create index if not exists auditable_entities_owner_profile_id_idx on public.auditable_entities (owner_profile_id);
create index if not exists auditable_entities_parent_entity_id_idx on public.auditable_entities (parent_entity_id);
create index if not exists auditable_entities_entity_type_idx on public.auditable_entities (entity_type);
create index if not exists auditable_entities_status_idx on public.auditable_entities (status);
create index if not exists auditable_entities_deleted_at_idx on public.auditable_entities (deleted_at);
create index if not exists auditable_entity_risks_risk_id_idx on public.auditable_entity_risks (risk_id);
create index if not exists auditable_entity_controls_control_id_idx on public.auditable_entity_controls (control_id);
create index if not exists auditable_entity_assets_asset_id_idx on public.auditable_entity_assets (asset_id);
create index if not exists auditable_entity_third_parties_third_party_id_idx on public.auditable_entity_third_parties (third_party_id);

create trigger set_auditable_entities_updated_at
before update on public.auditable_entities
for each row
execute function public.set_updated_at_timestamp();

alter table public.auditable_entities enable row level security;
alter table public.auditable_entity_risks enable row level security;
alter table public.auditable_entity_controls enable row level security;
alter table public.auditable_entity_assets enable row level security;
alter table public.auditable_entity_third_parties enable row level security;

drop policy if exists "auditable_entities_select_authenticated" on public.auditable_entities;
create policy "auditable_entities_select_authenticated"
  on public.auditable_entities
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "auditable_entities_insert_authenticated" on public.auditable_entities;
create policy "auditable_entities_insert_authenticated"
  on public.auditable_entities
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "auditable_entities_update_authenticated" on public.auditable_entities;
create policy "auditable_entities_update_authenticated"
  on public.auditable_entities
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

drop policy if exists "auditable_entity_risks_select_authenticated" on public.auditable_entity_risks;
create policy "auditable_entity_risks_select_authenticated"
  on public.auditable_entity_risks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.risks risks on risks.id = auditable_entity_risks.risk_id
      where auditable_entities.id = auditable_entity_risks.auditable_entity_id
        and auditable_entities.deleted_at is null
        and risks.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and risks.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_risks_insert_authenticated" on public.auditable_entity_risks;
create policy "auditable_entity_risks_insert_authenticated"
  on public.auditable_entity_risks
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.risks risks on risks.id = auditable_entity_risks.risk_id
      where auditable_entities.id = auditable_entity_risks.auditable_entity_id
        and auditable_entities.deleted_at is null
        and risks.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and risks.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_risks_delete_authenticated" on public.auditable_entity_risks;
create policy "auditable_entity_risks_delete_authenticated"
  on public.auditable_entity_risks
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.risks risks on risks.id = auditable_entity_risks.risk_id
      where auditable_entities.id = auditable_entity_risks.auditable_entity_id
        and auditable_entities.organization_id = public.current_organization_id()
        and risks.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_controls_select_authenticated" on public.auditable_entity_controls;
create policy "auditable_entity_controls_select_authenticated"
  on public.auditable_entity_controls
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.controls controls on controls.id = auditable_entity_controls.control_id
      where auditable_entities.id = auditable_entity_controls.auditable_entity_id
        and auditable_entities.deleted_at is null
        and controls.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and controls.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_controls_insert_authenticated" on public.auditable_entity_controls;
create policy "auditable_entity_controls_insert_authenticated"
  on public.auditable_entity_controls
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.controls controls on controls.id = auditable_entity_controls.control_id
      where auditable_entities.id = auditable_entity_controls.auditable_entity_id
        and auditable_entities.deleted_at is null
        and controls.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and controls.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_controls_delete_authenticated" on public.auditable_entity_controls;
create policy "auditable_entity_controls_delete_authenticated"
  on public.auditable_entity_controls
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.controls controls on controls.id = auditable_entity_controls.control_id
      where auditable_entities.id = auditable_entity_controls.auditable_entity_id
        and auditable_entities.organization_id = public.current_organization_id()
        and controls.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_assets_select_authenticated" on public.auditable_entity_assets;
create policy "auditable_entity_assets_select_authenticated"
  on public.auditable_entity_assets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.assets assets on assets.id = auditable_entity_assets.asset_id
      where auditable_entities.id = auditable_entity_assets.auditable_entity_id
        and auditable_entities.deleted_at is null
        and assets.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and assets.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_assets_insert_authenticated" on public.auditable_entity_assets;
create policy "auditable_entity_assets_insert_authenticated"
  on public.auditable_entity_assets
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.assets assets on assets.id = auditable_entity_assets.asset_id
      where auditable_entities.id = auditable_entity_assets.auditable_entity_id
        and auditable_entities.deleted_at is null
        and assets.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and assets.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_assets_delete_authenticated" on public.auditable_entity_assets;
create policy "auditable_entity_assets_delete_authenticated"
  on public.auditable_entity_assets
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.assets assets on assets.id = auditable_entity_assets.asset_id
      where auditable_entities.id = auditable_entity_assets.auditable_entity_id
        and auditable_entities.organization_id = public.current_organization_id()
        and assets.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_third_parties_select_authenticated" on public.auditable_entity_third_parties;
create policy "auditable_entity_third_parties_select_authenticated"
  on public.auditable_entity_third_parties
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.third_parties third_parties on third_parties.id = auditable_entity_third_parties.third_party_id
      where auditable_entities.id = auditable_entity_third_parties.auditable_entity_id
        and auditable_entities.deleted_at is null
        and third_parties.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and third_parties.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_third_parties_insert_authenticated" on public.auditable_entity_third_parties;
create policy "auditable_entity_third_parties_insert_authenticated"
  on public.auditable_entity_third_parties
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.third_parties third_parties on third_parties.id = auditable_entity_third_parties.third_party_id
      where auditable_entities.id = auditable_entity_third_parties.auditable_entity_id
        and auditable_entities.deleted_at is null
        and third_parties.deleted_at is null
        and auditable_entities.organization_id = public.current_organization_id()
        and third_parties.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "auditable_entity_third_parties_delete_authenticated" on public.auditable_entity_third_parties;
create policy "auditable_entity_third_parties_delete_authenticated"
  on public.auditable_entity_third_parties
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.auditable_entities auditable_entities
      join public.third_parties third_parties on third_parties.id = auditable_entity_third_parties.third_party_id
      where auditable_entities.id = auditable_entity_third_parties.auditable_entity_id
        and auditable_entities.organization_id = public.current_organization_id()
        and third_parties.organization_id = public.current_organization_id()
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
      'auditable_entity'
    )
  );
