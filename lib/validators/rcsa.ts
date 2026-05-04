import { z } from "zod";

export const rcsaCampaignStatusOptions = [
  "draft",
  "in_progress",
  "submitted",
  "reviewed",
  "closed",
] as const;

export const rcsaResultOptions = [
  "satisfactory",
  "needs_attention",
  "critical",
] as const;

export const rcsaQuestionCategoryOptions = [
  "design_adequacy",
  "operating_effectiveness",
  "recent_incidents",
  "evidence_available",
  "actions_needed",
] as const;

export const rcsaResponseValueOptions = [
  "strong",
  "adequate",
  "weak",
  "critical",
] as const;

export type RcsaCampaignStatus = (typeof rcsaCampaignStatusOptions)[number];
export type RcsaResult = (typeof rcsaResultOptions)[number];
export type RcsaQuestionCategory = (typeof rcsaQuestionCategoryOptions)[number];
export type RcsaResponseValue = (typeof rcsaResponseValueOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || z.string().uuid().safeParse(value).success,
    {
      message: "Identifier must be a valid UUID.",
    },
  );

const optionalDateField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

const optionalTextField = (maxLength: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || value.length <= maxLength, {
      message: `${label} must be under ${maxLength} characters.`,
    });

export const rcsaCampaignFormSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: optionalTextField(4000, "Description"),
    status: z.enum(rcsaCampaignStatusOptions),
    ownerProfileId: optionalUuidField,
    auditableEntityId: optionalUuidField,
    riskId: optionalUuidField,
    controlId: optionalUuidField,
    periodStartDate: optionalDateField,
    periodEndDate: optionalDateField,
    dueDate: optionalDateField,
  })
  .refine(
    (value) =>
      value.periodStartDate === null ||
      value.periodEndDate === null ||
      value.periodEndDate >= value.periodStartDate,
    {
      message: "Period end must be on or after period start.",
      path: ["periodEndDate"],
    },
  )
  .refine(
    (value) =>
      value.auditableEntityId !== null ||
      value.riskId !== null ||
      value.controlId !== null ||
      value.ownerProfileId !== null,
    {
      message:
        "Campaign must be scoped to an owner, auditable entity, risk, or control.",
      path: ["ownerProfileId"],
    },
  );

export const rcsaResponseSchema = z.object({
  questionId: z.string().uuid(),
  responseValue: z.enum(rcsaResponseValueOptions),
  notes: optionalTextField(3000, "Response notes"),
  evidenceAvailable: z.boolean(),
  actionRequired: z.boolean(),
  suggestedAction: optionalTextField(1000, "Suggested action"),
});

export const rcsaResponsesFormSchema = z.object({
  campaignId: z.string().uuid(),
  intent: z.enum(["save", "submit"]),
  responses: z.array(rcsaResponseSchema).min(1).max(25),
});

export const rcsaReviewFormSchema = z.object({
  campaignId: z.string().uuid(),
  status: z.enum(["reviewed", "closed"]),
  managerReviewNotes: z.string().trim().min(3).max(4000),
});

export const rcsaResponseActionSchema = z.object({
  campaignId: z.string().uuid(),
  responseId: z.string().uuid(),
});

export const rcsaCampaignIdSchema = z.string().uuid();

export type RcsaCampaignFormInput = z.infer<typeof rcsaCampaignFormSchema>;
export type RcsaResponsesFormInput = z.infer<typeof rcsaResponsesFormSchema>;
export type RcsaReviewFormInput = z.infer<typeof rcsaReviewFormSchema>;

export function buildRcsaCampaignMutation(
  payload: RcsaCampaignFormInput,
  actorProfileId: string,
) {
  return {
    title: payload.title,
    description: payload.description,
    status: payload.status,
    owner_profile_id: payload.ownerProfileId,
    auditable_entity_id: payload.auditableEntityId,
    risk_id: payload.riskId,
    control_id: payload.controlId,
    period_start_date: payload.periodStartDate,
    period_end_date: payload.periodEndDate,
    due_date: payload.dueDate,
    updated_by: actorProfileId,
  };
}

export function isRcsaCampaignStatus(
  value: string | null | undefined,
): value is RcsaCampaignStatus {
  return Boolean(
    value && rcsaCampaignStatusOptions.includes(value as RcsaCampaignStatus),
  );
}

export function isRcsaResult(
  value: string | null | undefined,
): value is RcsaResult {
  return Boolean(value && rcsaResultOptions.includes(value as RcsaResult));
}
