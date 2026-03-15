-- Bootstrap profile rows for existing auth users.
-- Run after creating test users in Supabase Auth.

insert into public.profiles (id, email, full_name, role)
select
  au.id,
  coalesce(au.email, au.id::text || '@local.test') as email,
  coalesce(
    au.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(au.email, ''), '@', 1)
  ) as full_name,
  case
    when lower(coalesce(au.email, '')) = 'admin@open-grc.local' then 'admin'::public.app_role
    when lower(coalesce(au.email, '')) = 'manager@open-grc.local' then 'manager'::public.app_role
    when lower(coalesce(au.email, '')) = 'contributor@open-grc.local' then 'contributor'::public.app_role
    else 'viewer'::public.app_role
  end as role
from auth.users au
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  updated_at = timezone('utc', now());

with seed_rows(title, description, category, impact, likelihood, status, due_date) as (
  values
    ('Cloud data exposure in shared buckets', 'Public ACLs can expose customer data if storage permissions are misconfigured.', 'Data Security', 5, 4, 'open'::public.risk_status, current_date + 21),
    ('Single approver vendor onboarding', 'Vendor onboarding can be approved by one user, creating segregation-of-duties risk.', 'Third Party', 4, 3, 'open'::public.risk_status, current_date + 30),
    ('No MFA for legacy VPN users', 'Legacy VPN group still allows password-only login for a subset of accounts.', 'Identity', 5, 3, 'mitigated'::public.risk_status, current_date + 14),
    ('Incomplete endpoint encryption', 'A subset of managed laptops does not enforce full disk encryption policy.', 'Endpoint', 4, 2, 'open'::public.risk_status, current_date + 45),
    ('Delayed vulnerability patching', 'Critical patches are not applied consistently within the internal SLA window.', 'Vulnerability', 4, 4, 'open'::public.risk_status, current_date + 10),
    ('Excessive privileged access', 'Privileged group membership review is manual and inconsistent.', 'Access Control', 4, 3, 'draft'::public.risk_status, current_date + 35),
    ('Backup restore process untested', 'Disaster recovery backup restoration is not regularly validated.', 'Resilience', 5, 2, 'open'::public.risk_status, current_date + 60),
    ('Untracked production changes', 'Emergency changes are occasionally deployed without complete ticket linkage.', 'Change Management', 3, 4, 'accepted'::public.risk_status, current_date + 50),
    ('Insufficient log retention', 'Security logs are retained for fewer days than policy requires.', 'Monitoring', 3, 3, 'mitigated'::public.risk_status, current_date + 40),
    ('No formal key rotation cadence', 'Encryption key rotation exists but has no enforced schedule.', 'Cryptography', 3, 2, 'draft'::public.risk_status, current_date + 90),
    ('Business continuity plan stale', 'Continuity documentation has not been updated after infrastructure changes.', 'Governance', 3, 3, 'open'::public.risk_status, current_date + 75),
    ('Legacy unsupported runtime', 'One internal service still uses an unsupported runtime version.', 'Application Security', 4, 4, 'closed'::public.risk_status, current_date + 15)
),
owner as (
  select id from public.profiles order by created_at limit 1
)
insert into public.risks (
  title,
  description,
  category,
  owner_profile_id,
  impact,
  likelihood,
  status,
  due_date,
  created_by,
  updated_by
)
select
  seed_rows.title,
  seed_rows.description,
  seed_rows.category,
  owner.id,
  seed_rows.impact,
  seed_rows.likelihood,
  seed_rows.status,
  seed_rows.due_date,
  owner.id,
  owner.id
from seed_rows
left join owner on true
where not exists (select 1 from public.risks);

