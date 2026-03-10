"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  actionPlanFormSchema,
  actionPlanIdSchema,
  buildActionPlanMutation,
} from "@/lib/validators/action-plan";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseActionPlanPayload(formData: FormData) {
  return actionPlanFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    riskId: formData.get("riskId"),
    controlId: formData.get("controlId"),
    ownerProfileId: formData.get("ownerProfileId"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    targetDate: formData.get("targetDate"),
  });
}

type IdRow = {
  id: string;
};

async function validateActionPlanReferences(input: {
  riskId: string | null;
  controlId: string | null;
  ownerProfileId: string | null;
}, organizationId: string) {
  const supabase = await createSupabaseServerClient();

  if (input.ownerProfileId) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", input.ownerProfileId)
      .eq("organization_id", organizationId)
      .maybeSingle<IdRow>();

    if (!owner) {
      return "Selected owner does not exist.";
    }
  }

  if (input.riskId) {
    const { data: risk } = await supabase
      .from("risks")
      .select("id")
      .eq("id", input.riskId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!risk) {
      return "Selected risk does not exist or is archived.";
    }
  }

  if (input.controlId) {
    const { data: control } = await supabase
      .from("controls")
      .select("id")
      .eq("id", input.controlId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!control) {
      return "Selected control does not exist or is archived.";
    }
  }

  return null;
}

export async function createActionPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseActionPlanPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/actions/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted action plan fields are invalid.")}`,
    );
  }

  const referenceError = await validateActionPlanReferences(parsed.data, profile.organizationId);

  if (referenceError) {
    redirect(`/dashboard/actions/new?error=${encodeMessage(referenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildActionPlanMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("action_plans")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/actions/new?error=${encodeMessage(error?.message, "Could not create action plan.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "action_plan",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      priority: mutation.priority,
      target_date: mutation.target_date,
      risk_id: mutation.risk_id,
      control_id: mutation.control_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/actions/${data.id}`);
}

export async function updateActionPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const actionPlanIdResult = actionPlanIdSchema.safeParse(formData.get("actionPlanId"));

  if (!actionPlanIdResult.success) {
    redirect("/dashboard/actions?error=invalid_id");
  }

  const parsed = parseActionPlanPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/actions/${actionPlanIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted action plan fields are invalid.")}`,
    );
  }

  const referenceError = await validateActionPlanReferences(parsed.data, profile.organizationId);

  if (referenceError) {
    redirect(`/dashboard/actions/${actionPlanIdResult.data}/edit?error=${encodeMessage(referenceError)}`);
  }

  const mutation = buildActionPlanMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("action_plans")
    .update(mutation)
    .eq("id", actionPlanIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/actions/${actionPlanIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "action_plan",
    entityId: actionPlanIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      priority: mutation.priority,
      target_date: mutation.target_date,
      risk_id: mutation.risk_id,
      control_id: mutation.control_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/actions/${actionPlanIdResult.data}`);
}

export async function archiveActionPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const actionPlanIdResult = actionPlanIdSchema.safeParse(formData.get("actionPlanId"));

  if (!actionPlanIdResult.success) {
    redirect("/dashboard/actions?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("action_plans")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", actionPlanIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/actions/${actionPlanIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "action_plan",
    entityId: actionPlanIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/actions");
}
