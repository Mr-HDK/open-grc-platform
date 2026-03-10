import { z } from "zod";

export const findingStatusOptions = ["open", "in_progress", "closed"] as const;
export const findingSeverityOptions = ["low", "medium", "high", "critical"] as const;

export type FindingStatus = (typeof findingStatusOptions)[number];
export type FindingSeverity = (typeof findingSeverityOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalDateField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

const optionalTextField = (maxLength: number, label: string) =>
  z
    .string()
    .trim()
    .max(maxLength, `${label} must be under ${maxLength} characters.`)
    .optional()
    .or(z.literal(""));

export const findingFormSchema = z.object({
  controlId: z.string().uuid("Control identifier is invalid."),
  sourceControlTestId: optionalUuidField,
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(5000),
  status: z.enum(findingStatusOptions),
  severity: z.enum(findingSeverityOptions),
  rootCause: optionalTextField(4000, "Root cause"),
  remediationPlan: optionalTextField(4000, "Remediation plan"),
  dueDate: optionalDateField,
  ownerProfileId: optionalUuidField,
});

export const findingIdSchema = z.string().uuid();

export function isFindingStatus(value: string | null | undefined): value is FindingStatus {
  return Boolean(value && findingStatusOptions.includes(value as FindingStatus));
}

export function isFindingSeverity(value: string | null | undefined): value is FindingSeverity {
  return Boolean(value && findingSeverityOptions.includes(value as FindingSeverity));
}

export type FindingFormInput = z.infer<typeof findingFormSchema>;

export function buildFindingMutation(payload: FindingFormInput, actorProfileId: string) {
  return {
    control_id: payload.controlId,
    source_control_test_id: payload.sourceControlTestId,
    title: payload.title,
    description: payload.description,
    status: payload.status,
    severity: payload.severity,
    root_cause: payload.rootCause?.trim() || null,
    remediation_plan: payload.remediationPlan?.trim() || null,
    due_date: payload.dueDate,
    owner_profile_id: payload.ownerProfileId,
    updated_by: actorProfileId,
  };
}
