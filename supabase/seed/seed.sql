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
