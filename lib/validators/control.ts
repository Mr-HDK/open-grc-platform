import { z } from "zod";

export const controlEffectivenessOptions = [
  "not_tested",
  "effective",
  "partially_effective",
  "ineffective",
] as const;

export const controlReviewFrequencyOptions = [
  "weekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "on_demand",
] as const;

export type ControlEffectivenessStatus = (typeof controlEffectivenessOptions)[number];
export type ControlReviewFrequency = (typeof controlReviewFrequencyOptions)[number];

export const controlFormSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(5000),
  controlType: z.string().trim().min(2).max(50),
  reviewFrequency: z.enum(controlReviewFrequencyOptions),
  effectivenessStatus: z.enum(controlEffectivenessOptions),
  ownerProfileId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  nextReviewDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
});

export const controlIdSchema = z.string().uuid();

export const riskLinkIdsSchema = z.array(z.string().uuid()).max(25);

export type ControlFormInput = z.infer<typeof controlFormSchema>;

export function buildControlMutation(payload: ControlFormInput, actorProfileId: string) {
  return {
    code: payload.code.toUpperCase(),
    title: payload.title,
    description: payload.description,
    control_type: payload.controlType,
    review_frequency: payload.reviewFrequency,
    effectiveness_status: payload.effectivenessStatus,
    owner_profile_id: payload.ownerProfileId,
    next_review_date: payload.nextReviewDate,
    updated_by: actorProfileId,
  };
}

export function isControlEffectivenessStatus(value: string | null | undefined) {
  return Boolean(
    value &&
      controlEffectivenessOptions.includes(
        value as (typeof controlEffectivenessOptions)[number],
      ),
  );
}

export function isControlReviewFrequency(value: string | null | undefined) {
  return Boolean(
    value &&
      controlReviewFrequencyOptions.includes(
        value as (typeof controlReviewFrequencyOptions)[number],
      ),
  );
}
