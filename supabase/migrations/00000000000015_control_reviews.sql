-- Control reviews.

do $$
begin
  create type public.control_review_status as enum ('scheduled', 'in_progress', 'completed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.control_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  control_id uuid not null references public.controls (id) on delete cascade,
  status public.control_review_status not null default 'scheduled',
  target_date date not null,
  completed_at timestamptz,
  reviewer_profile_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists control_reviews_control_id_idx on public.control_reviews (control_id);
create index if not exists control_reviews_status_idx on public.control_reviews (status);
create index if not exists control_reviews_target_date_idx on public.control_reviews (target_date);
create index if not exists control_reviews_deleted_at_idx on public.control_reviews (deleted_at);

create trigger set_control_reviews_updated_at
before update on public.control_reviews
for each row
execute function public.set_updated_at_timestamp();

alter table public.control_reviews enable row level security;

drop policy if exists "control_reviews_select_authenticated" on public.control_reviews;
create policy "control_reviews_select_authenticated"
  on public.control_reviews
  for select
  to authenticated
  using (
    deleted_at is null
    and organization_id = public.current_organization_id()
  );

drop policy if exists "control_reviews_insert_authenticated" on public.control_reviews;
create policy "control_reviews_insert_authenticated"
  on public.control_reviews
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );

drop policy if exists "control_reviews_update_authenticated" on public.control_reviews;
create policy "control_reviews_update_authenticated"
  on public.control_reviews
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
  check (entity_type in ('risk', 'control', 'action_plan', 'incident', 'control_review'));
