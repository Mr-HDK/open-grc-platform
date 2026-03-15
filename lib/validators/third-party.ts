import { z } from "zod";

import { assetCriticalityOptions, type AssetCriticality } from "@/lib/validators/asset";

export const thirdPartyAssessmentStatusOptions = [
  "acceptable",
  "monitoring",
  "elevated",
  "critical",
] as const;

export const thirdPartyTierOptions = ["tier_1", "tier_2", "tier_3"] as const;
export const thirdPartyInherentRiskOptions = ["low", "medium", "high", "critical"] as const;
export const thirdPartyOnboardingStatusOptions = [
  "planned",
  "in_progress",
  "completed",
  "blocked",
] as const;
export const thirdPartyReviewResponseValueOptions = [
  "yes",
  "partial",
  "no",
  "not_applicable",
] as const;
export const thirdPartyReviewConclusionOptions = [
  "low_risk",
  "moderate_risk",
  "high_risk",
  "critical_risk",
] as const;
export const thirdPartyDocumentRequestStatusOptions = [
  "requested",
  "submitted",
  "accepted",
  "rejected",
  "waived",
] as const;

export type ThirdPartyAssessmentStatus = (typeof thirdPartyAssessmentStatusOptions)[number];
export type ThirdPartyTier = (typeof thirdPartyTierOptions)[number];
export type ThirdPartyInherentRisk = (typeof thirdPartyInherentRiskOptions)[number];
export type ThirdPartyOnboardingStatus = (typeof thirdPartyOnboardingStatusOptions)[number];
export type ThirdPartyReviewResponseValue = (typeof thirdPartyReviewResponseValueOptions)[number];
export type ThirdPartyReviewConclusion = (typeof thirdPartyReviewConclusionOptions)[number];
export type ThirdPartyDocumentRequestStatus = (typeof thirdPartyDocumentRequestStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalDateField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

const requiredDateField = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

const optionalNotesField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length <= 4000, {
    message: "Notes must be under 4000 characters.",
  });

export const thirdPartyFormSchema = z.object({
  name: z.string().trim().min(2).max(180),
  service: z.string().trim().min(2).max(180),
  criticality: z.enum(assetCriticalityOptions),
  tier: z.enum(thirdPartyTierOptions),
  inherentRisk: z.enum(thirdPartyInherentRiskOptions),
  onboardingStatus: z.enum(thirdPartyOnboardingStatusOptions),
  assessmentStatus: z.enum(thirdPartyAssessmentStatusOptions),
  assessmentScore: z.coerce.number().int().min(0).max(100),
  nextReviewDate: optionalDateField,
  renewalDate: optionalDateField,
  reassessmentIntervalDays: z.coerce.number().int().min(7).max(730),
  ownerProfileId: optionalUuidField,
  contractOwnerProfileId: optionalUuidField,
  notes: optionalNotesField,
});

export const thirdPartyReviewFormSchema = z.object({
  thirdPartyId: z.string().uuid("Third-party identifier is invalid."),
  reviewDate: requiredDateField,
  reviewerProfileId: optionalUuidField,
  nextReviewDate: optionalDateField,
  notes: optionalNotesField,
});

export const thirdPartyReviewResponseSchema = z.object({
  questionId: z.string().uuid("Question identifier is invalid."),
  responseValue: z.enum(thirdPartyReviewResponseValueOptions),
  responseNotes: optionalNotesField,
});

export const thirdPartyDocumentRequestFormSchema = z.object({
  thirdPartyId: z.string().uuid("Third-party identifier is invalid."),
  title: z.string().trim().min(3).max(180),
  description: optionalNotesField,
  dueDate: requiredDateField,
  ownerProfileId: optionalUuidField,
  evidenceId: optionalUuidField,
  responseNotes: optionalNotesField,
});

export const thirdPartyDocumentRequestUpdateSchema = z.object({
  documentRequestId: z.string().uuid("Document request identifier is invalid."),
  status: z.enum(thirdPartyDocumentRequestStatusOptions),
  dueDate: requiredDateField,
  ownerProfileId: optionalUuidField,
  evidenceId: optionalUuidField,
  responseNotes: optionalNotesField,
});

export const thirdPartyIdSchema = z.string().uuid();
export const thirdPartyDocumentRequestIdSchema = z.string().uuid();

