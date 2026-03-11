"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assetControlLinkIdsSchema,
  assetFormSchema,
  assetIdSchema,
  assetRiskLinkIdsSchema,
  buildAssetMutation,
} from "@/lib/validators/asset";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseAssetPayload(formData: FormData) {
  return assetFormSchema.safeParse({
    name: formData.get("name"),
    assetType: formData.get("assetType"),
    criticality: formData.get("criticality"),
    status: formData.get("status"),
    ownerProfileId: formData.get("ownerProfileId"),
    description: formData.get("description"),
  });
}

function parseRiskLinks(formData: FormData) {
  const rawValues = Array.from(new Set(formData.getAll("riskIds").map((value) => String(value))));
  return assetRiskLinkIdsSchema.safeParse(rawValues);
}

function parseControlLinks(formData: FormData) {
  const rawValues = Array.from(new Set(formData.getAll("controlIds").map((value) => String(value))));
  return assetControlLinkIdsSchema.safeParse(rawValues);
}

async function replaceRiskLinks(assetId: string, riskIds: string[]) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("asset_risks")
    .delete()
    .eq("asset_id", assetId);

  if (deleteError) {
    return deleteError.message;
  }

  if (riskIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("asset_risks").insert(
    riskIds.map((riskId) => ({
      asset_id: assetId,
      risk_id: riskId,
    })),
  );

  return insertError ? insertError.message : null;
}

async function replaceControlLinks(assetId: string, controlIds: string[]) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("asset_controls")
    .delete()
    .eq("asset_id", assetId);

  if (deleteError) {
    return deleteError.message;
  }

  if (controlIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("asset_controls").insert(
    controlIds.map((controlId) => ({
      asset_id: assetId,
      control_id: controlId,
    })),
  );

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

async function validateActiveRisks(riskIds: string[], organizationId: string) {
  if (riskIds.length === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select("id")
    .in("id", riskIds)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .returns<IdRow[]>();

  return (data ?? []).length === riskIds.length
    ? null
    : "One or more linked risks no longer exist or are archived.";
}

async function validateActiveControls(controlIds: string[], organizationId: string) {
  if (controlIds.length === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select("id")
    .in("id", controlIds)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .returns<IdRow[]>();

  return (data ?? []).length === controlIds.length
    ? null
    : "One or more linked controls no longer exist or are archived.";
}

export async function createAssetAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const parsed = parseAssetPayload(formData);
  const riskLinks = parseRiskLinks(formData);
  const controlLinks = parseControlLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/assets/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted asset fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/assets/new?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/assets/new?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  const ownerError = await validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId);

  if (ownerError) {
    redirect(`/dashboard/assets/new?error=${encodeMessage(ownerError)}`);
  }

  const riskError = await validateActiveRisks(riskLinks.data, profile.organizationId);

  if (riskError) {
    redirect(`/dashboard/assets/new?error=${encodeMessage(riskError)}`);
  }

  const controlError = await validateActiveControls(controlLinks.data, profile.organizationId);

  if (controlError) {
    redirect(`/dashboard/assets/new?error=${encodeMessage(controlError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildAssetMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("assets")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/assets/new?error=${encodeMessage(error?.message, "Could not create asset.")}`,
    );
  }

  const [riskLinkError, controlLinkError] = await Promise.all([
    replaceRiskLinks(data.id, riskLinks.data),
    replaceControlLinks(data.id, controlLinks.data),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/assets/${data.id}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(`/dashboard/assets/${data.id}?error=${encodeMessage(controlLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "asset",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      name: mutation.name,
      asset_type: mutation.asset_type,
      criticality: mutation.criticality,
      status: mutation.status,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/assets/${data.id}`);
}

export async function updateAssetAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const assetIdResult = assetIdSchema.safeParse(formData.get("assetId"));

  if (!assetIdResult.success) {
    redirect("/dashboard/assets?error=invalid_id");
  }

  const parsed = parseAssetPayload(formData);
  const riskLinks = parseRiskLinks(formData);
  const controlLinks = parseControlLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted asset fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  const ownerError = await validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId);

  if (ownerError) {
    redirect(`/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(ownerError)}`);
  }

  const riskError = await validateActiveRisks(riskLinks.data, profile.organizationId);

  if (riskError) {
    redirect(`/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(riskError)}`);
  }

  const controlError = await validateActiveControls(controlLinks.data, profile.organizationId);

  if (controlError) {
    redirect(`/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(controlError)}`);
  }

  const mutation = buildAssetMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("assets")
    .update(mutation)
    .eq("id", assetIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/assets/${assetIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const [riskLinkError, controlLinkError] = await Promise.all([
    replaceRiskLinks(assetIdResult.data, riskLinks.data),
    replaceControlLinks(assetIdResult.data, controlLinks.data),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/assets/${assetIdResult.data}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(`/dashboard/assets/${assetIdResult.data}?error=${encodeMessage(controlLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "asset",
    entityId: assetIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      asset_type: mutation.asset_type,
      criticality: mutation.criticality,
      status: mutation.status,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/assets/${assetIdResult.data}`);
}

export async function archiveAssetAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");

  const assetIdResult = assetIdSchema.safeParse(formData.get("assetId"));

  if (!assetIdResult.success) {
    redirect("/dashboard/assets?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("assets")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", assetIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/assets/${assetIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "asset",
    entityId: assetIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/assets");
}
