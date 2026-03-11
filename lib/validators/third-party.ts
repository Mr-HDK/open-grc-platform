import { z } from "zod";

import { assetCriticalityOptions, type AssetCriticality } from "@/lib/validators/asset";

export const thirdPartyAssessmentStatusOptions = [
  "acceptable",
  "monitoring",
  "elevated",
  "critical",
] as const;

export type ThirdPartyAssessmentStatus = (typeof thirdPartyAssessmentStatusOptions)[number];

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
  assessmentStatus: z.enum(thirdPartyAssessmentStatusOptions),
  assessmentScore: z.coerce.number().int().min(0).max(100),
  nextReviewDate: optionalDateField,
  ownerProfileId: optionalUuidField,
  notes: optionalNotesField,
});

export const thirdPartyReviewFormSchema = z.object({
  thirdPartyId: z.string().uuid("Third-party identifier is invalid."),
  reviewDate: z
    .string()
    .trim()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Review date must use YYYY-MM-DD format.",
    }),
  reviewerProfileId: optionalUuidField,
  assessmentStatus: z.enum(thirdPartyAssessmentStatusOptions),
  assessmentScore: z.coerce.number().int().min(0).max(100),
  nextReviewDate: optionalDateField,
  notes: optionalNotesField,
});

export const thirdPartyIdSchema = z.string().uuid();

export const thirdPartyRiskLinkIdsSchema = z.array(z.string().uuid()).max(30);
export const thirdPartyControlLinkIdsSchema = z.array(z.string().uuid()).max(30);
export const thirdPartyActionLinkIdsSchema = z.array(z.string().uuid()).max(30);

export type ThirdPartyFormInput = z.infer<typeof thirdPartyFormSchema>;
export type ThirdPartyReviewFormInput = z.infer<typeof thirdPartyReviewFormSchema>;

export function buildThirdPartyMutation(payload: ThirdPartyFormInput, actorProfileId: string) {
  return {
    name: payload.name,
    service: payload.service,
    criticality: payload.criticality,
    assessment_status: payload.assessmentStatus,
    assessment_score: payload.assessmentScore,
    next_review_date: payload.nextReviewDate,
    owner_profile_id: payload.ownerProfileId,
    notes: payload.notes,
    updated_by: actorProfileId,
  };
}

export function buildThirdPartyReviewMutation(
  payload: ThirdPartyReviewFormInput,
  actorProfileId: string,
) {
  return {
    third_party_id: payload.thirdPartyId,
    review_date: payload.reviewDate,
    reviewer_profile_id: payload.reviewerProfileId,
    assessment_status: payload.assessmentStatus,
    assessment_score: payload.assessmentScore,
    next_review_date: payload.nextReviewDate,
    notes: payload.notes,
    updated_by: actorProfileId,
  };
}

export function isThirdPartyAssessmentStatus(
  value: string | null | undefined,
): value is ThirdPartyAssessmentStatus {
  return Boolean(value && thirdPartyAssessmentStatusOptions.includes(value as ThirdPartyAssessmentStatus));
}

export function isThirdPartyCriticality(
  value: string | null | undefined,
): value is AssetCriticality {
  return Boolean(value && assetCriticalityOptions.includes(value as AssetCriticality));
}
