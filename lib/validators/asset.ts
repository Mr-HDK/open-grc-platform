import { z } from "zod";

export const assetCriticalityOptions = ["low", "medium", "high", "critical"] as const;
export const assetStatusOptions = ["active", "inactive", "retired"] as const;

export type AssetCriticality = (typeof assetCriticalityOptions)[number];
export type AssetStatus = (typeof assetStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Owner must be a valid profile identifier.",
  });

const optionalTextField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null));

export const assetFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  assetType: z.string().trim().min(2).max(80),
  criticality: z.enum(assetCriticalityOptions),
  status: z.enum(assetStatusOptions),
  ownerProfileId: optionalUuidField,
  description: optionalTextField,
});

export const assetIdSchema = z.string().uuid();

export const assetRiskLinkIdsSchema = z.array(z.string().uuid()).max(30);
export const assetControlLinkIdsSchema = z.array(z.string().uuid()).max(30);

export type AssetFormInput = z.infer<typeof assetFormSchema>;

export function buildAssetMutation(payload: AssetFormInput, actorProfileId: string) {
  return {
    name: payload.name,
    asset_type: payload.assetType,
    criticality: payload.criticality,
    status: payload.status,
    owner_profile_id: payload.ownerProfileId,
    description: payload.description,
    updated_by: actorProfileId,
  };
}

export function isAssetCriticality(value: string | null | undefined): value is AssetCriticality {
  return Boolean(value && assetCriticalityOptions.includes(value as AssetCriticality));
}

export function isAssetStatus(value: string | null | undefined): value is AssetStatus {
  return Boolean(value && assetStatusOptions.includes(value as AssetStatus));
}
