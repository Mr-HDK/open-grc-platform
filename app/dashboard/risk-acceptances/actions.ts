"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { hasRole, isRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildRiskAcceptanceMutation,
  riskAcceptanceFormSchema,
  riskAcceptanceIdSchema,
} from "@/lib/validators/risk-acceptance";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseRiskAcceptancePayload(formData: FormData) {
  return riskAcceptanceFormSchema.safeParse({
    riskId: formData.get("riskId"),
    controlId: formData.get("controlId"),
    actionPlanId: formData.get("actionPlanId"),
    justification: formData.get("justification"),
    approvedByProfileId: formData.get("approvedByProfileId"),
    expirationDate: formData.get("expirationDate"),
  });
}

type IdRow = { id: string };

type ApproverRow = { id: string; role: string };

type RiskAcceptanceRow = { id: string; status: "active" | "expired" | "revoked" };

async function validateRiskAcceptanceReferences(
  input: {
    riskId: string;
    controlId: string | null;
    actionPlanId: string | null;
    approvedByProfileId: string;
  },
  organizationId: string,
) {
  const supabase = await createSupabaseServerClient();

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

  if (input.actionPlanId) {
    const { data: actionPlan } = await supabase
      .from("action_plans")
      .select("id")
      .eq("id", input.actionPlanId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!actionPlan) {
      return "Selected action plan does not exist or is archived.";
    }
  }

  const { data: approver } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", input.approvedByProfileId)
    .eq("organization_id", organizationId)
    .maybeSingle<ApproverRow>();

  if (!approver) {
    return "Selected approver does not exist.";
  }

  if (!isRole(approver.role) || !hasRole("manager", approver.role)) {
    return "Approver must have manager or admin role.";
  }

  return null;
}

export async function createRiskAcceptanceAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parseRiskAcceptancePayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/risk-acceptances/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted risk acceptance fields are invalid.")}`,
    );
  }

  const referenceError = await validateRiskAcceptanceReferences(parsed.data, profile.organizationId);
  if (referenceError) {
    redirect(`/dashboard/risk-acceptances/new?error=${encodeMessage(referenceError)}`);
  }

  const mutation = buildRiskAcceptanceMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("risk_acceptances")
    .insert({
      ...mutation,
      organization_id: profile.organizationId,
      created_by: profile.id,
      status: "active",
    })
    .select("id, status")
    .single<RiskAcceptanceRow>();

  if (error || !data) {
    redirect(
      `/dashboard/risk-acceptances/new?error=${encodeMessage(error?.message, "Could not create risk acceptance.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "risk_acceptance",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      risk_id: mutation.risk_id,
      control_id: mutation.control_id,
      action_plan_id: mutation.action_plan_id,
      approved_by_profile_id: mutation.approved_by_profile_id,
      expiration_date: mutation.expiration_date,
      status: data.status,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/risk-acceptances/${data.id}`);
}

export async function updateRiskAcceptanceAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const riskAcceptanceIdResult = riskAcceptanceIdSchema.safeParse(formData.get("riskAcceptanceId"));

  if (!riskAcceptanceIdResult.success) {
    redirect("/dashboard/risk-acceptances?error=invalid_id");
  }

  const parsed = parseRiskAcceptancePayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted risk acceptance fields are invalid.")}`,
    );
  }

  const referenceError = await validateRiskAcceptanceReferences(parsed.data, profile.organizationId);
  if (referenceError) {
    redirect(
      `/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}/edit?error=${encodeMessage(referenceError)}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingAcceptance } = await supabase
    .from("risk_acceptances")
    .select("id, status")
    .eq("id", riskAcceptanceIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .maybeSingle<RiskAcceptanceRow>();

  if (!existingAcceptance) {
    redirect(`/dashboard/risk-acceptances?error=${encodeMessage("Risk acceptance not found.")}`);
  }

  if (existingAcceptance.status === "revoked") {
    redirect(
      `/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}?error=${encodeMessage("Revoked acceptances cannot be edited.")}`,
    );
  }

  const mutation = buildRiskAcceptanceMutation(parsed.data, profile.id);
  const { error } = await supabase
    .from("risk_acceptances")
    .update({
      ...mutation,
      status: "active",
    })
    .eq("id", riskAcceptanceIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const { data: refreshed } = await supabase
    .from("risk_acceptances")
    .select("status")
    .eq("id", riskAcceptanceIdResult.data)
    .eq("organization_id", profile.organizationId)
    .maybeSingle<{ status: string }>();

  await recordAuditEvent({
    entityType: "risk_acceptance",
    entityId: riskAcceptanceIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      expiration_date: mutation.expiration_date,
      approved_by_profile_id: mutation.approved_by_profile_id,
      status: refreshed?.status ?? "active",
    },
  }).catch(() => undefined);

  redirect(`/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}`);
}

export async function revokeRiskAcceptanceAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const riskAcceptanceIdResult = riskAcceptanceIdSchema.safeParse(formData.get("riskAcceptanceId"));

  if (!riskAcceptanceIdResult.success) {
    redirect("/dashboard/risk-acceptances?error=invalid_id");
  }

  const supabase = await createSupabaseServerClient();
  const revokedAt = new Date().toISOString();
  const { error } = await supabase
    .from("risk_acceptances")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_by_profile_id: profile.id,
      updated_by: profile.id,
    })
    .eq("id", riskAcceptanceIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .neq("status", "revoked");

  if (error) {
    redirect(
      `/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}?error=${encodeMessage(error.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "risk_acceptance",
    entityId: riskAcceptanceIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: "revoked",
      revoked_at: revokedAt,
      revoked_by_profile_id: profile.id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/risk-acceptances/${riskAcceptanceIdResult.data}`);
}
