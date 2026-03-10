-- Incident register.

do $$
begin
  create type public.incident_status as enum ('open', 'investigating', 'mitigated', 'closed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  title text not null,
  description text not null,
  status public.incident_status not null default 'open',
  occurred_at date,
  risk_id uuid references public.risks (id) on delete set null,
  action_plan_id uuid references public.action_plans (id) on delete set null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists incidents_status_idx on public.incidents (status);
create index if not exists incidents_risk_id_idx on public.incidents (risk_id);
create index if not exists incidents_action_plan_id_idx on public.incidents (action_plan_id);
create index if not exists incidents_owner_profile_id_idx on public.incidents (owner_profile_id);
create index if not exists incidents_deleted_at_idx on public.incidents (deleted_at);

create trigger set_incidents_updated_at
before update on public.incidents
for each row
execute function public.set_updated_at_timestamp();

alter table public.incidents enable row level security;

drop policy if exists "incidents_select_authenticated" on public.incidents;
create policy "incidents_select_authenticated"
  on public.incidents
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "incidents_insert_authenticated" on public.incidents;
create policy "incidents_insert_authenticated"
  on public.incidents
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "incidents_update_authenticated" on public.incidents;
create policy "incidents_update_authenticated"
  on public.incidents
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
  check (entity_type in ('risk', 'control', 'action_plan', 'incident'));
