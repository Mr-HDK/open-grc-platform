import { z } from "zod";

import {
  deriveRiskLevel,
  calculateRiskScore,
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
    .transform((value) => value || null),
});

export const riskIdSchema = z.string().uuid();

export type RiskFormInput = z.infer<typeof riskFormSchema>;

export function buildRiskMutation(payload: RiskFormInput, actorProfileId: string) {
  const score = calculateRiskScore(payload.impact, payload.likelihood);
  const level = deriveRiskLevel(score);

  return {
    title: payload.title,
    description: payload.description,
    category: payload.category,
    impact: payload.impact,
    likelihood: payload.likelihood,
    score,
    level,
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
