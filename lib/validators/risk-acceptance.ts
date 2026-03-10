import { z } from "zod";

export const riskAcceptanceStatusOptions = ["active", "expired", "revoked"] as const;

export type RiskAcceptanceStatus = (typeof riskAcceptanceStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const requiredDateField = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

export const riskAcceptanceFormSchema = z.object({
  riskId: z.string().uuid("Risk identifier is invalid."),
  controlId: optionalUuidField,
  actionPlanId: optionalUuidField,
  justification: z.string().trim().min(12).max(5000),
  approvedByProfileId: z.string().uuid("Approver identifier is invalid."),
  expirationDate: requiredDateField,
});

export const riskAcceptanceIdSchema = z.string().uuid();

export function isRiskAcceptanceStatus(
  value: string | null | undefined,
): value is RiskAcceptanceStatus {
  return Boolean(value && riskAcceptanceStatusOptions.includes(value as RiskAcceptanceStatus));
}

export type RiskAcceptanceFormInput = z.infer<typeof riskAcceptanceFormSchema>;

export function buildRiskAcceptanceMutation(
  payload: RiskAcceptanceFormInput,
  actorProfileId: string,
) {
  return {
    risk_id: payload.riskId,
    control_id: payload.controlId,
    action_plan_id: payload.actionPlanId,
    justification: payload.justification,
    approved_by_profile_id: payload.approvedByProfileId,
    expiration_date: payload.expirationDate,
    updated_by: actorProfileId,
  };
}
