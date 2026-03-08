-- Add organization scoping defaults and enforce tenant-aware RLS.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at_timestamp();

insert into public.organizations (name)
values ('Default Organization')
on conflict (name) do nothing;

create or replace function public.default_organization_id()
returns uuid
language sql
stable
as $$
  select id
  from public.organizations
  order by created_at
  limit 1;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
as $$
  select organization_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.resolve_organization_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    public.current_organization_id(),
    public.default_organization_id()
  );
$$;

alter table public.profiles
  alter column organization_id set default public.resolve_organization_id();
alter table public.risks
  alter column organization_id set default public.resolve_organization_id();
alter table public.controls
  alter column organization_id set default public.resolve_organization_id();
alter table public.action_plans
  alter column organization_id set default public.resolve_organization_id();
alter table public.evidence
  alter column organization_id set default public.resolve_organization_id();
alter table public.audit_log
  alter column organization_id set default public.resolve_organization_id();

update public.profiles
set organization_id = public.resolve_organization_id()
where organization_id is null
  or not exists (
    select 1
    from public.organizations o
    where o.id = profiles.organization_id
  );

update public.risks
set organization_id = coalesce(
  (select p.organization_id from public.profiles p where p.id = risks.owner_profile_id),
  (select p.organization_id from public.profiles p where p.id = risks.created_by),
  (select p.organization_id from public.profiles p where p.id = risks.updated_by),
  public.default_organization_id()
)
where organization_id is null
  or not exists (
    select 1
    from public.organizations o
    where o.id = risks.organization_id
  );

update public.controls
set organization_id = coalesce(
  (select p.organization_id from public.profiles p where p.id = controls.owner_profile_id),
  (select p.organization_id from public.profiles p where p.id = controls.created_by),
  (select p.organization_id from public.profiles p where p.id = controls.updated_by),
  public.default_organization_id()
)
where organization_id is null
  or not exists (
    select 1
    from public.organizations o
    where o.id = controls.organization_id
  );

update public.action_plans
set organization_id = coalesce(
  (select p.organization_id from public.profiles p where p.id = action_plans.owner_profile_id),
  (select p.organization_id from public.profiles p where p.id = action_plans.created_by),
  (select p.organization_id from public.profiles p where p.id = action_plans.updated_by),
  public.default_organization_id()
)
where organization_id is null
  or not exists (
    select 1
    from public.organizations o
    where o.id = action_plans.organization_id
  );

update public.evidence
set organization_id = coalesce(
  (select p.organization_id from public.profiles p where p.id = evidence.uploaded_by),
  public.default_organization_id()
)
where organization_id is null
  or not exists (
    select 1
    from public.organizations o
    where o.id = evidence.organization_id
  );

update public.audit_log
set organization_id = coalesce(
  (select p.organization_id from public.profiles p where p.id = audit_log.actor_profile_id),
  public.default_organization_id()
)
where organization_id is null
  or not exists (
    select 1
    from public.organizations o
    where o.id = audit_log.organization_id
  );

alter table public.profiles alter column organization_id set not null;
alter table public.risks alter column organization_id set not null;
alter table public.controls alter column organization_id set not null;
alter table public.action_plans alter column organization_id set not null;
alter table public.evidence alter column organization_id set not null;
alter table public.audit_log alter column organization_id set not null;

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists risks_organization_id_idx on public.risks (organization_id);
create index if not exists controls_organization_id_idx on public.controls (organization_id);
create index if not exists action_plans_organization_id_idx on public.action_plans (organization_id);
create index if not exists evidence_organization_id_idx on public.evidence (organization_id);
create index if not exists audit_log_organization_id_idx on public.audit_log (organization_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, organization_id)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@local.test'),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    'viewer',
    public.default_organization_id()
  )
  on conflict (id) do update
    set email = excluded.email,
        organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop policy if exists "risks_select_authenticated" on public.risks;
drop policy if exists "risks_insert_authenticated" on public.risks;
drop policy if exists "risks_update_authenticated" on public.risks;
create policy "risks_select_authenticated"
  on public.risks
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );
create policy "risks_insert_authenticated"
  on public.risks
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );
create policy "risks_update_authenticated"
  on public.risks
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

drop policy if exists "controls_select_authenticated" on public.controls;
drop policy if exists "controls_insert_authenticated" on public.controls;
drop policy if exists "controls_update_authenticated" on public.controls;
create policy "controls_select_authenticated"
  on public.controls
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );
create policy "controls_insert_authenticated"
  on public.controls
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );
create policy "controls_update_authenticated"
  on public.controls
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