with owner as (
  select id from public.profiles order by created_at limit 1
),
control_rows (code, title, description, control_type, review_frequency, effectiveness_status, next_review_date) as (
  values
    ('IAM-001', 'Enforce MFA for privileged users', 'Require MFA for all privileged and administrator accounts.', 'Preventive', 'monthly'::public.control_review_frequency, 'effective'::public.control_effectiveness_status, current_date + 30),
    ('VULN-002', 'Monthly vulnerability remediation review', 'Track SLA compliance for remediation of critical and high vulnerabilities.', 'Detective', 'monthly'::public.control_review_frequency, 'partially_effective'::public.control_effectiveness_status, current_date + 20),
    ('BCP-003', 'Disaster recovery restore test', 'Execute and document periodic backup restore tests for critical systems.', 'Corrective', 'quarterly'::public.control_review_frequency, 'not_tested'::public.control_effectiveness_status, current_date + 45),
    ('LOG-004', 'Centralized security log retention', 'Retain security logs in centralized storage according to policy baseline.', 'Preventive', 'quarterly'::public.control_review_frequency, 'effective'::public.control_effectiveness_status, current_date + 35),
    ('CHG-005', 'Emergency change post-implementation review', 'Review emergency production changes for approval and evidence completeness.', 'Detective', 'weekly'::public.control_review_frequency, 'ineffective'::public.control_effectiveness_status, current_date + 7),
    ('THIRD-006', 'Vendor onboarding segregation of duties', 'Require dual approval for vendor onboarding and risk acceptance.', 'Preventive', 'monthly'::public.control_review_frequency, 'partially_effective'::public.control_effectiveness_status, current_date + 25)
)
insert into public.controls (
  code,
  title,
  description,
  owner_profile_id,
  control_type,
  review_frequency,
  effectiveness_status,
  next_review_date,
  created_by,
  updated_by
)
select
  control_rows.code,
  control_rows.title,
  control_rows.description,
  owner.id,
  control_rows.control_type,
  control_rows.review_frequency,
  control_rows.effectiveness_status,
  control_rows.next_review_date,
  owner.id,
  owner.id
from control_rows
left join owner on true
where not exists (select 1 from public.controls);

with mapping_rows (control_code, risk_title, rationale) as (
  values
    ('IAM-001', 'No MFA for legacy VPN users', 'MFA policy directly mitigates password-only authentication exposure.'),
    ('VULN-002', 'Delayed vulnerability patching', 'Monthly review validates SLA exceptions and remediation backlog.'),
    ('BCP-003', 'Backup restore process untested', 'Restoration exercises validate recoverability and improve resilience.'),
    ('LOG-004', 'Insufficient log retention', 'Central retention addresses evidence gaps for monitoring and forensics.'),
    ('CHG-005', 'Untracked production changes', 'Post-change review enforces ticket traceability and accountability.'),
    ('THIRD-006', 'Single approver vendor onboarding', 'Dual approval mitigates segregation-of-duties risk for third parties.'),
    ('THIRD-006', 'Excessive privileged access', 'Vendor onboarding checks include privileged access approvals.'),
    ('IAM-001', 'Excessive privileged access', 'MFA requirement reduces exposure from privileged account compromise.')
)
insert into public.risk_controls (risk_id, control_id, rationale)
select
  risks.id,
  controls.id,
  mapping_rows.rationale
from mapping_rows
join public.controls controls on controls.code = mapping_rows.control_code
join public.risks risks on risks.title = mapping_rows.risk_title
where not exists (select 1 from public.risk_controls);

