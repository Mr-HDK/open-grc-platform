import { z } from "zod";

export const controlTestResultOptions = ["passed", "failed", "partial"] as const;

export type ControlTestResult = (typeof controlTestResultOptions)[number];

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

const notesField = z
  .string()
  .trim()
  .max(2000, "Notes must be under 2000 characters.")
  .optional()
  .or(z.literal(""));

export const controlTestFormSchema = z
  .object({
    controlId: z.string().uuid("Control identifier is invalid."),
    testPeriodStart: requiredDateField,
    testPeriodEnd: requiredDateField,
    testerProfileId: z.string().uuid("Tester identifier is invalid."),
    result: z.enum(controlTestResultOptions),
    notes: notesField,
    findingId: optionalUuidField,
  })
  .refine((value) => value.testPeriodEnd >= value.testPeriodStart, {
    message: "Test period end date must be on or after start date.",
    path: ["testPeriodEnd"],
  });

export const controlTestIdSchema = z.string().uuid();

export type ControlTestFormInput = z.infer<typeof controlTestFormSchema>;

export function buildControlTestMutation(
  payload: ControlTestFormInput,
  actorProfileId: string,
) {
  return {
    control_id: payload.controlId,
    test_period_start: payload.testPeriodStart,
    test_period_end: payload.testPeriodEnd,
    tester_profile_id: payload.testerProfileId,
    result: payload.result,
    notes: payload.notes?.trim() || null,
    updated_by: actorProfileId,
  };
}
