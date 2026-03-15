import { z } from "zod";

export const auditPlanCycleOptions = ["annual", "semiannual"] as const;
export const auditPlanStatusOptions = ["draft", "approved", "in_progress", "closed"] as const;
export const auditPlanItemStatusOptions = [
  "planned",
  "in_progress",
  "completed",
  "deferred",
] as const;
export const auditEngagementStatusOptions = [
  "planned",
  "fieldwork",
  "reporting",
  "completed",
  "cancelled",
] as const;

export type AuditPlanCycle = (typeof auditPlanCycleOptions)[number];
export type AuditPlanStatus = (typeof auditPlanStatusOptions)[number];
export type AuditPlanItemStatus = (typeof auditPlanItemStatusOptions)[number];
export type AuditEngagementStatus = (typeof auditEngagementStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const requiredUuidField = z.string().uuid("Identifier must be a valid UUID.");

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

const optionalTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length <= 4000, {
    message: "Text must be under 4000 characters.",
  });

export const auditPlanFormSchema = z.object({
  title: z.string().trim().min(2).max(180),
  planYear: z.coerce.number().int().min(2000).max(2100),
  cycle: z.enum(auditPlanCycleOptions),
  status: z.enum(auditPlanStatusOptions),
  ownerProfileId: optionalUuidField,
  summary: optionalTextField,
});

export const auditPlanItemFormSchema = z.object({
  auditPlanId: requiredUuidField,
  topic: z.string().trim().min(2).max(180),
  auditableEntityId: optionalUuidField,
  riskId: optionalUuidField,
  status: z.enum(auditPlanItemStatusOptions),
  notes: optionalTextField,
});

export const auditEngagementFormSchema = z
  .object({
    title: z.string().trim().min(2).max(180),
    auditPlanItemId: requiredUuidField,
    leadAuditorProfileId: requiredUuidField,
    status: z.enum(auditEngagementStatusOptions),
    plannedStartDate: requiredDateField,
    plannedEndDate: requiredDateField,
    actualStartDate: optionalDateField,
    actualEndDate: optionalDateField,
    scope: z.string().trim().min(10).max(6000),
    objectives: z.string().trim().min(10).max(6000),
    summary: optionalTextField,
  })
  .refine((value) => value.plannedEndDate >= value.plannedStartDate, {
    message: "Planned end date must be on or after the planned start date.",
    path: ["plannedEndDate"],
  })
  .refine(
    (value) =>
      value.actualEndDate === null ||
      (value.actualStartDate !== null && value.actualEndDate >= value.actualStartDate),
    {
      message: "Actual end date must be on or after the actual start date.",
      path: ["actualEndDate"],
    },
  );

export const auditWorkpaperFormSchema = z.object({
  auditEngagementId: requiredUuidField,
  title: z.string().trim().min(2).max(180),
  procedure: z.string().trim().min(5).max(6000),
  conclusion: z.string().trim().min(2).max(6000),
  reviewerProfileId: optionalUuidField,
  evidenceId: optionalUuidField,
});

export const auditPlanIdSchema = z.string().uuid();
export const auditPlanItemIdSchema = z.string().uuid();
export const auditEngagementIdSchema = z.string().uuid();
export const auditWorkpaperIdSchema = z.string().uuid();

export const auditEngagementFindingLinkIdsSchema = z.array(z.string().uuid()).max(50);
export const auditEngagementActionLinkIdsSchema = z.array(z.string().uuid()).max(50);

export type AuditPlanFormInput = z.infer<typeof auditPlanFormSchema>;
export type AuditPlanItemFormInput = z.infer<typeof auditPlanItemFormSchema>;
export type AuditEngagementFormInput = z.infer<typeof auditEngagementFormSchema>;
export type AuditWorkpaperFormInput = z.infer<typeof auditWorkpaperFormSchema>;

export function buildAuditPlanMutation(payload: AuditPlanFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    plan_year: payload.planYear,
    cycle: payload.cycle,
    status: payload.status,
    owner_profile_id: payload.ownerProfileId,
    summary: payload.summary,
    updated_by: actorProfileId,
  };
}

export function buildAuditPlanItemMutation(
  payload: AuditPlanItemFormInput,
  actorProfileId: string,
) {
  return {
    audit_plan_id: payload.auditPlanId,
    topic: payload.topic,
    auditable_entity_id: payload.auditableEntityId,
    risk_id: payload.riskId,
    status: payload.status,
    notes: payload.notes,
    updated_by: actorProfileId,
  };
}

export function buildAuditEngagementMutation(
  payload: AuditEngagementFormInput,
  actorProfileId: string,
) {
  return {
    audit_plan_item_id: payload.auditPlanItemId,
    title: payload.title,
    lead_auditor_profile_id: payload.leadAuditorProfileId,
    status: payload.status,
    planned_start_date: payload.plannedStartDate,
    planned_end_date: payload.plannedEndDate,
    actual_start_date: payload.actualStartDate,
    actual_end_date: payload.actualEndDate,
    scope: payload.scope,
    objectives: payload.objectives,
    summary: payload.summary,
    updated_by: actorProfileId,
  };
}

export function buildAuditWorkpaperMutation(
  payload: AuditWorkpaperFormInput,
  actorProfileId: string,
) {
  return {
    audit_engagement_id: payload.auditEngagementId,
    title: payload.title,
    procedure: payload.procedure,
    conclusion: payload.conclusion,
    reviewer_profile_id: payload.reviewerProfileId,
    evidence_id: payload.evidenceId,
    updated_by: actorProfileId,
  };
}

export function isAuditPlanCycle(value: string | null | undefined): value is AuditPlanCycle {
  return Boolean(value && auditPlanCycleOptions.includes(value as AuditPlanCycle));
}

export function isAuditPlanStatus(value: string | null | undefined): value is AuditPlanStatus {
  return Boolean(value && auditPlanStatusOptions.includes(value as AuditPlanStatus));
}

export function isAuditEngagementStatus(
  value: string | null | undefined,
): value is AuditEngagementStatus {
  return Boolean(value && auditEngagementStatusOptions.includes(value as AuditEngagementStatus));
}
