create type public.action_status as enum (
  'open',
  'in_progress',
  'blocked',
  'done',
  'cancelled'
);

create type public.priority as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create table public.action_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  title text not null,
  description text not null,
  risk_id uuid references public.risks (id) on delete set null,
  control_id uuid references public.controls (id) on delete set null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  status public.action_status not null default 'open',
  priority public.priority not null default 'medium',
  target_date date not null,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint action_plan_requires_link check (risk_id is not null or control_id is not null)
);

create index action_plans_status_idx on public.action_plans (status);
create index action_plans_priority_idx on public.action_plans (priority);
create index action_plans_target_date_idx on public.action_plans (target_date);
create index action_plans_risk_id_idx on public.action_plans (risk_id);
create index action_plans_control_id_idx on public.action_plans (control_id);
create index action_plans_deleted_at_idx on public.action_plans (deleted_at);

create trigger set_action_plans_updated_at
before update on public.action_plans
for each row
execute function public.set_updated_at_timestamp();

alter table public.action_plans enable row level security;

create policy "action_plans_select_authenticated"
  on public.action_plans
  for select
  to authenticated
  using (deleted_at is null);

create policy "action_plans_insert_authenticated"
  on public.action_plans
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "action_plans_update_authenticated"
  on public.action_plans
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
