-- Treat non-active profiles as unauthorised in RLS helper functions.

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.profiles
      where id = auth.uid()
        and status = 'active'::public.profile_status
    ),
    'viewer'::public.app_role
  );
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
    and status = 'active'::public.profile_status;
$$;
