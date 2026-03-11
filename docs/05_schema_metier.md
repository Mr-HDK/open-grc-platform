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
- risk n..n controls via risk_controls
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

## Règles importantes

- `score = impact * likelihood`
- `impact` et `likelihood` bornés entre 1 et 5
- une preuve doit cibler au moins une entité
- un action plan doit être lié à un risque, un contrôle ou les deux
- les suppressions utilisateur sont idéalement des soft deletes sur entités critiques

## Vue SQL utile plus tard

Prévoir éventuellement une vue calculée `risk_summary_view` pour le dashboard.
