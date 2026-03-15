"use server";

import { redirect } from "next/navigation";
import { type ZodType } from "zod";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditableEntityAssetLinkIdsSchema,
  auditableEntityControlLinkIdsSchema,
  auditableEntityFormSchema,
  auditableEntityIdSchema,
  auditableEntityRiskLinkIdsSchema,
  auditableEntityThirdPartyLinkIdsSchema,
  buildAuditableEntityMutation,
} from "@/lib/validators/auditable-entity";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseAuditableEntityPayload(formData: FormData) {
  return auditableEntityFormSchema.safeParse({
    name: formData.get("name"),
    entityType: formData.get("entityType"),
    status: formData.get("status"),
    ownerProfileId: formData.get("ownerProfileId"),
    parentEntityId: formData.get("parentEntityId"),
    description: formData.get("description"),
  });
}

function parseLinkIds(formData: FormData, fieldName: string, schema: ZodType<string[]>) {
  return schema.safeParse(
    Array.from(new Set(formData.getAll(fieldName).map((value) => String(value)))),
  );
}

async function replaceLinks(input: {
  table: string;
  ownerColumn: string;
  ownerId: string;
  linkedColumn: string;
  linkedIds: string[];
}) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from(input.table)
    .delete()
    .eq(input.ownerColumn, input.ownerId);

  if (deleteError) {
    return deleteError.message;
  }

  if (input.linkedIds.length === 0) {
    return null;
  }

  const rows = input.linkedIds.map((linkedId) => ({
    [input.ownerColumn]: input.ownerId,
    [input.linkedColumn]: linkedId,
  }));

  const { error: insertError } = await supabase.from(input.table).insert(rows);
  return insertError ? insertError.message : null;
}

type IdRow = {
  id: string;
};

