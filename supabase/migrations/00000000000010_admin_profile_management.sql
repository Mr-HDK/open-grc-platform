-- Allow in-organization admin profile management and prevent self-escalation.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.id and not public.has_min_role('admin'::public.app_role) then
    new.role := old.role;
    new.organization_id := old.organization_id;
    new.email := old.email;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
create trigger prevent_profile_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_escalation();

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_self_or_org_admin" on public.profiles;
create policy "profiles_select_self_or_org_admin"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or (
      public.has_min_role('admin'::public.app_role)
      and organization_id = public.current_organization_id()
    )
  );

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_org_admin" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_org_admin"
  on public.profiles
  for update
  to authenticated
  using (
    public.has_min_role('admin'::public.app_role)
    and organization_id = public.current_organization_id()
  )
  with check (
    public.has_min_role('admin'::public.app_role)
    and organization_id = public.current_organization_id()
  );
