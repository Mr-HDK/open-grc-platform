create table public.frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  version text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.framework_requirements (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.frameworks (id) on delete cascade,
  reference_code text not null,
  title text not null,
  description text,
  domain text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (framework_id, reference_code)
);

create table public.control_framework_mappings (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.controls (id) on delete cascade,
  framework_requirement_id uuid not null references public.framework_requirements (id) on delete cascade,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (control_id, framework_requirement_id)
);

create index framework_requirements_framework_id_idx on public.framework_requirements (framework_id);
create index control_framework_mappings_control_id_idx on public.control_framework_mappings (control_id);
create index control_framework_mappings_requirement_id_idx on public.control_framework_mappings (framework_requirement_id);

alter table public.frameworks enable row level security;
alter table public.framework_requirements enable row level security;
alter table public.control_framework_mappings enable row level security;

create policy "frameworks_select_authenticated"
  on public.frameworks
  for select
  to authenticated
  using (true);

create policy "framework_requirements_select_authenticated"
  on public.framework_requirements
  for select
  to authenticated
  using (true);

create policy "control_framework_mappings_select_authenticated"
  on public.control_framework_mappings
  for select
  to authenticated
  using (true);

create policy "frameworks_insert_authenticated"
  on public.frameworks
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "framework_requirements_insert_authenticated"
  on public.framework_requirements
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "control_framework_mappings_insert_authenticated"
  on public.control_framework_mappings
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "control_framework_mappings_delete_authenticated"
  on public.control_framework_mappings
  for delete
  to authenticated
  using (auth.role() = 'authenticated');
