-- Admin lifecycle: profile status and organization ownership.

do $$
begin
  create type public.profile_status as enum ('active', 'invited', 'deactivated');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists status public.profile_status not null default 'active',
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid references public.profiles (id) on delete set null,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references public.profiles (id) on delete set null;

alter table public.organizations
  add column if not exists owner_profile_id uuid references public.profiles (id) on delete set null;

update public.profiles
set status = 'active'
where status is null;

update public.organizations o
set owner_profile_id = coalesce(
  (
    select p.id
    from public.profiles p
    where p.organization_id = o.id
      and p.role = 'admin'::public.app_role
    order by p.created_at
    limit 1
  ),
  (
    select p.id
    from public.profiles p
    where p.organization_id = o.id
    order by p.created_at
    limit 1
  )
)
where owner_profile_id is null;

create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists organizations_owner_profile_id_idx on public.organizations (owner_profile_id);
