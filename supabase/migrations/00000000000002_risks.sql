create type public.risk_status as enum ('draft', 'open', 'mitigated', 'accepted', 'closed');

create type public.risk_level as enum ('low', 'medium', 'high', 'critical');

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  title text not null,
  description text not null,
  category text not null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  impact smallint not null check (impact between 1 and 5),
  likelihood smallint not null check (likelihood between 1 and 5),
  score smallint generated always as (impact * likelihood) stored,
  level public.risk_level not null default 'low',
  status public.risk_status not null default 'draft',
  due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index risks_status_idx on public.risks (status);
create index risks_level_idx on public.risks (level);
create index risks_category_idx on public.risks (category);
create index risks_due_date_idx on public.risks (due_date);
create index risks_deleted_at_idx on public.risks (deleted_at);

create or replace function public.compute_risk_level()
returns trigger
language plpgsql
as $$
declare
  risk_score integer;
begin
  risk_score := new.impact * new.likelihood;

  if risk_score <= 4 then
    new.level := 'low';
  elseif risk_score <= 9 then
    new.level := 'medium';
  elseif risk_score <= 16 then
    new.level := 'high';
  else
    new.level := 'critical';
  end if;

  return new;
end;
$$;

create trigger set_risk_level
before insert or update of impact, likelihood on public.risks
for each row
execute function public.compute_risk_level();

create trigger set_risks_updated_at
before update on public.risks
for each row
execute function public.set_updated_at_timestamp();

alter table public.risks enable row level security;

create policy "risks_select_authenticated"
  on public.risks
  for select
  to authenticated
  using (deleted_at is null);

create policy "risks_insert_authenticated"
  on public.risks
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "risks_update_authenticated"
  on public.risks
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
