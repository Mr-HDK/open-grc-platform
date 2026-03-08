create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  title text not null,
  description text,
  risk_id uuid references public.risks (id) on delete set null,
  control_id uuid references public.controls (id) on delete set null,
  action_plan_id uuid references public.action_plans (id) on delete set null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint evidence_requires_link check (
    risk_id is not null or control_id is not null or action_plan_id is not null
  )
);

create index evidence_risk_id_idx on public.evidence (risk_id);
create index evidence_control_id_idx on public.evidence (control_id);
create index evidence_action_plan_id_idx on public.evidence (action_plan_id);
create index evidence_archived_at_idx on public.evidence (archived_at);
create index evidence_created_at_idx on public.evidence (created_at);

alter table public.evidence enable row level security;

create policy "evidence_select_authenticated"
  on public.evidence
  for select
  to authenticated
  using (archived_at is null);

create policy "evidence_insert_authenticated"
  on public.evidence
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "evidence_update_authenticated"
  on public.evidence
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 26214400)
on conflict (id) do nothing;

create policy "evidence_objects_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'evidence');

create policy "evidence_objects_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'evidence');

create policy "evidence_objects_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'evidence');