with owner as (
  select id from public.profiles order by created_at limit 1
),
refs as (
  select
    (select id from public.risks where title = 'Delayed vulnerability patching' limit 1) as risk_vuln,
    (select id from public.risks where title = 'No MFA for legacy VPN users' limit 1) as risk_mfa,
    (select id from public.risks where title = 'Backup restore process untested' limit 1) as risk_bcp,
    (select id from public.controls where code = 'VULN-002' limit 1) as control_vuln,
    (select id from public.controls where code = 'IAM-001' limit 1) as control_mfa,
    (select id from public.controls where code = 'BCP-003' limit 1) as control_bcp
)
insert into public.action_plans (
  title,
  description,
  risk_id,
  control_id,
  owner_profile_id,
  status,
  priority,
  target_date,
  created_by,
  updated_by,
  completed_at
)
select *
from (
  select
    'Patch critical CVEs on internet-facing assets'::text,
    'Remediate all critical internet-facing CVEs and attach evidence for closure.'::text,
    refs.risk_vuln,
    refs.control_vuln,
    owner.id,
    'in_progress'::public.action_status,
    'critical'::public.priority,
    current_date + 10,
    owner.id,
    owner.id,
    null::timestamptz
  from owner, refs

  union all

  select
    'Enforce MFA on remaining legacy VPN accounts',
    'Migrate remaining users to MFA-enabled VPN policies and revoke legacy exceptions.',
    refs.risk_mfa,
    refs.control_mfa,
    owner.id,
    'open'::public.action_status,
    'high'::public.priority,
    current_date + 14,
    owner.id,
    owner.id,
    null::timestamptz
  from owner, refs

  union all

  select
    'Run DR restore drill for tier-1 systems',
    'Execute quarterly restore drill and document recovery timings and gaps.',
    refs.risk_bcp,
    refs.control_bcp,
    owner.id,
    'blocked'::public.action_status,
    'high'::public.priority,
    current_date - 2,
    owner.id,
    owner.id,
    null::timestamptz
  from owner, refs

  union all

  select
    'Close historical change tickets evidence gap',
    'Backfill missing links between emergency deployments and approval records.',
    (select id from public.risks where title = 'Untracked production changes' limit 1),
    (select id from public.controls where code = 'CHG-005' limit 1),
    owner.id,
    'done'::public.action_status,
    'medium'::public.priority,
    current_date - 12,
    owner.id,
    owner.id,
    timezone('utc', now()) - interval '3 day'
  from owner

  union all

  select
    'Review vendor onboarding SoD exceptions',
    'Review and close unresolved segregation-of-duties exceptions in onboarding flow.',
    (select id from public.risks where title = 'Single approver vendor onboarding' limit 1),
    (select id from public.controls where code = 'THIRD-006' limit 1),
    owner.id,
    'open'::public.action_status,
    'medium'::public.priority,
    current_date + 18,
    owner.id,
    owner.id,
    null::timestamptz
  from owner
) seeded
where not exists (select 1 from public.action_plans);

with owner as (
  select id from public.profiles order by created_at limit 1
),
refs as (
  select
    (select id from public.risks where title = 'Delayed vulnerability patching' limit 1) as risk_id,
    (select id from public.controls where code = 'VULN-002' limit 1) as control_id,
    (select id from public.action_plans where title = 'Patch critical CVEs on internet-facing assets' limit 1) as action_plan_id
)
insert into public.evidence (
  file_name,
  file_path,
  mime_type,
  file_size,
  title,
  description,
  risk_id,
  control_id,
  action_plan_id,
  uploaded_by
)
select
  'vuln-report-q1.pdf',
  'seed/vuln-report-q1.pdf',
  'application/pdf',
  120000,
  'Quarterly vulnerability report',
  'Sample seeded metadata for vulnerability review evidence.',
  refs.risk_id,
  refs.control_id,
  refs.action_plan_id,
  owner.id
from owner, refs
where not exists (select 1 from public.evidence);

insert into public.frameworks (code, name, version)
values
  ('COBIT', 'COBIT', '2019'),
  ('ISO27001', 'ISO/IEC 27001', '2022'),
  ('NIST-CSF', 'NIST Cybersecurity Framework', '2.0'),
  ('NIS2', 'NIS2 Directive', '2022')
on conflict (code) do update
set
  name = excluded.name,
  version = excluded.version;

with requirement_rows(framework_code, reference_code, title, description, domain) as (
  values
    ('COBIT', 'EDM03', 'Ensure Risk Optimisation', 'Govern enterprise risk management and treatment.', 'Governance'),
    ('COBIT', 'APO12', 'Manage Risk', 'Identify, assess and maintain risk responses.', 'Risk Management'),
    ('ISO27001', 'A.5.15', 'Access control', 'Implement policy and controls for access rights management.', 'Access Control'),
    ('ISO27001', 'A.8.8', 'Management of technical vulnerabilities', 'Obtain and evaluate vulnerability information and remediate.', 'Vulnerability Management'),
    ('NIST-CSF', 'GV.RM-01', 'Risk management objectives established', 'Define and approve risk objectives and tolerances.', 'Govern'),
    ('NIST-CSF', 'DE.CM-01', 'Networks and services monitored', 'Monitor networks and services to detect anomalies.', 'Detect'),
    ('NIS2', 'Art21(2)(d)', 'Security in network and information systems acquisition', 'Address security in lifecycle and development practices.', 'Security Engineering'),
    ('NIS2', 'Art21(2)(f)', 'Policies and procedures for effectiveness of risk-management measures', 'Measure and improve cybersecurity risk treatment controls.', 'Risk Management')
)
insert into public.framework_requirements (framework_id, reference_code, title, description, domain)
select
  frameworks.id,
  requirement_rows.reference_code,
  requirement_rows.title,
  requirement_rows.description,
  requirement_rows.domain