export const thirdPartyRiskLinkIdsSchema = z.array(z.string().uuid()).max(30);
export const thirdPartyControlLinkIdsSchema = z.array(z.string().uuid()).max(30);
export const thirdPartyActionLinkIdsSchema = z.array(z.string().uuid()).max(30);

export type ThirdPartyFormInput = z.infer<typeof thirdPartyFormSchema>;
export type ThirdPartyReviewFormInput = z.infer<typeof thirdPartyReviewFormSchema>;
export type ThirdPartyReviewResponseInput = z.infer<typeof thirdPartyReviewResponseSchema>;
export type ThirdPartyDocumentRequestFormInput = z.infer<typeof thirdPartyDocumentRequestFormSchema>;
export type ThirdPartyDocumentRequestUpdateInput = z.infer<typeof thirdPartyDocumentRequestUpdateSchema>;

export function buildThirdPartyMutation(payload: ThirdPartyFormInput, actorProfileId: string) {
  return {
    name: payload.name,
    service: payload.service,
    criticality: payload.criticality,
    tier: payload.tier,
    inherent_risk: payload.inherentRisk,
    onboarding_status: payload.onboardingStatus,
    assessment_status: payload.assessmentStatus,
    assessment_score: payload.assessmentScore,
    next_review_date: payload.nextReviewDate,
    renewal_date: payload.renewalDate,
    reassessment_interval_days: payload.reassessmentIntervalDays,
    owner_profile_id: payload.ownerProfileId,
    contract_owner_profile_id: payload.contractOwnerProfileId,
    notes: payload.notes,
    updated_by: actorProfileId,
  };
}

export function buildThirdPartyReviewMutation(
  payload: ThirdPartyReviewFormInput,
  actorProfileId: string,
  calculated: {
    questionnaireScore: number;
    conclusion: ThirdPartyReviewConclusion;
    assessmentStatus: ThirdPartyAssessmentStatus;
  },
) {
  return {
    third_party_id: payload.thirdPartyId,
    review_date: payload.reviewDate,
    reviewer_profile_id: payload.reviewerProfileId,
    assessment_status: calculated.assessmentStatus,
    assessment_score: calculated.questionnaireScore,
    questionnaire_score: calculated.questionnaireScore,
    conclusion: calculated.conclusion,
    next_review_date: payload.nextReviewDate,
    notes: payload.notes,
    updated_by: actorProfileId,
  };
}

export function buildThirdPartyDocumentRequestMutation(
  payload: ThirdPartyDocumentRequestFormInput | ThirdPartyDocumentRequestUpdateInput,
  actorProfileId: string,
) {
  const dueDate = "dueDate" in payload ? payload.dueDate : null;
  const ownerProfileId = "ownerProfileId" in payload ? payload.ownerProfileId : null;
  const evidenceId = "evidenceId" in payload ? payload.evidenceId : null;
  const responseNotes = "responseNotes" in payload ? payload.responseNotes : null;

  return {
    due_date: dueDate,
    owner_profile_id: ownerProfileId,
    evidence_id: evidenceId,
    response_notes: responseNotes,
    updated_by: actorProfileId,
  };
}

export function isThirdPartyAssessmentStatus(
  value: string | null | undefined,
): value is ThirdPartyAssessmentStatus {
  return Boolean(value && thirdPartyAssessmentStatusOptions.includes(value as ThirdPartyAssessmentStatus));
}

export function isThirdPartyTier(value: string | null | undefined): value is ThirdPartyTier {
  return Boolean(value && thirdPartyTierOptions.includes(value as ThirdPartyTier));
}

export function isThirdPartyInherentRisk(
  value: string | null | undefined,
): value is ThirdPartyInherentRisk {
  return Boolean(value && thirdPartyInherentRiskOptions.includes(value as ThirdPartyInherentRisk));
}

export function isThirdPartyOnboardingStatus(
  value: string | null | undefined,
): value is ThirdPartyOnboardingStatus {
  return Boolean(value && thirdPartyOnboardingStatusOptions.includes(value as ThirdPartyOnboardingStatus));
}

export function isThirdPartyCriticality(
  value: string | null | undefined,
): value is AssetCriticality {
  return Boolean(value && assetCriticalityOptions.includes(value as AssetCriticality));
}
