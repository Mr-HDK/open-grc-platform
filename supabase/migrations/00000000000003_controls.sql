create type public.control_effectiveness_status as enum (
  'not_tested',
  'effective',
  'partially_effective',
  'ineffective'
);

create type public.control_review_frequency as enum (
  'weekly',
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'on_demand'
);

create table public.controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  code text not null unique,
  title text not null,
  description text not null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  control_type text not null,
  review_frequency public.control_review_frequency not null default 'quarterly',
  effectiveness_status public.control_effectiveness_status not null default 'not_tested',
  next_review_date date,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index controls_code_idx on public.controls (code);
create index controls_effectiveness_status_idx on public.controls (effectiveness_status);
create index controls_review_frequency_idx on public.controls (review_frequency);
create index controls_deleted_at_idx on public.controls (deleted_at);

create trigger set_controls_updated_at
before update on public.controls
for each row
execute function public.set_updated_at_timestamp();

create table public.risk_controls (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references public.risks (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  rationale text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (risk_id, control_id)
);

create index risk_controls_risk_id_idx on public.risk_controls (risk_id);
create index risk_controls_control_id_idx on public.risk_controls (control_id);

alter table public.controls enable row level security;
alter table public.risk_controls enable row level security;

create policy "controls_select_authenticated"
  on public.controls
  for select
  to authenticated
  using (deleted_at is null);

create policy "controls_insert_authenticated"
  on public.controls
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "controls_update_authenticated"
  on public.controls
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "risk_controls_select_authenticated"
  on public.risk_controls
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "risk_controls_insert_authenticated"
  on public.risk_controls
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "risk_controls_delete_authenticated"
  on public.risk_controls
  for delete
  to authenticated
  using (auth.role() = 'authenticated');