from requirement_rows
join public.frameworks frameworks on frameworks.code = requirement_rows.framework_code
on conflict (framework_id, reference_code) do update
set
  title = excluded.title,
  description = excluded.description,
  domain = excluded.domain;

with mapping_rows(control_code, framework_code, reference_code, notes) as (
  values
    ('IAM-001', 'ISO27001', 'A.5.15', 'MFA enforcement supports strong access control.'),
    ('IAM-001', 'NIS2', 'Art21(2)(d)', 'Access hardening is part of secure system operations.'),
    ('VULN-002', 'ISO27001', 'A.8.8', 'Vulnerability review cycle maps to technical vulnerability management.'),
    ('VULN-002', 'NIST-CSF', 'DE.CM-01', 'Regular scanning and monitoring support detection outcomes.'),
    ('THIRD-006', 'COBIT', 'APO12', 'Vendor onboarding controls contribute to risk treatment governance.'),
    ('CHG-005', 'COBIT', 'EDM03', 'Change governance supports enterprise risk optimization.'),
    ('BCP-003', 'NIST-CSF', 'GV.RM-01', 'Recovery testing supports declared risk objectives and continuity.'),
    ('THIRD-006', 'NIS2', 'Art21(2)(f)', 'Control effectiveness reviews support risk management policy maturity.')
)
insert into public.control_framework_mappings (control_id, framework_requirement_id, notes)
select
  controls.id,
  requirements.id,
  mapping_rows.notes
from mapping_rows
join public.controls controls on controls.code = mapping_rows.control_code
join public.frameworks frameworks on frameworks.code = mapping_rows.framework_code
join public.framework_requirements requirements
  on requirements.framework_id = frameworks.id
 and requirements.reference_code = mapping_rows.reference_code
on conflict (control_id, framework_requirement_id) do update
set
  notes = excluded.notes;

with owner as (
  select id from public.profiles order by created_at limit 1
),
entity_rows (name, entity_type, status, parent_name, description) as (
  values
    ('Corporate IT', 'business_unit'::public.auditable_entity_type, 'active'::public.auditable_entity_status, null::text, 'Seeded top-level business unit for core technology governance.'),
    ('Identity & Access Management', 'process'::public.auditable_entity_type, 'active'::public.auditable_entity_status, 'Corporate IT', 'Seeded IAM process to scope access, MFA, and privileged account controls.'),
    ('VPN Access Platform', 'application'::public.auditable_entity_type, 'active'::public.auditable_entity_status, 'Identity & Access Management', 'Seeded application entity used by access-related risks and controls.'),
    ('Vendor Onboarding Oversight', 'vendor'::public.auditable_entity_type, 'active'::public.auditable_entity_status, 'Corporate IT', 'Seeded vendor oversight scope for third-party onboarding reviews.')
)
insert into public.auditable_entities (
  name,
  entity_type,
  status,
  owner_profile_id,
  parent_entity_id,
  description,
  created_by,
  updated_by
)
select
  entity_rows.name,
  entity_rows.entity_type,
  entity_rows.status,
  owner.id,
  parent_entity.id,
  entity_rows.description,
  owner.id,
  owner.id
from entity_rows
left join owner on true
left join public.auditable_entities parent_entity on parent_entity.name = entity_rows.parent_name
where not exists (
  select 1
  from public.auditable_entities existing
  where existing.name = entity_rows.name
);

with link_rows (entity_name, risk_title) as (
  values
    ('Identity & Access Management', 'No MFA for legacy VPN users'),
    ('VPN Access Platform', 'No MFA for legacy VPN users'),
    ('Vendor Onboarding Oversight', 'Single approver vendor onboarding')
)
insert into public.auditable_entity_risks (auditable_entity_id, risk_id)
select
  entities.id,
  risks.id
from link_rows
join public.auditable_entities entities on entities.name = link_rows.entity_name
join public.risks risks on risks.title = link_rows.risk_title
on conflict (auditable_entity_id, risk_id) do nothing;