async function validateOwnerProfile(ownerProfileId: string | null, organizationId: string) {
  if (!ownerProfileId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", ownerProfileId)
    .eq("organization_id", organizationId)
    .maybeSingle<IdRow>();

  return data ? null : "Selected owner does not exist.";
}

async function validateParentEntity(
  parentEntityId: string | null,
  organizationId: string,
  currentEntityId?: string,
) {
  if (!parentEntityId) {
    return null;
  }

  if (parentEntityId === currentEntityId) {
    return "An entity cannot be its own parent.";
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select("id")
    .eq("id", parentEntityId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Selected parent entity does not exist.";
}

async function validateActiveRows(input: {
  table: "risks" | "controls" | "assets" | "third_parties";
  ids: string[];
  organizationId: string;
  errorMessage: string;
}) {
  if (input.ids.length === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from(input.table)
    .select("id")
    .in("id", input.ids)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .returns<IdRow[]>();

  return (data ?? []).length === input.ids.length ? null : input.errorMessage;
}

async function ensureAuditableEntityExists(entityId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select("id")
    .eq("id", entityId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Auditable entity was not found.";
}

export async function createAuditableEntityAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseAuditableEntityPayload(formData);
  const riskLinks = parseLinkIds(formData, "riskIds", auditableEntityRiskLinkIdsSchema);
  const controlLinks = parseLinkIds(formData, "controlIds", auditableEntityControlLinkIdsSchema);
  const assetLinks = parseLinkIds(formData, "assetIds", auditableEntityAssetLinkIdsSchema);
  const thirdPartyLinks = parseLinkIds(
    formData,
    "thirdPartyIds",
    auditableEntityThirdPartyLinkIdsSchema,
  );

  if (!parsed.success) {
    redirect(
      `/dashboard/auditable-entities/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted entity fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/auditable-entities/new?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/auditable-entities/new?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  if (!assetLinks.success) {
    redirect(
      `/dashboard/auditable-entities/new?error=${encodeMessage(assetLinks.error.issues[0]?.message, "Linked asset values are invalid.")}`,
    );
  }

  if (!thirdPartyLinks.success) {
    redirect(
      `/dashboard/auditable-entities/new?error=${encodeMessage(thirdPartyLinks.error.issues[0]?.message, "Linked third-party values are invalid.")}`,
    );
  }

  const [ownerError, parentError, riskError, controlError, assetError, thirdPartyError] =
    await Promise.all([
      validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId),
      validateParentEntity(parsed.data.parentEntityId, profile.organizationId),
      validateActiveRows({
        table: "risks",
        ids: riskLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked risks no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "controls",
        ids: controlLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked controls no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "assets",
        ids: assetLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked assets no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "third_parties",
        ids: thirdPartyLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked third parties no longer exist or are archived.",
      }),
    ]);

  if (ownerError) {
    redirect(`/dashboard/auditable-entities/new?error=${encodeMessage(ownerError)}`);
  }

  if (parentError) {
    redirect(`/dashboard/auditable-entities/new?error=${encodeMessage(parentError)}`);
  }

  if (riskError) {
    redirect(`/dashboard/auditable-entities/new?error=${encodeMessage(riskError)}`);
  }

  if (controlError) {
    redirect(`/dashboard/auditable-entities/new?error=${encodeMessage(controlError)}`);
  }

  if (assetError) {
    redirect(`/dashboard/auditable-entities/new?error=${encodeMessage(assetError)}`);
  }

  if (thirdPartyError) {
    redirect(`/dashboard/auditable-entities/new?error=${encodeMessage(thirdPartyError)}`);
  }

  const mutation = {
    ...buildAuditableEntityMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("auditable_entities")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/auditable-entities/new?error=${encodeMessage(error?.message, "Could not create auditable entity.")}`,
    );
  }

  const [riskLinkError, controlLinkError, assetLinkError, thirdPartyLinkError] = await Promise.all([
    replaceLinks({
      table: "auditable_entity_risks",
      ownerColumn: "auditable_entity_id",
      ownerId: data.id,
      linkedColumn: "risk_id",
      linkedIds: riskLinks.data,
    }),
    replaceLinks({
      table: "auditable_entity_controls",
      ownerColumn: "auditable_entity_id",
      ownerId: data.id,
      linkedColumn: "control_id",
      linkedIds: controlLinks.data,
    }),
    replaceLinks({
      table: "auditable_entity_assets",
      ownerColumn: "auditable_entity_id",
      ownerId: data.id,
      linkedColumn: "asset_id",
      linkedIds: assetLinks.data,
    }),
    replaceLinks({
      table: "auditable_entity_third_parties",
      ownerColumn: "auditable_entity_id",
      ownerId: data.id,
      linkedColumn: "third_party_id",
      linkedIds: thirdPartyLinks.data,
    }),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/auditable-entities/${data.id}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(`/dashboard/auditable-entities/${data.id}?error=${encodeMessage(controlLinkError)}`);
  }

  if (assetLinkError) {
    redirect(`/dashboard/auditable-entities/${data.id}?error=${encodeMessage(assetLinkError)}`);
  }

  if (thirdPartyLinkError) {
    redirect(`/dashboard/auditable-entities/${data.id}?error=${encodeMessage(thirdPartyLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "auditable_entity",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      name: mutation.name,
      entity_type: mutation.entity_type,
      status: mutation.status,
      parent_entity_id: mutation.parent_entity_id,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
      linked_assets: assetLinks.data.length,
      linked_third_parties: thirdPartyLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/auditable-entities/${data.id}`);
}

export async function updateAuditableEntityAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const auditableEntityIdResult = auditableEntityIdSchema.safeParse(formData.get("auditableEntityId"));

  if (!auditableEntityIdResult.success) {
    redirect("/dashboard/auditable-entities?error=invalid_id");
  }

  const parsed = parseAuditableEntityPayload(formData);
  const riskLinks = parseLinkIds(formData, "riskIds", auditableEntityRiskLinkIdsSchema);
  const controlLinks = parseLinkIds(formData, "controlIds", auditableEntityControlLinkIdsSchema);
  const assetLinks = parseLinkIds(formData, "assetIds", auditableEntityAssetLinkIdsSchema);
  const thirdPartyLinks = parseLinkIds(
    formData,
    "thirdPartyIds",
    auditableEntityThirdPartyLinkIdsSchema,
  );

  if (!parsed.success) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted entity fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  if (!assetLinks.success) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(assetLinks.error.issues[0]?.message, "Linked asset values are invalid.")}`,
    );
  }

  if (!thirdPartyLinks.success) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(thirdPartyLinks.error.issues[0]?.message, "Linked third-party values are invalid.")}`,
    );
  }

  const [existingError, ownerError, parentError, riskError, controlError, assetError, thirdPartyError] =
    await Promise.all([
      ensureAuditableEntityExists(auditableEntityIdResult.data, profile.organizationId),
      validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId),
      validateParentEntity(
        parsed.data.parentEntityId,
        profile.organizationId,
        auditableEntityIdResult.data,
      ),
      validateActiveRows({
        table: "risks",
        ids: riskLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked risks no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "controls",
        ids: controlLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked controls no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "assets",
        ids: assetLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked assets no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "third_parties",
        ids: thirdPartyLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked third parties no longer exist or are archived.",
      }),
    ]);

  if (existingError) {
    redirect(`/dashboard/auditable-entities?error=${encodeMessage(existingError)}`);
  }

  if (ownerError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(ownerError)}`,
    );
  }

  if (parentError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(parentError)}`,
    );
  }

  if (riskError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(riskError)}`,
    );
  }

  if (controlError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(controlError)}`,
    );
  }

  if (assetError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(assetError)}`,
    );
  }

  if (thirdPartyError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(thirdPartyError)}`,
    );
  }

  const mutation = buildAuditableEntityMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("auditable_entities")
    .update(mutation)
    .eq("id", auditableEntityIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const [riskLinkError, controlLinkError, assetLinkError, thirdPartyLinkError] = await Promise.all([
    replaceLinks({
      table: "auditable_entity_risks",
      ownerColumn: "auditable_entity_id",
      ownerId: auditableEntityIdResult.data,
      linkedColumn: "risk_id",
      linkedIds: riskLinks.data,
    }),
    replaceLinks({
      table: "auditable_entity_controls",
      ownerColumn: "auditable_entity_id",
      ownerId: auditableEntityIdResult.data,
      linkedColumn: "control_id",
      linkedIds: controlLinks.data,
    }),
    replaceLinks({
      table: "auditable_entity_assets",
      ownerColumn: "auditable_entity_id",
      ownerId: auditableEntityIdResult.data,
      linkedColumn: "asset_id",
      linkedIds: assetLinks.data,
    }),
    replaceLinks({
      table: "auditable_entity_third_parties",
      ownerColumn: "auditable_entity_id",
      ownerId: auditableEntityIdResult.data,
      linkedColumn: "third_party_id",
      linkedIds: thirdPartyLinks.data,
    }),
  ]);

  if (riskLinkError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}?error=${encodeMessage(riskLinkError)}`,
    );
  }

  if (controlLinkError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}?error=${encodeMessage(controlLinkError)}`,
    );
  }

  if (assetLinkError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}?error=${encodeMessage(assetLinkError)}`,
    );
  }

  if (thirdPartyLinkError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}?error=${encodeMessage(thirdPartyLinkError)}`,
    );
  }

  await recordAuditEvent({
    entityType: "auditable_entity",
    entityId: auditableEntityIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      entity_type: mutation.entity_type,
      status: mutation.status,
      parent_entity_id: mutation.parent_entity_id,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
      linked_assets: assetLinks.data.length,
      linked_third_parties: thirdPartyLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/auditable-entities/${auditableEntityIdResult.data}`);
}

export async function archiveAuditableEntityAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const auditableEntityIdResult = auditableEntityIdSchema.safeParse(formData.get("auditableEntityId"));

  if (!auditableEntityIdResult.success) {
    redirect("/dashboard/auditable-entities?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("auditable_entities")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
      parent_entity_id: null,
    })
    .eq("id", auditableEntityIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}?error=${encodeMessage(error.message)}`,
    );
  }

  const { error: childrenError } = await supabase
    .from("auditable_entities")
    .update({
      parent_entity_id: null,
      updated_by: profile.id,
    })
    .eq("parent_entity_id", auditableEntityIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (childrenError) {
    redirect(
      `/dashboard/auditable-entities/${auditableEntityIdResult.data}?error=${encodeMessage(childrenError.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "auditable_entity",
    entityId: auditableEntityIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/auditable-entities");
}
