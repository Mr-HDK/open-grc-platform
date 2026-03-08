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
