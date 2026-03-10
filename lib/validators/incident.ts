import { z } from "zod";

export const incidentStatusOptions = ["open", "investigating", "mitigated", "closed"] as const;

export type IncidentStatus = (typeof incidentStatusOptions)[number];

const optionalUuidField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalDateField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

export const incidentFormSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  status: z.enum(incidentStatusOptions),
  occurredDate: optionalDateField,
  riskId: optionalUuidField,
  actionPlanId: optionalUuidField,
  ownerProfileId: optionalUuidField,
});

export const incidentIdSchema = z.string().uuid();

export type IncidentFormInput = z.infer<typeof incidentFormSchema>;

export function buildIncidentMutation(payload: IncidentFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    description: payload.description,
    status: payload.status,
    occurred_at: payload.occurredDate,
    risk_id: payload.riskId,
    action_plan_id: payload.actionPlanId,
    owner_profile_id: payload.ownerProfileId,
    updated_by: actorProfileId,
  };
}
