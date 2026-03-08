"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { calculateRiskScore, deriveRiskLevel } from "@/lib/scoring/risk";
import { buildRiskMutation, riskFormSchema, riskIdSchema } from "@/lib/validators/risk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseRiskPayload(formData: FormData) {
  return riskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    ownerProfileId: formData.get("ownerProfileId"),
    impact: formData.get("impact"),
    likelihood: formData.get("likelihood"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
  });
}

type IdRow = {
  id: string;
};

async function validateOwnerProfile(ownerProfileId: string | null) {
  if (!ownerProfileId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", ownerProfileId)
    .maybeSingle<IdRow>();

  return owner ? null : "Selected owner does not exist.";
}

export async function createRiskAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseRiskPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/risks/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted risk fields are invalid.")}`,
    );
  }

  const ownerError = await validateOwnerProfile(parsed.data.ownerProfileId);
  if (ownerError) {
    redirect(`/dashboard/risks/new?error=${encodeMessage(ownerError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildRiskMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };
  const score = calculateRiskScore(parsed.data.impact, parsed.data.likelihood);
  const level = deriveRiskLevel(score);

  const { data, error } = await supabase.from("risks").insert(mutation).select("id").single<{ id: string }>();

  if (error || !data) {
    redirect(`/dashboard/risks/new?error=${encodeMessage(error?.message, "Could not create risk.")}`);
  }

  await recordAuditEvent({
    entityType: "risk",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      title: mutation.title,
      status: mutation.status,
      score,
      level,
      owner_profile_id: mutation.owner_profile_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/risks/${data.id}`);
}

export async function updateRiskAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const riskIdResult = riskIdSchema.safeParse(formData.get("riskId"));

  if (!riskIdResult.success) {
    redirect("/dashboard/risks?error=invalid_id");
  }

  const parsed = parseRiskPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/risks/${riskIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted risk fields are invalid.")}`,
    );
  }

  const ownerError = await validateOwnerProfile(parsed.data.ownerProfileId);
  if (ownerError) {
    redirect(`/dashboard/risks/${riskIdResult.data}/edit?error=${encodeMessage(ownerError)}`);
  }

  const mutation = buildRiskMutation(parsed.data, profile.id);
  const score = calculateRiskScore(parsed.data.impact, parsed.data.likelihood);
  const level = deriveRiskLevel(score);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("risks")
    .update(mutation)
    .eq("id", riskIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/risks/${riskIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "risk",
    entityId: riskIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      score,
      level,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/risks/${riskIdResult.data}`);
}

export async function archiveRiskAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const riskIdResult = riskIdSchema.safeParse(formData.get("riskId"));

  if (!riskIdResult.success) {
    redirect("/dashboard/risks?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("risks")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", riskIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/risks/${riskIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "risk",
    entityId: riskIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/risks");
}