with link_rows (entity_name, control_code) as (
  values
    ('Identity & Access Management', 'IAM-001'),
    ('VPN Access Platform', 'IAM-001'),
    ('Vendor Onboarding Oversight', 'THIRD-006')
)
insert into public.auditable_entity_controls (auditable_entity_id, control_id)
select
  entities.id,
  controls.id
from link_rows
join public.auditable_entities entities on entities.name = link_rows.entity_name
join public.controls controls on controls.code = link_rows.control_code
on conflict (auditable_entity_id, control_id) do nothing;

with owner_candidates as (
  select id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, 3 as priority
  from public.profiles
),
owner as (
  select id
  from owner_candidates
  order by priority
  limit 1
),
refs as (
  select
    owner.id as owner_id,
    (select id from public.controls where code = 'IAM-001' limit 1) as control_id
  from owner
)
insert into public.findings (
  control_id,
  title,
  description,
  status,
  severity,
  root_cause,
  remediation_plan,
  due_date,
  owner_profile_id,
  created_by,
  updated_by
)
select
  refs.control_id,
  'Seed finding - Legacy VPN MFA exceptions remain active',
  'Legacy VPN access still includes active MFA exceptions that need formal remediation and closure evidence.',
  'open'::public.finding_status,
  'high'::public.finding_severity,
  'Exception handling is tracked manually and lacks a single closure workflow.',
  'Remove remaining legacy exceptions and attach approval plus enrollment evidence.',
  current_date + 21,
  refs.owner_id,
  refs.owner_id,
  refs.owner_id
from refs
where refs.control_id is not null
  and not exists (
    select 1
    from public.findings
    where title = 'Seed finding - Legacy VPN MFA exceptions remain active'
  );

with owner_candidates as (
  select id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, 3 as priority
  from public.profiles
),
owner as (
  select id
  from owner_candidates
  order by priority
  limit 1
),
period_seed as (
  select extract(year from current_date)::integer as plan_year
),
refs as (
  select
    owner.id as owner_id,
    period_seed.plan_year,
    format('FY %s Internal Audit Plan', period_seed.plan_year) as plan_title
  from owner
  cross join period_seed
)
insert into public.audit_plans (
  title,
  plan_year,
  cycle,
  status,
  owner_profile_id,
  summary,
  created_by,
  updated_by
)
select
  refs.plan_title,
  refs.plan_year,
  'annual'::public.audit_plan_cycle,
  'approved'::public.audit_plan_status,
  refs.owner_id,
  'Seeded internal audit plan for access and third-party governance follow-up.',
  refs.owner_id,
  refs.owner_id
from refs
where not exists (
  select 1
  from public.audit_plans
  where title = refs.plan_title
    and plan_year = refs.plan_year
);

with owner_candidates as (
  select id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, 3 as priority
  from public.profiles
),
owner as (
  select id
  from owner_candidates
  order by priority
  limit 1
),
refs as (
  select
    owner.id as owner_id,
    (select id from public.audit_plans where title = format('FY %s Internal Audit Plan', extract(year from current_date)::integer) limit 1) as audit_plan_id,
    (select id from public.auditable_entities where name = 'Identity & Access Management' limit 1) as auditable_entity_id,
    (select id from public.risks where title = 'No MFA for legacy VPN users' limit 1) as risk_id
  from owner
)
insert into public.audit_plan_items (
  audit_plan_id,
  topic,
  auditable_entity_id,
  risk_id,
  status,
  notes,
  created_by,
  updated_by
)
select
  refs.audit_plan_id,
  'VPN MFA exception governance review',
  refs.auditable_entity_id,
  refs.risk_id,
  'planned'::public.audit_plan_item_status,
  'Seeded audit item focused on exception approval, tracking, and retirement evidence.',
  refs.owner_id,
  refs.owner_id
from refs
where refs.audit_plan_id is not null
  and not exists (
    select 1
    from public.audit_plan_items
    where audit_plan_id = refs.audit_plan_id
      and topic = 'VPN MFA exception governance review'
  );

