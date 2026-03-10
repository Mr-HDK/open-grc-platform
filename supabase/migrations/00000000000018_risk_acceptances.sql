-- Risk acceptances and exceptions.

do $$
begin
  create type public.risk_acceptance_status as enum ('active', 'expired', 'revoked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.risk_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  risk_id uuid not null references public.risks (id) on delete cascade,
  control_id uuid references public.controls (id) on delete set null,
  action_plan_id uuid references public.action_plans (id) on delete set null,
  justification text not null,
  approved_by_profile_id uuid not null references public.profiles (id),
  approved_at timestamptz not null default timezone('utc', now()),
  expiration_date date not null,
  status public.risk_acceptance_status not null default 'active',
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint risk_acceptances_revoked_consistency check (
    (status = 'revoked' and revoked_at is not null and revoked_by_profile_id is not null)
    or (status <> 'revoked')
  )
);

create index if not exists risk_acceptances_risk_id_idx on public.risk_acceptances (risk_id);
create index if not exists risk_acceptances_status_idx on public.risk_acceptances (status);
create index if not exists risk_acceptances_expiration_date_idx on public.risk_acceptances (expiration_date);
create index if not exists risk_acceptances_deleted_at_idx on public.risk_acceptances (deleted_at);

create or replace function public.sync_risk_acceptance_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'revoked' then
    new.revoked_at := coalesce(new.revoked_at, timezone('utc', now()));
    return new;
  end if;

  if new.expiration_date < current_date then
    new.status := 'expired';
  else
    new.status := 'active';
  end if;

  new.revoked_at := null;
  new.revoked_by_profile_id := null;

  return new;
end;
$$;

create trigger set_risk_acceptances_status
before insert or update of expiration_date, status on public.risk_acceptances
for each row
execute function public.sync_risk_acceptance_status();

create trigger set_risk_acceptances_updated_at
before update on public.risk_acceptances
for each row
execute function public.set_updated_at_timestamp();

alter table public.risk_acceptances enable row level security;

drop policy if exists "risk_acceptances_select_authenticated" on public.risk_acceptances;
create policy "risk_acceptances_select_authenticated"
  on public.risk_acceptances
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "risk_acceptances_insert_authenticated" on public.risk_acceptances;
create policy "risk_acceptances_insert_authenticated"
  on public.risk_acceptances
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  );

drop policy if exists "risk_acceptances_update_authenticated" on public.risk_acceptances;
create policy "risk_acceptances_update_authenticated"
  on public.risk_acceptances
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
      'risk_acceptance'
    )
  );
