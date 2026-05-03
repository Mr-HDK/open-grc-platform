-- Saved reporting views for management and committee packs.

create table if not exists public.reporting_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  name text not null,
  preset text not null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  horizon_days integer not null default 30,
  issue_type text,
  severity text,
  status_focus text not null default 'all',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint reporting_saved_views_name_check check (char_length(trim(name)) >= 3),
  constraint reporting_saved_views_preset_check check (
    preset in ('management', 'audit_committee', 'compliance')
  ),
  constraint reporting_saved_views_horizon_days_check check (
    horizon_days in (30, 60, 90, 180)
  ),
  constraint reporting_saved_views_issue_type_check check (
    issue_type is null
    or issue_type in (
      'audit_finding',
      'control_failure',
      'policy_exception',
      'vendor_issue',
      'risk_exception',
      'incident_follow_up'
    )
  ),
  constraint reporting_saved_views_severity_check check (
    severity is null
    or severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint reporting_saved_views_status_focus_check check (
    status_focus in ('all', 'attention_required', 'overdue', 'resolved')
  )
);

create index if not exists reporting_saved_views_org_idx
  on public.reporting_saved_views (organization_id);
create index if not exists reporting_saved_views_created_by_idx
  on public.reporting_saved_views (created_by);
create index if not exists reporting_saved_views_deleted_at_idx
  on public.reporting_saved_views (deleted_at);

drop trigger if exists set_reporting_saved_views_updated_at on public.reporting_saved_views;
create trigger set_reporting_saved_views_updated_at
before update on public.reporting_saved_views
for each row
execute function public.set_updated_at_timestamp();

alter table public.reporting_saved_views enable row level security;

drop policy if exists "reporting_saved_views_select_authenticated" on public.reporting_saved_views;
create policy "reporting_saved_views_select_authenticated"
  on public.reporting_saved_views
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "reporting_saved_views_insert_authenticated" on public.reporting_saved_views;
create policy "reporting_saved_views_insert_authenticated"
  on public.reporting_saved_views
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles profiles
        where profiles.id = reporting_saved_views.owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
  );

drop policy if exists "reporting_saved_views_update_authenticated" on public.reporting_saved_views;
create policy "reporting_saved_views_update_authenticated"
  on public.reporting_saved_views
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('manager'::public.app_role)
    and (
      owner_profile_id is null
      or exists (
        select 1
        from public.profiles profiles
        where profiles.id = reporting_saved_views.owner_profile_id
          and profiles.organization_id = public.current_organization_id()
      )
    )
  );
