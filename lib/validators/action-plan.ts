import { z } from "zod";

export const actionStatusOptions = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;

export const actionPriorityOptions = ["low", "medium", "high", "critical"] as const;

export type ActionStatus = (typeof actionStatusOptions)[number];
export type ActionPriority = (typeof actionPriorityOptions)[number];

export const actionPlanFormSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(10).max(5000),
    riskId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    controlId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    ownerProfileId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    status: z.enum(actionStatusOptions),
    priority: z.enum(actionPriorityOptions),
    targetDate: z.string().trim().min(1),
  })
  .refine((value) => Boolean(value.riskId || value.controlId), {
    path: ["riskId"],
    message: "Link the action plan to at least one risk or control.",
  });

export const actionPlanIdSchema = z.string().uuid();

export type ActionPlanFormInput = z.infer<typeof actionPlanFormSchema>;

export function buildActionPlanMutation(payload: ActionPlanFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    description: payload.description,
    risk_id: payload.riskId,
    control_id: payload.controlId,
    owner_profile_id: payload.ownerProfileId,
    status: payload.status,
    priority: payload.priority,
    target_date: payload.targetDate,
    completed_at: payload.status === "done" ? new Date().toISOString() : null,
    updated_by: actorProfileId,
  };
}

export function isActionStatus(value: string | null | undefined) {
  return Boolean(value && actionStatusOptions.includes(value as ActionStatus));
}

export function isActionPriority(value: string | null | undefined) {
  return Boolean(value && actionPriorityOptions.includes(value as ActionPriority));
}

export function isOverdueAction(targetDate: string, status: string) {
  const inactiveStatuses = new Set(["done", "cancelled"]);
  if (inactiveStatuses.has(status)) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  return targetDate < today;
}
