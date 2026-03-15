-- Seed baseline third-party review questionnaire per organization.

with organizations as (
  select distinct organization_id
  from public.profiles
  where organization_id is not null
),
question_rows (question_key, prompt, weight) as (
  values
    ('security_certification', 'Vendor maintains a valid external security certification aligned with scope.', 30),
    ('access_governance', 'Vendor access controls and privileged access reviews are documented and evidenced.', 25),
    ('incident_response', 'Vendor incident response commitments and notification SLAs are contractually defined.', 25),
    ('business_resilience', 'Vendor resilience and continuity controls are tested and available on request.', 20)
),
seed as (
  select
    organizations.organization_id,
    question_rows.question_key,
    question_rows.prompt,
    question_rows.weight,
    (
      select profiles.id
      from public.profiles profiles
      where profiles.organization_id = organizations.organization_id
      order by profiles.created_at
      limit 1
    ) as actor_id
  from organizations
  cross join question_rows
)
insert into public.third_party_review_questions (
  organization_id,
  question_key,
  prompt,
  weight,
  is_active,
  created_by,
  updated_by
)
select
  seed.organization_id,
  seed.question_key,
  seed.prompt,
  seed.weight,
  true,
  seed.actor_id,
  seed.actor_id
from seed
where seed.actor_id is not null
  and not exists (
    select 1
    from public.third_party_review_questions existing
    where existing.organization_id = seed.organization_id
      and existing.question_key = seed.question_key
      and existing.deleted_at is null
  );
