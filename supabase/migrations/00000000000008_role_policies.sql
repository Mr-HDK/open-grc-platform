-- Harden RLS policies with application role checks from public.profiles.

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'viewer'::public.app_role
  );
$$;

create or replace function public.has_min_role(required public.app_role)
returns boolean
language sql
stable
as $$
  select case required
    when 'viewer'::public.app_role then true
    when 'contributor'::public.app_role then public.current_user_role() in (
      'contributor'::public.app_role,
      'manager'::public.app_role,
      'admin'::public.app_role
    )
    when 'manager'::public.app_role then public.current_user_role() in (
      'manager'::public.app_role,
      'admin'::public.app_role
    )
    when 'admin'::public.app_role then public.current_user_role() = 'admin'::public.app_role
  end;
$$;

drop policy if exists "risks_insert_authenticated" on public.risks;
drop policy if exists "risks_update_authenticated" on public.risks;
create policy "risks_insert_authenticated"
  on public.risks
  for insert
  to authenticated
  with check (public.has_min_role('contributor'::public.app_role));
create policy "risks_update_authenticated"
  on public.risks
  for update
  to authenticated
  using (public.has_min_role('contributor'::public.app_role))
  with check (public.has_min_role('contributor'::public.app_role));

drop policy if exists "controls_insert_authenticated" on public.controls;
drop policy if exists "controls_update_authenticated" on public.controls;
create policy "controls_insert_authenticated"
  on public.controls
  for insert
  to authenticated
  with check (public.has_min_role('contributor'::public.app_role));
create policy "controls_update_authenticated"
  on public.controls
  for update
  to authenticated
  using (public.has_min_role('contributor'::public.app_role))
  with check (public.has_min_role('contributor'::public.app_role));

drop policy if exists "risk_controls_insert_authenticated" on public.risk_controls;
drop policy if exists "risk_controls_delete_authenticated" on public.risk_controls;
create policy "risk_controls_insert_authenticated"
  on public.risk_controls
  for insert
  to authenticated
  with check (public.has_min_role('contributor'::public.app_role));
create policy "risk_controls_delete_authenticated"
  on public.risk_controls
  for delete
  to authenticated
  using (public.has_min_role('contributor'::public.app_role));

drop policy if exists "action_plans_insert_authenticated" on public.action_plans;
drop policy if exists "action_plans_update_authenticated" on public.action_plans;
create policy "action_plans_insert_authenticated"
  on public.action_plans
  for insert
  to authenticated
  with check (public.has_min_role('contributor'::public.app_role));
create policy "action_plans_update_authenticated"
  on public.action_plans
  for update
  to authenticated
  using (public.has_min_role('contributor'::public.app_role))
  with check (public.has_min_role('contributor'::public.app_role));

drop policy if exists "evidence_insert_authenticated" on public.evidence;
drop policy if exists "evidence_update_authenticated" on public.evidence;
create policy "evidence_insert_authenticated"
  on public.evidence
  for insert
  to authenticated
  with check (public.has_min_role('contributor'::public.app_role));
create policy "evidence_update_authenticated"
  on public.evidence
  for update
  to authenticated
  using (archived_at is null and public.has_min_role('manager'::public.app_role))
  with check (public.has_min_role('manager'::public.app_role));

drop policy if exists "frameworks_insert_authenticated" on public.frameworks;
drop policy if exists "framework_requirements_insert_authenticated" on public.framework_requirements;
drop policy if exists "control_framework_mappings_insert_authenticated" on public.control_framework_mappings;
drop policy if exists "control_framework_mappings_delete_authenticated" on public.control_framework_mappings;
create policy "frameworks_insert_authenticated"
  on public.frameworks
  for insert
  to authenticated
  with check (public.has_min_role('admin'::public.app_role));
create policy "framework_requirements_insert_authenticated"
  on public.framework_requirements
  for insert
  to authenticated
  with check (public.has_min_role('admin'::public.app_role));
create policy "control_framework_mappings_insert_authenticated"
  on public.control_framework_mappings
  for insert
  to authenticated
  with check (public.has_min_role('admin'::public.app_role));
create policy "control_framework_mappings_delete_authenticated"
  on public.control_framework_mappings
  for delete
  to authenticated
  using (public.has_min_role('admin'::public.app_role));

drop policy if exists "audit_log_insert_authenticated" on public.audit_log;
create policy "audit_log_insert_authenticated"
  on public.audit_log
  for insert
  to authenticated
  with check (public.has_min_role('contributor'::public.app_role));

drop policy if exists "evidence_objects_insert_authenticated" on storage.objects;
drop policy if exists "evidence_objects_delete_authenticated" on storage.objects;
create policy "evidence_objects_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.has_min_role('contributor'::public.app_role)
  );
create policy "evidence_objects_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_min_role('contributor'::public.app_role)
  );
