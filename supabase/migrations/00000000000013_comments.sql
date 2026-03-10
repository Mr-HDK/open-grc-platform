-- Lightweight collaboration comments.

do $$
begin
  create type public.comment_entity as enum ('risk', 'control', 'action_plan');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.resolve_organization_id(),
  entity_type public.comment_entity not null,
  entity_id uuid not null,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists comments_entity_idx on public.comments (entity_type, entity_id, created_at desc);
create index if not exists comments_org_idx on public.comments (organization_id);

alter table public.comments enable row level security;

drop policy if exists "comments_select_org" on public.comments;
create policy "comments_select_org"
  on public.comments
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists "comments_insert_org" on public.comments;
create policy "comments_insert_org"
  on public.comments
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_min_role('contributor'::public.app_role)
  );
