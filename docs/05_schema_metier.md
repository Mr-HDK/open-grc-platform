# Schéma métier et modèle logique

## Entités principales

## organizations

Représente l'espace de travail principal.

Champs:
- id
- name
- created_at
- updated_at

## profiles

Profil utilisateur lié à l'auth.

Champs:
- id
- organization_id
- full_name
- email
- role
- created_at
- updated_at

## risks

Champs:
- id
- organization_id
- title
- description
- category
- owner_profile_id
- impact
- likelihood
- score
- level
- status
- due_date
- created_by
- updated_by
- created_at
- updated_at
- deleted_at

## controls

Champs:
- id
- organization_id
- code
- title
- description
- owner_profile_id
- control_type
- review_frequency
- effectiveness_status
- created_by
- updated_by
- created_at
- updated_at
- deleted_at

## risk_controls

Table pivot.

Champs:
- id
- risk_id
- control_id
- rationale
- created_at

## assets

Champs:
- id
- organization_id
- name
- asset_type
- criticality
- status
- owner_profile_id nullable
- description nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## asset_risks

Table pivot.

Champs:
- asset_id
- risk_id
- created_at

## asset_controls

Table pivot.

Champs:
- asset_id
- control_id
- created_at

## third_parties

Champs:
- id
- organization_id
- name
- service
- criticality
- assessment_status
- assessment_score
- next_review_date nullable
- last_reviewed_at nullable
- owner_profile_id nullable
- notes nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## third_party_risks

Table pivot.

Champs:
- third_party_id
- risk_id
- created_at

## third_party_controls

Table pivot.

Champs:
- third_party_id
- control_id
- created_at

## third_party_actions

Table pivot.

Champs:
- third_party_id
- action_plan_id
- created_at

## third_party_reviews

Champs:
- id
- organization_id
- third_party_id
- review_date
- reviewer_profile_id nullable
- assessment_status
- assessment_score
- notes nullable
- next_review_date nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at

## auditable_entities

Champs:
- id
- organization_id
- name
- entity_type (business_unit, process, application, product, vendor, legal_entity, other)
- status (active, inactive, retired)
- owner_profile_id nullable
- parent_entity_id nullable
- description nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## auditable_entity_risks

Table pivot.

Champs:
- auditable_entity_id
- risk_id
- created_at

## auditable_entity_controls

Table pivot.

Champs:
- auditable_entity_id
- control_id
- created_at

## auditable_entity_assets

Table pivot.

Champs:
- auditable_entity_id
- asset_id
- created_at

## auditable_entity_third_parties

Table pivot.

Champs:
- auditable_entity_id
- third_party_id
- created_at

## audit_plans

Champs:
- id
- organization_id
- title
- plan_year
- cycle (annual, semiannual)
- status (draft, approved, in_progress, closed)
- owner_profile_id nullable
- summary nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## audit_plan_items

Champs:
- id
- organization_id
- audit_plan_id
- topic
- auditable_entity_id nullable
- risk_id nullable
- status (planned, in_progress, completed, deferred)
- notes nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## audit_engagements

Champs:
- id
- organization_id
- audit_plan_item_id
- title
- scope
- objectives
- lead_auditor_profile_id nullable
- status (planned, fieldwork, reporting, completed, cancelled)
- planned_start_date
- planned_end_date
- actual_start_date nullable
- actual_end_date nullable
- summary nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## audit_workpapers

Champs:
- id
- organization_id
- audit_engagement_id
- title
- procedure
- conclusion
- reviewer_profile_id nullable
- evidence_id nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## audit_engagement_findings

Table pivot.

Champs:
- audit_engagement_id
- finding_id
- created_at

## audit_engagement_action_plans

Table pivot.

Champs:
- audit_engagement_id
- action_plan_id
- created_at

## policies

Champs:
- id
- organization_id
- title
- version
- status (draft, in_review, active, archived)
- effective_date
- next_review_date nullable
- owner_profile_id nullable
- content nullable
- published_at nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## policy_attestations

Champs:
- id
- organization_id
- policy_id
- profile_id
- acknowledged_at
- created_at

## policy_approvals

Champs:
- id
- organization_id
- policy_id
- approver_profile_id
- decision (approved, rejected)
- comment nullable
- created_at

## policy_audience_groups

Champs:
- id
- organization_id
- audience_key
- name
- description nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## policy_audience_group_members

Champs:
- group_id
- profile_id
- created_at

## policy_attestation_campaigns

Champs:
- id
- organization_id
- policy_id
- name
- due_date
- audience_type (role, profiles, group)
- audience_role nullable
- audience_group_id nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## policy_attestation_targets

Champs:
- id
- organization_id
- policy_id
- campaign_id
- profile_id
- due_date
- status (pending, acknowledged, overdue)
- acknowledged_at nullable
- created_at
- updated_at

## policy_exceptions

Champs:
- id
- organization_id
- policy_id
- profile_id nullable
- justification
- expiration_date
- approved_by_profile_id
- status (active, expired, revoked)
- revoked_at nullable
- revoked_by_profile_id nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## issues