with owner_candidates as (
  select id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, 3 as priority
  from public.profiles
),
owner as (
  select id
  from owner_candidates
  order by priority
  limit 1
),
refs as (
  select
    owner.id as owner_id,
    (select id from public.audit_plan_items where topic = 'VPN MFA exception governance review' limit 1) as audit_plan_item_id
  from owner
)
insert into public.audit_engagements (
  audit_plan_item_id,
  title,
  scope,
  objectives,
  lead_auditor_profile_id,
  status,
  planned_start_date,
  planned_end_date,
  summary,
  created_by,
  updated_by
)
select
  refs.audit_plan_item_id,
  'Seed audit engagement - VPN MFA exceptions',
  'Review exception inventory, approval records, and current MFA rollout evidence for remaining legacy VPN accounts.',
  'Confirm that approved exceptions are time-bound, tracked, and linked to active remediation actions.',
  refs.owner_id,
  'fieldwork'::public.audit_engagement_status,
  current_date + 7,
  current_date + 14,
  'Seeded engagement linked to existing finding, action plan, and evidence records.',
  refs.owner_id,
  refs.owner_id
from refs
where refs.audit_plan_item_id is not null
  and not exists (
    select 1
    from public.audit_engagements
    where audit_plan_item_id = refs.audit_plan_item_id
      and title = 'Seed audit engagement - VPN MFA exceptions'
  );

with refs as (
  select
    (select id from public.audit_engagements where title = 'Seed audit engagement - VPN MFA exceptions' limit 1) as audit_engagement_id,
    (select id from public.findings where title = 'Seed finding - Legacy VPN MFA exceptions remain active' limit 1) as finding_id
)
insert into public.audit_engagement_findings (audit_engagement_id, finding_id)
select
  refs.audit_engagement_id,
  refs.finding_id
from refs
where refs.audit_engagement_id is not null
  and refs.finding_id is not null
on conflict (audit_engagement_id, finding_id) do nothing;

with refs as (
  select
    (select id from public.audit_engagements where title = 'Seed audit engagement - VPN MFA exceptions' limit 1) as audit_engagement_id,
    (select id from public.action_plans where title = 'Enforce MFA on remaining legacy VPN accounts' limit 1) as action_plan_id
)
insert into public.audit_engagement_action_plans (audit_engagement_id, action_plan_id)
select
  refs.audit_engagement_id,
  refs.action_plan_id
from refs
where refs.audit_engagement_id is not null
  and refs.action_plan_id is not null
on conflict (audit_engagement_id, action_plan_id) do nothing;

with owner_candidates as (
  select id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, 3 as priority
  from public.profiles
),
reviewer_candidates as (
  select id, 1 as priority
  from public.profiles
  where lower(email) = 'contributor@open-grc.local'

  union all

  select id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, 3 as priority
  from public.profiles
),
owner as (
  select id
  from owner_candidates
  order by priority
  limit 1
),
reviewer as (
  select id
  from reviewer_candidates
  order by priority
  limit 1
),
refs as (
  select
    owner.id as owner_id,
    reviewer.id as reviewer_id,
    (select id from public.audit_engagements where title = 'Seed audit engagement - VPN MFA exceptions' limit 1) as audit_engagement_id,
    (select id from public.evidence where title = 'Quarterly vulnerability report' limit 1) as evidence_id
  from owner
  cross join reviewer
)
insert into public.audit_workpapers (
  audit_engagement_id,
  title,
  procedure,
  conclusion,
  reviewer_profile_id,
  evidence_id,
  created_by,
  updated_by
)
select
  refs.audit_engagement_id,
  'Seed workpaper - Exception inventory walkthrough',
  'Reviewed exception tickets, approval records, and the seeded evidence attachment to confirm open MFA rollout items.',
  'Open exceptions remain visible and tied to an active remediation plan, but final closure evidence is still pending.',
  refs.reviewer_id,
  refs.evidence_id,
  refs.owner_id,
  refs.owner_id
from refs
where refs.audit_engagement_id is not null
  and not exists (
    select 1
    from public.audit_workpapers
    where audit_engagement_id = refs.audit_engagement_id
      and title = 'Seed workpaper - Exception inventory walkthrough'
  );

