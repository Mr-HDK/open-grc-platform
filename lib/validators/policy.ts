import { z } from "zod";

export const policyStatusOptions = ["draft", "active", "archived"] as const;

export type PolicyStatus = (typeof policyStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length <= 12000, {
    message: "Content must be under 12000 characters.",
  });

const requiredDateField = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

export const policyFormSchema = z.object({
  title: z.string().trim().min(3).max(180),
  version: z.string().trim().min(1).max(40),
  effectiveDate: requiredDateField,
  ownerProfileId: optionalUuidField,
  content: optionalTextField,
});

export const policyIdSchema = z.string().uuid();

export const policyAttestationSchema = z.object({
  policyId: z.string().uuid("Policy identifier is invalid."),
});

export type PolicyFormInput = z.infer<typeof policyFormSchema>;

export function buildPolicyMutation(payload: PolicyFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    version: payload.version,
    effective_date: payload.effectiveDate,
    owner_profile_id: payload.ownerProfileId,
    content: payload.content,
    updated_by: actorProfileId,
  };
}

export function isPolicyStatus(value: string | null | undefined): value is PolicyStatus {
  return Boolean(value && policyStatusOptions.includes(value as PolicyStatus));
}