Champs:
- id
- organization_id
- title
- description
- issue_type (audit_finding, control_failure, policy_exception, vendor_issue, risk_exception, incident_follow_up)
- severity (low, medium, high, critical)
- status (open, in_progress, blocked, resolved, closed)
- owner_profile_id nullable
- due_date nullable
- root_cause nullable
- management_response nullable
- resolution_notes nullable
- source_finding_id nullable
- source_risk_acceptance_id nullable
- risk_id nullable
- control_id nullable
- action_plan_id nullable
- incident_id nullable
- policy_id nullable
- third_party_id nullable
- audit_engagement_id nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at
- deleted_at

## action_plans

Champs:
- id
- organization_id
- title
- description
- risk_id nullable
- control_id nullable
- owner_profile_id
- status
- priority
- target_date
- completed_at nullable
- created_by
- updated_by
- created_at
- updated_at

## evidence

Champs:
- id
- organization_id
- file_name
- file_path
- mime_type
- file_size
- title
- description
- risk_id nullable
- control_id nullable
- action_plan_id nullable
- uploaded_by
- created_at
- archived_at nullable

## frameworks

Champs:
- id
- code
- name
- version
- created_at

## framework_requirements

Champs:
- id
- framework_id
- reference_code
- title
- description
- domain nullable
- created_at

## control_framework_mappings

Champs:
- id
- control_id
- framework_requirement_id
- notes nullable
- created_at

## framework_requirement_assessments

Champs:
- id
- organization_id
- framework_requirement_id
- status (compliant, partial, gap, not_applicable)
- justification nullable (required for partial/gap/not_applicable)
- assessed_at
- assessed_by_profile_id nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at

## framework_requirement_assessment_evidence

Champs:
- assessment_id
- evidence_id
- created_at

## audit_log

Champs:
- id
- organization_id
- entity_type
- entity_id
- action
- actor_profile_id
- change_summary jsonb
- created_at

## Relations clés

- organization 1..n profiles
- organization 1..n risks
- organization 1..n controls
- organization 1..n auditable_entities
- organization 1..n audit_plans
- risk n..n controls via risk_controls
- auditable_entity n..n risks via auditable_entity_risks
- auditable_entity n..n controls via auditable_entity_controls
- auditable_entity n..n assets via auditable_entity_assets
- auditable_entity n..n third_parties via auditable_entity_third_parties
- auditable_entity 1..n child auditable_entities via parent_entity_id
- audit_plan 1..n audit_plan_items
- audit_plan_item 1..n audit_engagements
- audit_plan_item 0..1 auditable_entity
- audit_plan_item 0..1 risk
- audit_engagement 1..n audit_workpapers
- audit_engagement n..n findings via audit_engagement_findings
- audit_engagement n..n action_plans via audit_engagement_action_plans
- audit_workpaper 0..1 evidence
- risk 1..n action_plans
- control 1..n action_plans
- risk 1..n evidence
- control 1..n evidence
- action_plan 1..n evidence
- control n..n framework_requirements via control_framework_mappings
- asset n..n risks via asset_risks
- asset n..n controls via asset_controls
- third_party n..n risks via third_party_risks
- third_party n..n controls via third_party_controls
- third_party n..n action_plans via third_party_actions
- third_party 1..n reviews via third_party_reviews
- policy 1..n attestations via policy_attestations
- profile 1..n policy_attestations
- policy 1..n approvals via policy_approvals
- policy 1..n attestation campaigns via policy_attestation_campaigns
- campaign 1..n targets via policy_attestation_targets
- policy_audience_group 1..n members via policy_audience_group_members
- policy 1..n waivers via policy_exceptions
- finding 1..n issues via source_finding_id
- risk_acceptance 1..n issues via source_risk_acceptance_id
- issue 0..1 risk via risk_id
- issue 0..1 control via control_id
- issue 0..1 action_plan via action_plan_id
- issue 0..1 incident via incident_id
- issue 0..1 policy via policy_id
- issue 0..1 third_party via third_party_id
- issue 0..1 audit_engagement via audit_engagement_id
- framework_requirement 1..1 assessment per organization
- assessment n..n evidence via framework_requirement_assessment_evidence

## Enums suggérés

### role
- admin
- manager
- contributor
- viewer

### risk_status
- draft
- open
- mitigated
- accepted
- closed

### risk_level
- low
- medium
- high
- critical

### control_effectiveness_status
- not_tested
- effective
- partially_effective
- ineffective

### action_status
- open
- in_progress
- blocked
- done
- cancelled

### priority
- low
- medium
- high
- critical

### policy_status
- draft
- in_review
- active
- archived

### policy_approval_decision
- approved
- rejected

### policy_campaign_audience_type
- role
- profiles
- group

### policy_attestation_status
- pending
- acknowledged
- overdue

### policy_exception_status
- active
- expired
- revoked

### issue_type
- audit_finding
- control_failure
- policy_exception
- vendor_issue
- risk_exception
- incident_follow_up

### issue_severity
- low
- medium
- high
- critical

### issue_status
- open
- in_progress
- blocked
- resolved
- closed

## Règles importantes

- `score = impact * likelihood`
- `impact` et `likelihood` bornés entre 1 et 5
- une preuve doit cibler au moins une entité
- un action plan doit être lié à un risque, un contrôle ou les deux
- les suppressions utilisateur sont idéalement des soft deletes sur entités critiques

## Vue SQL utile plus tard

Prévoir éventuellement une vue calculée `risk_summary_view` pour le dashboard.