drop policy if exists "risk_controls_select_authenticated" on public.risk_controls;
drop policy if exists "risk_controls_insert_authenticated" on public.risk_controls;
drop policy if exists "risk_controls_delete_authenticated" on public.risk_controls;
create policy "risk_controls_select_authenticated"
  on public.risk_controls
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.risks r
      join public.controls c on c.id = risk_controls.control_id
      where r.id = risk_controls.risk_id
        and r.deleted_at is null
        and c.deleted_at is null
        and r.organization_id = public.current_organization_id()
        and c.organization_id = public.current_organization_id()
    )
  );
create policy "risk_controls_insert_authenticated"
  on public.risk_controls
  for insert
  to authenticated
  with check (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.risks r
      join public.controls c on c.id = risk_controls.control_id
      where r.id = risk_controls.risk_id
        and r.deleted_at is null
        and c.deleted_at is null
        and r.organization_id = public.current_organization_id()
        and c.organization_id = public.current_organization_id()
    )
  );
create policy "risk_controls_delete_authenticated"
  on public.risk_controls
  for delete
  to authenticated
  using (
    public.has_min_role('contributor'::public.app_role)
    and exists (
      select 1
      from public.risks r
      join public.controls c on c.id = risk_controls.control_id
      where r.id = risk_controls.risk_id
        and r.organization_id = public.current_organization_id()
        and c.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "action_plans_select_authenticated" on public.action_plans;
drop policy if exists "action_plans_insert_authenticated" on public.action_plans;
drop policy if exists "action_plans_update_authenticated" on public.action_plans;
create policy "action_plans_select_authenticated"
  on public.action_plans
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );
create policy "action_plans_insert_authenticated"
  on public.action_plans
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );
create policy "action_plans_update_authenticated"
  on public.action_plans
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

drop policy if exists "evidence_select_authenticated" on public.evidence;
drop policy if exists "evidence_insert_authenticated" on public.evidence;
drop policy if exists "evidence_update_authenticated" on public.evidence;
create policy "evidence_select_authenticated"
  on public.evidence
  for select
  to authenticated
  using (
    archived_at is null
    and organization_id = public.current_organization_id()
  );
create policy "evidence_insert_authenticated"
  on public.evidence
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );
create policy "evidence_update_authenticated"
  on public.evidence
  for update
  to authenticated
  using (
    archived_at is null
    and organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "control_framework_mappings_select_authenticated" on public.control_framework_mappings;
drop policy if exists "control_framework_mappings_insert_authenticated" on public.control_framework_mappings;
drop policy if exists "control_framework_mappings_delete_authenticated" on public.control_framework_mappings;
create policy "control_framework_mappings_select_authenticated"
  on public.control_framework_mappings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.controls c
      where c.id = control_framework_mappings.control_id
        and c.deleted_at is null
        and c.organization_id = public.current_organization_id()
    )
  );
create policy "control_framework_mappings_insert_authenticated"
  on public.control_framework_mappings
  for insert
  to authenticated
  with check (
    public.has_min_role('admin'::public.app_role)
    and exists (
      select 1
      from public.controls c
      where c.id = control_framework_mappings.control_id
        and c.deleted_at is null
        and c.organization_id = public.current_organization_id()
    )
  );
create policy "control_framework_mappings_delete_authenticated"
  on public.control_framework_mappings
  for delete
  to authenticated
  using (
    public.has_min_role('admin'::public.app_role)
    and exists (
      select 1
      from public.controls c
      where c.id = control_framework_mappings.control_id
        and c.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "audit_log_select_authenticated" on public.audit_log;
drop policy if exists "audit_log_insert_authenticated" on public.audit_log;
create policy "audit_log_select_authenticated"
  on public.audit_log
  for select
  to authenticated
  using (organization_id = public.current_organization_id());
create policy "audit_log_insert_authenticated"
  on public.audit_log
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "evidence_objects_select_authenticated" on storage.objects;
drop policy if exists "evidence_objects_insert_authenticated" on storage.objects;
drop policy if exists "evidence_objects_delete_authenticated" on storage.objects;
create policy "evidence_objects_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (
      name like (public.current_organization_id()::text || '/%')
      or name like (auth.uid()::text || '/%')
      or name like 'seed/%'
    )
  );
create policy "evidence_objects_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.has_min_role('contributor'::public.app_role)
    and name like (public.current_organization_id()::text || '/%')
  );
create policy "evidence_objects_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_min_role('contributor'::public.app_role)
    and (
      name like (public.current_organization_id()::text || '/%')
      or name like (auth.uid()::text || '/%')
    )
  );