with owner_candidates as (
  select id, organization_id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, organization_id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, organization_id, 3 as priority
  from public.profiles
),
owner as (
  select id, organization_id
  from owner_candidates
  order by priority
  limit 1
),
refs as (
  select
    owner.id as owner_id,
    owner.organization_id as organization_id,
    (select id from public.findings where title = 'Seed finding - Legacy VPN MFA exceptions remain active' limit 1) as finding_id,
    (select id from public.controls where code = 'IAM-001' limit 1) as control_id,
    (select id from public.action_plans where title = 'Enforce MFA on remaining legacy VPN accounts' limit 1) as action_plan_id,
    (select id from public.audit_engagements where title = 'Seed audit engagement - VPN MFA exceptions' limit 1) as audit_engagement_id
  from owner
)
insert into public.issues (
  organization_id,
  title,
  description,
  issue_type,
  severity,
  status,
  owner_profile_id,
  due_date,
  root_cause,
  management_response,
  source_finding_id,
  control_id,
  action_plan_id,
  audit_engagement_id,
  created_by,
  updated_by
)
select
  refs.organization_id,
  'Seed issue - Legacy VPN MFA rollout exception tracking',
  'Unified issue seeded for prompt validation: legacy VPN MFA exceptions remain open and need remediation follow-up.',
  'audit_finding'::public.issue_type,
  'high'::public.issue_severity,
  'open'::public.issue_status,
  refs.owner_id,
  current_date + 14,
  'Exception inventory and closure evidence remain fragmented across tools.',
  'Track open exceptions in a single register and require closure evidence before marking resolved.',
  refs.finding_id,
  refs.control_id,
  refs.action_plan_id,
  refs.audit_engagement_id,
  refs.owner_id,
  refs.owner_id
from refs
where refs.finding_id is not null
  and not exists (
    select 1
    from public.issues
    where title = 'Seed issue - Legacy VPN MFA rollout exception tracking'
  );

with organizations as (
  select distinct organization_id
  from public.profiles
  where organization_id is not null
),
groups_seed (audience_key, name, description) as (
  values
    ('all-hands', 'All Hands', 'Seed audience group including all active profiles.'),
    ('policy-owners', 'Policy Owners', 'Seed audience group including manager/admin policy owners.')
),
owner as (
  select id
  from public.profiles
  order by created_at
  limit 1
)
insert into public.policy_audience_groups (
  organization_id,
  audience_key,
  name,
  description,
  created_by,
  updated_by
)
select
  organizations.organization_id,
  groups_seed.audience_key,
  groups_seed.name,
  groups_seed.description,
  owner.id,
  owner.id
from organizations
cross join groups_seed
cross join owner
where not exists (
  select 1
  from public.policy_audience_groups existing
  where existing.organization_id = organizations.organization_id
    and existing.audience_key = groups_seed.audience_key
    and existing.deleted_at is null
);

with all_hands as (
  select id, organization_id
  from public.policy_audience_groups
  where audience_key = 'all-hands'
    and deleted_at is null
),
policy_owners as (
  select id, organization_id
  from public.policy_audience_groups
  where audience_key = 'policy-owners'
    and deleted_at is null
)
insert into public.policy_audience_group_members (group_id, profile_id)
select
  all_hands.id,
  profiles.id
from all_hands
join public.profiles profiles on profiles.organization_id = all_hands.organization_id
where coalesce(profiles.status, 'active') not in ('deactivated', 'invited')
on conflict (group_id, profile_id) do nothing;

with policy_owners as (
  select id, organization_id
  from public.policy_audience_groups
  where audience_key = 'policy-owners'
    and deleted_at is null
)
insert into public.policy_audience_group_members (group_id, profile_id)
select
  policy_owners.id,
  profiles.id
from policy_owners
join public.profiles profiles on profiles.organization_id = policy_owners.organization_id
where profiles.role in ('manager', 'admin')
  and coalesce(profiles.status, 'active') not in ('deactivated', 'invited')
on conflict (group_id, profile_id) do nothing;

with owner_candidates as (
  select id, organization_id, 1 as priority
  from public.profiles
  where lower(email) = 'manager@open-grc.local'

  union all

  select id, organization_id, 2 as priority
  from public.profiles
  where lower(email) = 'admin@open-grc.local'

  union all

  select id, organization_id, 3 as priority
  from public.profiles
),
owner as (
  select id, organization_id
  from owner_candidates
  order by priority
  limit 1
)
insert into public.policies (
  organization_id,
  title,
  version,
  status,
  effective_date,
  next_review_date,
  owner_profile_id,
  content,
  published_at,
  created_by,
  updated_by
)
select
  owner.organization_id,
  'Seed policy - Access exception governance',
  '2.0',
  'active'::public.policy_status,
  current_date - 30,
  current_date + 60,
  owner.id,
  'Seeded policy text for governance v2 testing. Exceptions require documented justification, approver, expiration, and campaign-based attestations.',
  timezone('utc', now()) - interval '10 day',
  owner.id,
  owner.id
