"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildIssueMutation,
  issueFormSchema,
  issueIdSchema,
  type IssueFormInput,
} from "@/lib/validators/issue";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseIssuePayload(formData: FormData) {
  return issueFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    issueType: formData.get("issueType"),
    severity: formData.get("severity"),
    status: formData.get("status"),
    ownerProfileId: formData.get("ownerProfileId"),
    dueDate: formData.get("dueDate"),
    rootCause: formData.get("rootCause"),
    managementResponse: formData.get("managementResponse"),
    resolutionNotes: formData.get("resolutionNotes"),
    sourceFindingId: formData.get("sourceFindingId"),
    sourceRiskAcceptanceId: formData.get("sourceRiskAcceptanceId"),
    riskId: formData.get("riskId"),
    controlId: formData.get("controlId"),
    actionPlanId: formData.get("actionPlanId"),
    incidentId: formData.get("incidentId"),
    policyId: formData.get("policyId"),
    thirdPartyId: formData.get("thirdPartyId"),
    auditEngagementId: formData.get("auditEngagementId"),
  });
}

type IdRow = { id: string };

async function validateIssueReferences(
  input: IssueFormInput,
  organizationId: string,
) {
  const supabase = await createSupabaseServerClient();

  async function ensureExists(
    table: string,
    id: string | null,
    message: string,
    deletedColumn: string | null = "deleted_at",
  ) {
    if (!id) {
      return null;
    }

    let query = supabase
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (deletedColumn) {
      query = query.is(deletedColumn, null);
    }

    const { data } = await query.maybeSingle<IdRow>();
    return data ? null : message;
  }

  const checks = await Promise.all([
    ensureExists("profiles", input.ownerProfileId, "Selected issue owner does not exist.", null),
    ensureExists("findings", input.sourceFindingId, "Selected source finding does not exist."),
    ensureExists(
      "risk_acceptances",
      input.sourceRiskAcceptanceId,
      "Selected source risk acceptance does not exist.",
    ),
    ensureExists("risks", input.riskId, "Selected linked risk does not exist."),
    ensureExists("controls", input.controlId, "Selected linked control does not exist."),
    ensureExists("action_plans", input.actionPlanId, "Selected linked action plan does not exist."),
    ensureExists("incidents", input.incidentId, "Selected linked incident does not exist."),
    ensureExists("policies", input.policyId, "Selected linked policy does not exist."),
    ensureExists("third_parties", input.thirdPartyId, "Selected linked third party does not exist."),
    ensureExists(
      "audit_engagements",
      input.auditEngagementId,
      "Selected linked audit engagement does not exist.",
    ),
  ]);

  return checks.find((message) => Boolean(message)) ?? null;
}

async function validateIssueExists(issueId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("issues")
    .select("id")
    .eq("id", issueId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Issue was not found.";
}

export async function createIssueAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseIssuePayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/issues/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted issue fields are invalid.")}`,
    );
  }

  const referenceError = await validateIssueReferences(parsed.data, profile.organizationId);

  if (referenceError) {
    redirect(`/dashboard/issues/new?error=${encodeMessage(referenceError)}`);
  }

  const mutation = {
    ...buildIssueMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("issues")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(`/dashboard/issues/new?error=${encodeMessage(error?.message, "Could not create issue.")}`);
  }

  await recordAuditEvent({
    entityType: "issue",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      issue_type: mutation.issue_type,
      severity: mutation.severity,
      status: mutation.status,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/issues/${data.id}`);
}

export async function updateIssueAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const issueIdResult = issueIdSchema.safeParse(formData.get("issueId"));

  if (!issueIdResult.success) {
    redirect("/dashboard/issues?error=invalid_id");
  }

  const parsed = parseIssuePayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/issues/${issueIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted issue fields are invalid.")}`,
    );
  }

  const [existingError, referenceError] = await Promise.all([
    validateIssueExists(issueIdResult.data, profile.organizationId),
    validateIssueReferences(parsed.data, profile.organizationId),
  ]);

  if (existingError) {
    redirect(`/dashboard/issues?error=${encodeMessage(existingError)}`);
  }

  if (referenceError) {
    redirect(`/dashboard/issues/${issueIdResult.data}/edit?error=${encodeMessage(referenceError)}`);
  }

  const mutation = buildIssueMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("issues")
    .update(mutation)
    .eq("id", issueIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/issues/${issueIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "issue",
    entityId: issueIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      issue_type: mutation.issue_type,
      severity: mutation.severity,
      status: mutation.status,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/issues/${issueIdResult.data}`);
}

export async function archiveIssueAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const issueIdResult = issueIdSchema.safeParse(formData.get("issueId"));

  if (!issueIdResult.success) {
    redirect("/dashboard/issues?error=invalid_id");
  }

  const existingError = await validateIssueExists(issueIdResult.data, profile.organizationId);

  if (existingError) {
    redirect(`/dashboard/issues?error=${encodeMessage(existingError)}`);
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("issues")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", issueIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/issues/${issueIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "issue",
    entityId: issueIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/issues");
}
