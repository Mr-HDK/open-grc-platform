import { z } from "zod";

export const controlReviewStatusOptions = ["scheduled", "in_progress", "completed"] as const;

export type ControlReviewStatus = (typeof controlReviewStatusOptions)[number];

export function isControlReviewStatus(
  value: string | null | undefined,
): value is ControlReviewStatus {
  return controlReviewStatusOptions.includes(value as ControlReviewStatus);
}

const optionalUuidField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const notesField = z
  .string()
  .trim()
  .max(2000, "Notes must be under 2000 characters.")
  .optional()
  .or(z.literal(""));

export const controlReviewFormSchema = z.object({
  controlId: z.string().uuid("Control identifier is invalid."),
  status: z.enum(controlReviewStatusOptions),
  targetDate: z
    .string()
    .trim()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Target date must use YYYY-MM-DD format.",
    }),
  reviewerProfileId: optionalUuidField,
  notes: notesField,
});

export const controlReviewIdSchema = z.string().uuid();

export type ControlReviewFormInput = z.infer<typeof controlReviewFormSchema>;

export function buildControlReviewMutation(
  payload: ControlReviewFormInput,
  actorProfileId: string,
) {
  return {
    control_id: payload.controlId,
    status: payload.status,
    target_date: payload.targetDate,
    reviewer_profile_id: payload.reviewerProfileId,
    notes: payload.notes?.trim() || null,
    updated_by: actorProfileId,
  };
}
