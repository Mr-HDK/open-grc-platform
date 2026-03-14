-- Scheduler-backed reminder queue for overdue and upcoming items.

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reminder_type text not null
    check (reminder_type in ('overdue_action', 'control_review_due', 'risk_acceptance_expiring')),
  entity_type text not null
    check (entity_type in ('action_plan', 'control', 'risk_acceptance')),
  entity_id uuid not null,
  title text not null,
  message text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default timezone('utc', now()),
  last_detected_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, reminder_type, entity_id)
);

create index if not exists notification_events_org_idx
  on public.notification_events (organization_id);
create index if not exists notification_events_type_idx
  on public.notification_events (reminder_type);
create index if not exists notification_events_due_date_idx
  on public.notification_events (due_date);
create index if not exists notification_events_severity_idx
  on public.notification_events (severity);
create index if not exists notification_events_resolved_at_idx
  on public.notification_events (resolved_at);

create trigger set_notification_events_updated_at
before update on public.notification_events
for each row
execute function public.set_updated_at_timestamp();

alter table public.notification_events enable row level security;

drop policy if exists "notification_events_select_authenticated" on public.notification_events;
create policy "notification_events_select_authenticated"
  on public.notification_events
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

create or replace function public.sync_notification_events(target_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_today date := (timezone('utc', now()))::date;
  v_control_horizon date := v_today + 30;
  v_acceptance_horizon date := v_today + 14;
  v_upserted integer := 0;
  v_resolved integer := 0;
begin
  create temporary table if not exists notification_event_candidates (
    organization_id uuid not null,
    reminder_type text not null,
    entity_type text not null,
    entity_id uuid not null,
    title text not null,
    message text not null,
    severity text not null,
    due_date date,
    metadata jsonb not null
  ) on commit drop;

  truncate notification_event_candidates;

  insert into notification_event_candidates (
    organization_id,
    reminder_type,
    entity_type,
    entity_id,
    title,
    message,
    severity,
    due_date,
    metadata
  )
  select
    action_plans.organization_id,
    'overdue_action',
    'action_plan',
    action_plans.id,
    action_plans.title,
    'Action overdue since ' || action_plans.target_date::text,
    case
      when action_plans.priority in ('critical', 'high') then 'critical'
      else 'warning'
    end,
    action_plans.target_date,
    jsonb_build_object(
      'priority', action_plans.priority,
      'status', action_plans.status,
      'path', '/dashboard/actions/' || action_plans.id::text
    )
  from public.action_plans
  where action_plans.deleted_at is null
    and action_plans.status not in ('done', 'cancelled')
    and action_plans.target_date < v_today
    and (target_organization_id is null or action_plans.organization_id = target_organization_id);

  insert into notification_event_candidates (
    organization_id,
    reminder_type,
    entity_type,
    entity_id,
    title,
    message,
    severity,
    due_date,
    metadata
  )
  select
    controls.organization_id,
    'control_review_due',
    'control',
    controls.id,
    controls.code || ' - ' || controls.title,
    case
      when controls.next_review_date < v_today
        then 'Control review overdue since ' || controls.next_review_date::text
      else 'Control review due on ' || controls.next_review_date::text
    end,
    case
      when controls.next_review_date < v_today then 'critical'
      else 'warning'
    end,
    controls.next_review_date,
    jsonb_build_object(
      'effectiveness_status', controls.effectiveness_status,
      'path', '/dashboard/controls/' || controls.id::text
    )
  from public.controls
  where controls.deleted_at is null
    and controls.next_review_date is not null
    and controls.next_review_date <= v_control_horizon
    and (target_organization_id is null or controls.organization_id = target_organization_id);

  insert into notification_event_candidates (
    organization_id,
    reminder_type,
    entity_type,
    entity_id,
    title,
    message,
    severity,
    due_date,
    metadata
  )
  select
    risk_acceptances.organization_id,
    'risk_acceptance_expiring',
    'risk_acceptance',
    risk_acceptances.id,
    coalesce(risks.title, 'Risk acceptance'),
    case
      when risk_acceptances.expiration_date < v_today
        then 'Risk acceptance expired on ' || risk_acceptances.expiration_date::text
      else 'Risk acceptance expires on ' || risk_acceptances.expiration_date::text
    end,
    case
      when risk_acceptances.expiration_date < v_today then 'critical'
      else 'warning'
    end,
    risk_acceptances.expiration_date,
    jsonb_build_object(
      'status', risk_acceptances.status,
      'risk_id', risk_acceptances.risk_id,
      'path', '/dashboard/risk-acceptances/' || risk_acceptances.id::text
    )
  from public.risk_acceptances
  left join public.risks on risks.id = risk_acceptances.risk_id
  where risk_acceptances.deleted_at is null
    and risk_acceptances.status in ('active', 'expired')
    and risk_acceptances.expiration_date <= v_acceptance_horizon
    and (target_organization_id is null or risk_acceptances.organization_id = target_organization_id);

  insert into public.notification_events (
    organization_id,
    reminder_type,
    entity_type,
    entity_id,
    title,
    message,
    severity,
    due_date,
    metadata,
    last_detected_at,
    resolved_at
  )
  select
    candidates.organization_id,
    candidates.reminder_type,
    candidates.entity_type,
    candidates.entity_id,
    candidates.title,
    candidates.message,
    candidates.severity,
    candidates.due_date,
    candidates.metadata,
    v_now,
    null
  from notification_event_candidates candidates
  on conflict (organization_id, reminder_type, entity_id) do update
    set entity_type = excluded.entity_type,
        title = excluded.title,
        message = excluded.message,
        severity = excluded.severity,
        due_date = excluded.due_date,
        metadata = excluded.metadata,
        last_detected_at = excluded.last_detected_at,
        resolved_at = null;

  get diagnostics v_upserted = row_count;

  update public.notification_events
  set resolved_at = v_now
  where resolved_at is null
    and (target_organization_id is null or organization_id = target_organization_id)
    and not exists (
      select 1
      from notification_event_candidates candidates
      where candidates.organization_id = notification_events.organization_id
        and candidates.reminder_type = notification_events.reminder_type
        and candidates.entity_id = notification_events.entity_id
    );

  get diagnostics v_resolved = row_count;

  return jsonb_build_object(
    'upserted', v_upserted,
    'resolved', v_resolved,
    'active', (
      select count(*)
      from public.notification_events
      where resolved_at is null
        and (target_organization_id is null or organization_id = target_organization_id)
    )
  );
end;
$$;

revoke all on function public.sync_notification_events(uuid) from public;
grant execute on function public.sync_notification_events(uuid) to service_role;
