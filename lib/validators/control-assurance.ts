import { z } from "zod";

import { controlEffectivenessOptions } from "@/lib/validators/control";

export const controlAttestationStatusOptions = ["pending", "submitted", "reviewed"] as const;
export const controlEvidenceRequestStatusOptions = [
  "requested",
  "submitted",
  "accepted",
  "rejected",
  "waived",
] as const;

export type ControlAttestationStatus = (typeof controlAttestationStatusOptions)[number];
export type ControlEvidenceRequestStatus =
  (typeof controlEvidenceRequestStatusOptions)[number];

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

const optionalLongTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length <= 4000, {
    message: "Text must be under 4000 characters.",
  });

const optionalEffectivenessField = z
  .union([z.enum(controlEffectivenessOptions), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.length > 0 ? value : null));

export const controlAttestationFormSchema = z.object({
  controlId: z.string().uuid("Control identifier is invalid."),
  cycleName: z.string().trim().min(3).max(120),
  dueDate: requiredDateField,
  ownerProfileId: optionalUuidField,
});

export const controlAttestationUpdateSchema = z
  .object({
    attestationId: z.string().uuid("Attestation identifier is invalid."),
    status: z.enum(controlAttestationStatusOptions),
    dueDate: requiredDateField,
    ownerProfileId: optionalUuidField,
    attestedEffectivenessStatus: optionalEffectivenessField,
    ownerComment: optionalLongTextField,
    reviewComment: optionalLongTextField,
  })
  .refine(
    (value) =>
      value.status === "pending" || value.attestedEffectivenessStatus !== null,
    {
      path: ["attestedEffectivenessStatus"],
      message: "Submitted attestations must declare an effectiveness status.",
    },
  );

export const controlEvidenceRequestFormSchema = z.object({
  controlId: z.string().uuid("Control identifier is invalid."),
  controlAttestationId: optionalUuidField,
  title: z.string().trim().min(3).max(180),
  description: optionalLongTextField,
  dueDate: requiredDateField,
  ownerProfileId: optionalUuidField,
  evidenceId: optionalUuidField,
  responseNotes: optionalLongTextField,
  reviewComment: optionalLongTextField,
});

export const controlEvidenceRequestUpdateSchema = z
  .object({
    evidenceRequestId: z.string().uuid("Evidence request identifier is invalid."),
    status: z.enum(controlEvidenceRequestStatusOptions),
    dueDate: requiredDateField,
    ownerProfileId: optionalUuidField,
    evidenceId: optionalUuidField,
    responseNotes: optionalLongTextField,
    reviewComment: optionalLongTextField,
  })
  .refine(
    (value) =>
      value.status === "requested" ||
      value.status === "waived" ||
      value.evidenceId !== null,
    {
      path: ["evidenceId"],
      message: "Submitted or reviewed requests require linked evidence.",
    },
  );

export type ControlAttestationFormInput = z.infer<typeof controlAttestationFormSchema>;
export type ControlAttestationUpdateInput = z.infer<typeof controlAttestationUpdateSchema>;
export type ControlEvidenceRequestFormInput = z.infer<typeof controlEvidenceRequestFormSchema>;
export type ControlEvidenceRequestUpdateInput = z.infer<typeof controlEvidenceRequestUpdateSchema>;

export function buildControlAttestationMutation(
  payload: ControlAttestationFormInput,
  ownerProfileId: string,
  actorProfileId: string,
) {
  return {
    control_id: payload.controlId,
    cycle_name: payload.cycleName,
    due_date: payload.dueDate,
    owner_profile_id: ownerProfileId,
    status: "pending" as ControlAttestationStatus,
    updated_by: actorProfileId,
  };
}

export function buildControlEvidenceRequestMutation(
  payload: ControlEvidenceRequestFormInput,
  ownerProfileId: string | null,
  actorProfileId: string,
) {
  return {
    control_id: payload.controlId,
    control_attestation_id: payload.controlAttestationId,
    title: payload.title,
    description: payload.description,
    due_date: payload.dueDate,
    owner_profile_id: ownerProfileId,
    requested_by_profile_id: actorProfileId,
    evidence_id: payload.evidenceId,
    response_notes: payload.responseNotes,
    review_comment: payload.reviewComment,
    status: "requested" as ControlEvidenceRequestStatus,
    updated_by: actorProfileId,
  };
}
