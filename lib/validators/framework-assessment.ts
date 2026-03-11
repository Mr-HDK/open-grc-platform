import { z } from "zod";

export const frameworkAssessmentStatusOptions = [
  "compliant",
  "partial",
  "gap",
  "not_applicable",
] as const;

export type FrameworkAssessmentStatus = (typeof frameworkAssessmentStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalJustificationField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

export const frameworkRequirementAssessmentSchema = z
  .object({
    requirementId: z.string().uuid("Requirement identifier is invalid."),
    status: z.enum(frameworkAssessmentStatusOptions),
    justification: optionalJustificationField,
    evidenceIds: z.array(z.string().uuid("Evidence identifier is invalid.")).max(30),
    controlId: optionalUuidField,
    frameworkId: optionalUuidField,
  })
  .superRefine((value, ctx) => {
    if (
      value.status !== "compliant" &&
      value.justification.length < 12
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justification"],
        message: "Justification must contain at least 12 characters for partial, gap, or not applicable statuses.",
      });
    }
  });

export function normalizeAssessmentJustification(
  status: FrameworkAssessmentStatus,
  justification: string,
) {
  return status === "compliant" ? null : justification;
}
