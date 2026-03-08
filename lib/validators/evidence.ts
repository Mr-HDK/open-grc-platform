import { z } from "zod";

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const optionalUuidField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Linked record identifier must be a valid UUID.",
  });

export const evidenceFormSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .transform((value) => (value ? value : null)),
    riskId: optionalUuidField,
    controlId: optionalUuidField,
    actionPlanId: optionalUuidField,
  })
  .refine((payload) => Boolean(payload.riskId || payload.controlId || payload.actionPlanId), {
    path: ["riskId"],
    message: "Link evidence to at least one risk, control, or action plan.",
  });

export const evidenceIdSchema = z.string().uuid();

export type EvidenceFormInput = z.infer<typeof evidenceFormSchema>;

export function buildEvidenceMutation(
  payload: EvidenceFormInput,
  fileMeta: {
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  },
  uploaderProfileId: string,
  organizationId: string,
) {
  return {
    organization_id: organizationId,
    title: payload.title,
    description: payload.description,
    risk_id: payload.riskId,
    control_id: payload.controlId,
    action_plan_id: payload.actionPlanId,
    file_name: fileMeta.fileName,
    file_path: fileMeta.filePath,
    mime_type: fileMeta.mimeType,
    file_size: fileMeta.fileSize,
    uploaded_by: uploaderProfileId,
  };
}

export function buildEvidenceStoragePath(
  profileId: string,
  organizationId: string,
  fileName: string,
) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/${profileId}/${crypto.randomUUID()}-${sanitized}`;
}
