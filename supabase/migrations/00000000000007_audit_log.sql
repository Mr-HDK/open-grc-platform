create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  entity_type text not null check (entity_type in ('risk', 'control', 'action_plan')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'soft_delete')),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  change_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_log_entity_lookup_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_profile_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_authenticated"
  on public.audit_log
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "audit_log_insert_authenticated"
  on public.audit_log
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');
