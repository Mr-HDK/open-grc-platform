"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildIncidentMutation,
  incidentFormSchema,
  incidentIdSchema,
} from "@/lib/validators/incident";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseIncidentPayload(formData: FormData) {
  return incidentFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    occurredDate: formData.get("occurredDate"),
    riskId: formData.get("riskId"),
    actionPlanId: formData.get("actionPlanId"),
    ownerProfileId: formData.get("ownerProfileId"),
  });
}

type IdRow = { id: string };

async function validateIncidentReferences(input: {
  riskId: string | null;
  actionPlanId: string | null;
  ownerProfileId: string | null;
}) {
  const supabase = await createSupabaseServerClient();

  if (input.ownerProfileId) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", input.ownerProfileId)
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
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!risk) {
      return "Selected risk does not exist or is archived.";
    }
  }

  if (input.actionPlanId) {
    const { data: actionPlan } = await supabase
      .from("action_plans")
      .select("id")
      .eq("id", input.actionPlanId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!actionPlan) {
      return "Selected action plan does not exist or is archived.";
    }
  }

  return null;
}

export async function createIncidentAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseIncidentPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/incidents/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted incident fields are invalid.")}`,
    );
  }

  const referenceError = await validateIncidentReferences(parsed.data);
  if (referenceError) {
    redirect(`/dashboard/incidents/new?error=${encodeMessage(referenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildIncidentMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("incidents")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(`/dashboard/incidents/new?error=${encodeMessage(error?.message, "Could not create incident.")}`);
  }

  await recordAuditEvent({
    entityType: "incident",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      occurred_at: mutation.occurred_at,
      risk_id: mutation.risk_id,
      action_plan_id: mutation.action_plan_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/incidents/${data.id}`);
}

export async function updateIncidentAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const incidentIdResult = incidentIdSchema.safeParse(formData.get("incidentId"));

  if (!incidentIdResult.success) {
    redirect("/dashboard/incidents?error=invalid_id");
  }

  const parsed = parseIncidentPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/incidents/${incidentIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted incident fields are invalid.")}`,
    );
  }

  const referenceError = await validateIncidentReferences(parsed.data);
  if (referenceError) {
    redirect(`/dashboard/incidents/${incidentIdResult.data}/edit?error=${encodeMessage(referenceError)}`);
  }

  const mutation = buildIncidentMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("incidents")
    .update(mutation)
    .eq("id", incidentIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/incidents/${incidentIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "incident",
    entityId: incidentIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      occurred_at: mutation.occurred_at,
      risk_id: mutation.risk_id,
      action_plan_id: mutation.action_plan_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/incidents/${incidentIdResult.data}`);
}

export async function archiveIncidentAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const incidentIdResult = incidentIdSchema.safeParse(formData.get("incidentId"));

  if (!incidentIdResult.success) {
    redirect("/dashboard/incidents?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("incidents")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", incidentIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/incidents/${incidentIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "incident",
    entityId: incidentIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/incidents");
}
