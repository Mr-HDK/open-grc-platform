"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFindingMutation, findingFormSchema, findingIdSchema } from "@/lib/validators/finding";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseFindingPayload(formData: FormData) {
  return findingFormSchema.safeParse({
    controlId: formData.get("controlId"),
    sourceControlTestId: formData.get("sourceControlTestId"),
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    severity: formData.get("severity"),
    rootCause: formData.get("rootCause"),
    remediationPlan: formData.get("remediationPlan"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
  });
}

type IdRow = { id: string };

type SourceControlTestRow = { id: string; control_id: string };

type FindingRow = {
  id: string;
  closed_at: string | null;
  resolved_by_control_test_id: string | null;
};

async function validateFindingReferences(
  input: {
    controlId: string;
    sourceControlTestId: string | null;
    ownerProfileId: string | null;
  },
  organizationId: string,
) {
  const supabase = await createSupabaseServerClient();

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

  if (input.sourceControlTestId) {
    const { data: sourceControlTest } = await supabase
      .from("control_tests")
      .select("id, control_id")
      .eq("id", input.sourceControlTestId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<SourceControlTestRow>();

    if (!sourceControlTest) {
      return "Selected source control test does not exist.";
    }

    if (sourceControlTest.control_id !== input.controlId) {
      return "Source control test must be linked to the selected control.";
    }
  }

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

  return null;
}

export async function createFindingAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseFindingPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/findings/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted finding fields are invalid.")}`,
    );
  }

  const referenceError = await validateFindingReferences(parsed.data, profile.organizationId);
  if (referenceError) {
    redirect(`/dashboard/findings/new?error=${encodeMessage(referenceError)}`);
  }

  const mutation = buildFindingMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("findings")
    .insert({
      ...mutation,
      organization_id: profile.organizationId,
      created_by: profile.id,
      closed_at: mutation.status === "closed" ? new Date().toISOString() : null,
      resolved_by_control_test_id: null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(`/dashboard/findings/new?error=${encodeMessage(error?.message, "Could not create finding.")}`);
  }

  await recordAuditEvent({
    entityType: "finding",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      control_id: mutation.control_id,
      status: mutation.status,
      severity: mutation.severity,
      source_control_test_id: mutation.source_control_test_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/findings/${data.id}`);
}

export async function updateFindingAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const findingIdResult = findingIdSchema.safeParse(formData.get("findingId"));

  if (!findingIdResult.success) {
    redirect("/dashboard/findings?error=invalid_id");
  }

  const parsed = parseFindingPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/findings/${findingIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted finding fields are invalid.")}`,
    );
  }

  const referenceError = await validateFindingReferences(parsed.data, profile.organizationId);
  if (referenceError) {
    redirect(`/dashboard/findings/${findingIdResult.data}/edit?error=${encodeMessage(referenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingFinding } = await supabase
    .from("findings")
    .select("id, closed_at, resolved_by_control_test_id")
    .eq("id", findingIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .maybeSingle<FindingRow>();

  if (!existingFinding) {
    redirect(`/dashboard/findings?error=${encodeMessage("Finding not found.")}`);
  }

  const mutation = buildFindingMutation(parsed.data, profile.id);
  const isClosed = mutation.status === "closed";
  const nextClosedAt = isClosed
    ? (existingFinding.closed_at ?? new Date().toISOString())
    : null;

  const { error } = await supabase
    .from("findings")
    .update({
      ...mutation,
      closed_at: nextClosedAt,
      resolved_by_control_test_id: isClosed ? existingFinding.resolved_by_control_test_id : null,
    })
    .eq("id", findingIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/findings/${findingIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "finding",
    entityId: findingIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      severity: mutation.severity,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/findings/${findingIdResult.data}`);
}

export async function archiveFindingAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const findingIdResult = findingIdSchema.safeParse(formData.get("findingId"));

  if (!findingIdResult.success) {
    redirect("/dashboard/findings?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("findings")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", findingIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/findings/${findingIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "finding",
    entityId: findingIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/findings");
}
