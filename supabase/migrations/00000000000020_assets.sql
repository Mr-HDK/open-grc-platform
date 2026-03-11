-- Asset register and risk/control linking.

do $$
begin
  create type public.asset_criticality as enum ('low', 'medium', 'high', 'critical');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.asset_status as enum ('active', 'inactive', 'retired');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  name text not null,
  asset_type text not null,
  criticality public.asset_criticality not null default 'medium',
  status public.asset_status not null default 'active',
  owner_profile_id uuid references public.profiles (id) on delete set null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint assets_name_check check (char_length(trim(name)) >= 2),
  constraint assets_type_check check (char_length(trim(asset_type)) >= 2)
);

create table if not exists public.asset_risks (
  asset_id uuid not null references public.assets (id) on delete cascade,
  risk_id uuid not null references public.risks (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (asset_id, risk_id)
);

create table if not exists public.asset_controls (
  asset_id uuid not null references public.assets (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (asset_id, control_id)
);

create index if not exists assets_organization_id_idx on public.assets (organization_id);
create index if not exists assets_asset_type_idx on public.assets (asset_type);
create index if not exists assets_criticality_idx on public.assets (criticality);
create index if not exists assets_status_idx on public.assets (status);
create index if not exists assets_owner_profile_id_idx on public.assets (owner_profile_id);
create index if not exists assets_deleted_at_idx on public.assets (deleted_at);
create index if not exists asset_risks_risk_id_idx on public.asset_risks (risk_id);
create index if not exists asset_controls_control_id_idx on public.asset_controls (control_id);

create trigger set_assets_updated_at
before update on public.assets
for each row
execute function public.set_updated_at_timestamp();

alter table public.assets enable row level security;
alter table public.asset_risks enable row level security;
alter table public.asset_controls enable row level security;

drop policy if exists "assets_select_authenticated" on public.assets;
create policy "assets_select_authenticated"
  on public.assets
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "assets_insert_authenticated" on public.assets;
create policy "assets_insert_authenticated"
  on public.assets
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "assets_update_authenticated" on public.assets;
create policy "assets_update_authenticated"
  on public.assets
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

drop policy if exists "asset_risks_select_authenticated" on public.asset_risks;
create policy "asset_risks_select_authenticated"
  on public.asset_risks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.risks r on r.id = asset_risks.risk_id
      where a.id = asset_risks.asset_id
        and a.deleted_at is null
        and r.deleted_at is null
        and a.organization_id = public.current_organization_id()
        and r.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "asset_risks_insert_authenticated" on public.asset_risks;
create policy "asset_risks_insert_authenticated"
  on public.asset_risks
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.assets a
      join public.risks r on r.id = asset_risks.risk_id
      where a.id = asset_risks.asset_id
        and a.deleted_at is null
        and r.deleted_at is null
        and a.organization_id = public.current_organization_id()
        and r.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "asset_risks_delete_authenticated" on public.asset_risks;
create policy "asset_risks_delete_authenticated"
  on public.asset_risks
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.assets a
      join public.risks r on r.id = asset_risks.risk_id
      where a.id = asset_risks.asset_id
        and a.organization_id = public.current_organization_id()
        and r.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "asset_controls_select_authenticated" on public.asset_controls;
create policy "asset_controls_select_authenticated"
  on public.asset_controls
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.controls c on c.id = asset_controls.control_id
      where a.id = asset_controls.asset_id
        and a.deleted_at is null
        and c.deleted_at is null
        and a.organization_id = public.current_organization_id()
        and c.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "asset_controls_insert_authenticated" on public.asset_controls;
create policy "asset_controls_insert_authenticated"
  on public.asset_controls
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.assets a
      join public.controls c on c.id = asset_controls.control_id
      where a.id = asset_controls.asset_id
        and a.deleted_at is null
        and c.deleted_at is null
        and a.organization_id = public.current_organization_id()
        and c.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "asset_controls_delete_authenticated" on public.asset_controls;
create policy "asset_controls_delete_authenticated"
  on public.asset_controls
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.assets a
      join public.controls c on c.id = asset_controls.control_id
      where a.id = asset_controls.asset_id
        and a.organization_id = public.current_organization_id()
        and c.organization_id = public.current_organization_id()
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
      'asset'
    )
  );

notify pgrst, 'reload schema';
