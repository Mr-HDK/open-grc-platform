import { z } from "zod";

export const auditableEntityTypeOptions = [
  "business_unit",
  "process",
  "application",
  "product",
  "vendor",
  "legal_entity",
  "other",
] as const;

export const auditableEntityStatusOptions = ["active", "inactive", "retired"] as const;

export type AuditableEntityType = (typeof auditableEntityTypeOptions)[number];
export type AuditableEntityStatus = (typeof auditableEntityStatusOptions)[number];

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
  .refine((value) => value === null || value.length <= 4000, {
    message: "Description must be under 4000 characters.",
  });

export const auditableEntityFormSchema = z.object({
  name: z.string().trim().min(2).max(180),
  entityType: z.enum(auditableEntityTypeOptions),
  status: z.enum(auditableEntityStatusOptions),
  ownerProfileId: optionalUuidField,
  parentEntityId: optionalUuidField,
  description: optionalTextField,
});

export const auditableEntityIdSchema = z.string().uuid();

export const auditableEntityRiskLinkIdsSchema = z.array(z.string().uuid()).max(50);
export const auditableEntityControlLinkIdsSchema = z.array(z.string().uuid()).max(50);
export const auditableEntityAssetLinkIdsSchema = z.array(z.string().uuid()).max(50);
export const auditableEntityThirdPartyLinkIdsSchema = z.array(z.string().uuid()).max(50);

export type AuditableEntityFormInput = z.infer<typeof auditableEntityFormSchema>;

export function buildAuditableEntityMutation(
  payload: AuditableEntityFormInput,
  actorProfileId: string,
) {
  return {
    name: payload.name,
    entity_type: payload.entityType,
    status: payload.status,
    owner_profile_id: payload.ownerProfileId,
    parent_entity_id: payload.parentEntityId,
    description: payload.description,
    updated_by: actorProfileId,
  };
}

export function isAuditableEntityType(
  value: string | null | undefined,
): value is AuditableEntityType {
  return Boolean(value && auditableEntityTypeOptions.includes(value as AuditableEntityType));
}

export function isAuditableEntityStatus(
  value: string | null | undefined,
): value is AuditableEntityStatus {
  return Boolean(value && auditableEntityStatusOptions.includes(value as AuditableEntityStatus));
}
