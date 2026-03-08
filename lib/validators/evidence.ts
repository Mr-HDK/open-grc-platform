import { z } from "zod";

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const evidenceFormSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .transform((value) => (value ? value : null)),
    riskId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    controlId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    actionPlanId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
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
) {
  return {
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

export function buildEvidenceStoragePath(profileId: string, fileName: string) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${profileId}/${crypto.randomUUID()}-${sanitized}`;
}
