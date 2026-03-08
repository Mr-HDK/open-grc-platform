import { z } from "zod";

import {
  riskLevelOptions,
  riskStatusOptions,
} from "@/lib/scoring/risk";

export const riskFormSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(80),
  impact: z.coerce.number().int().min(1).max(5),
  likelihood: z.coerce.number().int().min(1).max(5),
  status: z.enum(riskStatusOptions),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Due date must use YYYY-MM-DD format.",
    }),
});

export const riskIdSchema = z.string().uuid();

export type RiskFormInput = z.infer<typeof riskFormSchema>;

export function buildRiskMutation(payload: RiskFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    description: payload.description,
    category: payload.category,
    impact: payload.impact,
    likelihood: payload.likelihood,
    status: payload.status,
    due_date: payload.dueDate,
    updated_by: actorProfileId,
  };
}

export function isRiskStatus(value: string | null | undefined) {
  return Boolean(value && riskStatusOptions.includes(value as (typeof riskStatusOptions)[number]));
}

export function isRiskLevel(value: string | null | undefined) {
  return Boolean(value && riskLevelOptions.includes(value as (typeof riskLevelOptions)[number]));
}