from owner
where not exists (
  select 1
  from public.policies
  where title = 'Seed policy - Access exception governance'
    and version = '2.0'
    and deleted_at is null
);

with refs as (
  select
    policies.id as policy_id,
    policies.organization_id as organization_id,
    (select id from public.profiles where organization_id = policies.organization_id order by created_at limit 1) as actor_id
  from public.policies policies
  where policies.title = 'Seed policy - Access exception governance'
    and policies.version = '2.0'
    and policies.deleted_at is null
  limit 1
)
insert into public.policy_attestation_campaigns (
  organization_id,
  policy_id,
  name,
  due_date,
  audience_type,
  audience_role,
  created_by,
  updated_by
)
select
  refs.organization_id,
  refs.policy_id,
  'Seed campaign - Viewer acknowledgement',
  current_date + 14,
  'role'::public.policy_campaign_audience_type,
  'viewer'::public.app_role,
  refs.actor_id,
  refs.actor_id
from refs
where not exists (
  select 1
  from public.policy_attestation_campaigns existing
  where existing.policy_id = refs.policy_id
    and existing.name = 'Seed campaign - Viewer acknowledgement'
    and existing.deleted_at is null
);

with campaign as (
  select
    campaigns.id as campaign_id,
    campaigns.policy_id as policy_id,
    campaigns.organization_id as organization_id,
    campaigns.due_date as due_date
  from public.policy_attestation_campaigns campaigns
  where campaigns.name = 'Seed campaign - Viewer acknowledgement'
    and campaigns.deleted_at is null
  order by campaigns.created_at desc
  limit 1
)
insert into public.policy_attestation_targets (
  organization_id,
  policy_id,
  campaign_id,
  profile_id,
  due_date,
  status
)
select
  campaign.organization_id,
  campaign.policy_id,
  campaign.campaign_id,
  profiles.id,
  campaign.due_date,
  case
    when campaign.due_date < current_date then 'overdue'::public.policy_attestation_status
    else 'pending'::public.policy_attestation_status
  end
from campaign
join public.profiles profiles on profiles.organization_id = campaign.organization_id
where profiles.role = 'viewer'
  and coalesce(profiles.status, 'active') not in ('deactivated', 'invited')
on conflict (campaign_id, profile_id) do nothing;

with refs as (
  select
    policies.id as policy_id,
    policies.organization_id as organization_id,
    (select id from public.profiles where organization_id = policies.organization_id and role in ('manager', 'admin') order by created_at limit 1) as approver_id,
    (select id from public.profiles where organization_id = policies.organization_id and role = 'viewer' order by created_at limit 1) as scoped_profile_id,
    (select id from public.profiles where organization_id = policies.organization_id order by created_at limit 1) as actor_id
  from public.policies policies
  where policies.title = 'Seed policy - Access exception governance'
    and policies.version = '2.0'
    and policies.deleted_at is null
  limit 1
)
insert into public.policy_exceptions (
  organization_id,
  policy_id,
  profile_id,
  justification,
  expiration_date,
  approved_by_profile_id,
  status,
  created_by,
  updated_by
)
select
  refs.organization_id,
  refs.policy_id,
  refs.scoped_profile_id,
  'Seed waiver for demo purposes while the target user finalizes migration prerequisites.',
  current_date + 30,
  refs.approver_id,
  'active'::public.policy_exception_status,
  refs.actor_id,
  refs.actor_id
from refs
where refs.approver_id is not null
  and refs.scoped_profile_id is not null
  and not exists (
    select 1
    from public.policy_exceptions existing
    where existing.policy_id = refs.policy_id
      and existing.profile_id = refs.scoped_profile_id
      and existing.justification = 'Seed waiver for demo purposes while the target user finalizes migration prerequisites.'
      and existing.deleted_at is null
  );
