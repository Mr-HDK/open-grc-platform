import { z } from "zod";

import { roles } from "@/lib/permissions/roles";

export const policyStatusOptions = ["draft", "in_review", "active", "archived"] as const;
export const policyApprovalDecisionOptions = ["approved", "rejected"] as const;
export const policyCampaignAudienceTypeOptions = ["role", "profiles", "group"] as const;
export const policyAttestationStatusOptions = ["pending", "acknowledged", "overdue"] as const;
export const policyExceptionStatusOptions = ["active", "expired", "revoked"] as const;

export type PolicyStatus = (typeof policyStatusOptions)[number];
export type PolicyApprovalDecision = (typeof policyApprovalDecisionOptions)[number];
export type PolicyCampaignAudienceType = (typeof policyCampaignAudienceTypeOptions)[number];
export type PolicyAttestationStatus = (typeof policyAttestationStatusOptions)[number];
export type PolicyExceptionStatus = (typeof policyExceptionStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length <= 12000, {
    message: "Content must be under 12000 characters.",
  });

const optionalCommentField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length <= 2000, {
    message: "Comment must be under 2000 characters.",
  });

const requiredDateField = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

export const policyFormSchema = z.object({
  title: z.string().trim().min(3).max(180),
  version: z.string().trim().min(1).max(40),
  effectiveDate: requiredDateField,
  nextReviewDate: requiredDateField,
  ownerProfileId: optionalUuidField,
  content: optionalTextField,
}).refine((value) => value.nextReviewDate >= value.effectiveDate, {
  path: ["nextReviewDate"],
  message: "Next review date must be on or after the effective date.",
});

export const policyIdSchema = z.string().uuid();

export const policyAttestationSchema = z.object({
  policyId: z.string().uuid("Policy identifier is invalid."),
});

export const policyReviewSchema = z.object({
  policyId: z.string().uuid("Policy identifier is invalid."),
});

export const policyApprovalSchema = z.object({
  policyId: z.string().uuid("Policy identifier is invalid."),
  decision: z.enum(policyApprovalDecisionOptions),
  comment: optionalCommentField,
});

export const policyCampaignSchema = z
  .object({
    policyId: z.string().uuid("Policy identifier is invalid."),
    name: z.string().trim().min(3).max(120),
    dueDate: requiredDateField,
    audienceType: z.enum(policyCampaignAudienceTypeOptions),
    audienceRole: z
      .union([z.enum(roles), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
    audienceGroupId: optionalUuidField,
    targetProfileIds: z.array(z.string().uuid()).default([]),
  })
  .refine(
    (value) =>
      (value.audienceType === "role" &&
        value.audienceRole !== null &&
        value.audienceGroupId === null &&
        value.targetProfileIds.length === 0) ||
      (value.audienceType === "group" &&
        value.audienceRole === null &&
        value.audienceGroupId !== null &&
        value.targetProfileIds.length === 0) ||
      (value.audienceType === "profiles" &&
        value.audienceRole === null &&
        value.audienceGroupId === null &&
        value.targetProfileIds.length > 0),
    {
      message:
        "Audience selection is invalid. Use role, group, or explicit profile selection.",
      path: ["audienceType"],
    },
  );

export const policyAcknowledgeSchema = z.object({
  policyId: z.string().uuid("Policy identifier is invalid."),
  campaignId: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
});

export const policyExceptionSchema = z
  .object({
    policyId: z.string().uuid("Policy identifier is invalid."),
    profileId: optionalUuidField,
    justification: z.string().trim().min(10).max(4000),
    expirationDate: requiredDateField,
    approvedByProfileId: z.string().uuid("Approver identifier is invalid."),
  })
  .refine((value) => value.expirationDate >= new Date().toISOString().slice(0, 10), {
    path: ["expirationDate"],
    message: "Expiration date must be today or later.",
  });

export const policyExceptionIdSchema = z.string().uuid("Exception identifier is invalid.");

export type PolicyFormInput = z.infer<typeof policyFormSchema>;
export type PolicyApprovalInput = z.infer<typeof policyApprovalSchema>;
export type PolicyCampaignInput = z.infer<typeof policyCampaignSchema>;
export type PolicyExceptionInput = z.infer<typeof policyExceptionSchema>;

export function buildPolicyMutation(payload: PolicyFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    version: payload.version,
    effective_date: payload.effectiveDate,
    next_review_date: payload.nextReviewDate,
    owner_profile_id: payload.ownerProfileId,
    content: payload.content,
    updated_by: actorProfileId,
  };
}

export function isPolicyStatus(value: string | null | undefined): value is PolicyStatus {
  return Boolean(value && policyStatusOptions.includes(value as PolicyStatus));
}

export function isPolicyAttestationStatus(
  value: string | null | undefined,
): value is PolicyAttestationStatus {
  return Boolean(value && policyAttestationStatusOptions.includes(value as PolicyAttestationStatus));
}
