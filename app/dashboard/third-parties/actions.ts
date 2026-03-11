"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildThirdPartyMutation,
  buildThirdPartyReviewMutation,
  thirdPartyActionLinkIdsSchema,
  thirdPartyControlLinkIdsSchema,
  thirdPartyFormSchema,
  thirdPartyIdSchema,
  thirdPartyReviewFormSchema,
  thirdPartyRiskLinkIdsSchema,
} from "@/lib/validators/third-party";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseThirdPartyPayload(formData: FormData) {
  return thirdPartyFormSchema.safeParse({
    name: formData.get("name"),
    service: formData.get("service"),
    criticality: formData.get("criticality"),
    assessmentStatus: formData.get("assessmentStatus"),
    assessmentScore: formData.get("assessmentScore"),
    nextReviewDate: formData.get("nextReviewDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    notes: formData.get("notes"),
  });
}

function parseRiskLinks(formData: FormData) {
  return thirdPartyRiskLinkIdsSchema.safeParse(
    Array.from(new Set(formData.getAll("riskIds").map((value) => String(value)))),
  );
}

function parseControlLinks(formData: FormData) {
  return thirdPartyControlLinkIdsSchema.safeParse(
    Array.from(new Set(formData.getAll("controlIds").map((value) => String(value)))),
  );
}

function parseActionLinks(formData: FormData) {
  return thirdPartyActionLinkIdsSchema.safeParse(
    Array.from(new Set(formData.getAll("actionPlanIds").map((value) => String(value)))),
  );
}

function parseReviewPayload(formData: FormData) {
  return thirdPartyReviewFormSchema.safeParse({
    thirdPartyId: formData.get("thirdPartyId"),
    reviewDate: formData.get("reviewDate"),
    reviewerProfileId: formData.get("reviewerProfileId"),
    assessmentStatus: formData.get("assessmentStatus"),
    assessmentScore: formData.get("assessmentScore"),
    nextReviewDate: formData.get("nextReviewDate"),
    notes: formData.get("notes"),
  });
}

async function replaceRiskLinks(thirdPartyId: string, riskIds: string[]) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("third_party_risks")
    .delete()
    .eq("third_party_id", thirdPartyId);

  if (deleteError) {
    return deleteError.message;
  }

  if (riskIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("third_party_risks").insert(
    riskIds.map((riskId) => ({
      third_party_id: thirdPartyId,
      risk_id: riskId,
    })),
  );

  return insertError ? insertError.message : null;
}

async function replaceControlLinks(thirdPartyId: string, controlIds: string[]) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("third_party_controls")
    .delete()
    .eq("third_party_id", thirdPartyId);

  if (deleteError) {
    return deleteError.message;
  }

  if (controlIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("third_party_controls").insert(
    controlIds.map((controlId) => ({
      third_party_id: thirdPartyId,
      control_id: controlId,
    })),
  );

  return insertError ? insertError.message : null;
}

async function replaceActionLinks(thirdPartyId: string, actionPlanIds: string[]) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("third_party_actions")
    .delete()
    .eq("third_party_id", thirdPartyId);

  if (deleteError) {
    return deleteError.message;
  }

  if (actionPlanIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("third_party_actions").insert(
    actionPlanIds.map((actionPlanId) => ({
      third_party_id: thirdPartyId,
      action_plan_id: actionPlanId,
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

async function validateReviewerProfile(reviewerProfileId: string | null, organizationId: string) {
  if (!reviewerProfileId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", reviewerProfileId)
    .eq("organization_id", organizationId)
    .maybeSingle<IdRow>();

  return data ? null : "Selected reviewer does not exist.";
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

async function validateActiveActions(actionPlanIds: string[], organizationId: string) {
  if (actionPlanIds.length === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("action_plans")
    .select("id")
    .in("id", actionPlanIds)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .returns<IdRow[]>();

  return (data ?? []).length === actionPlanIds.length
    ? null
    : "One or more linked action plans no longer exist or are archived.";
}

async function ensureThirdPartyExists(thirdPartyId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_parties")
    .select("id")
    .eq("id", thirdPartyId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Third-party record was not found.";
}

export async function createThirdPartyAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseThirdPartyPayload(formData);
  const riskLinks = parseRiskLinks(formData);
  const controlLinks = parseControlLinks(formData);
  const actionLinks = parseActionLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted third-party fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  if (!actionLinks.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(actionLinks.error.issues[0]?.message, "Linked action values are invalid.")}`,
    );
  }

  const [ownerError, riskError, controlError, actionError] = await Promise.all([
    validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId),
    validateActiveRisks(riskLinks.data, profile.organizationId),
    validateActiveControls(controlLinks.data, profile.organizationId),
    validateActiveActions(actionLinks.data, profile.organizationId),
  ]);

  if (ownerError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(ownerError)}`);
  }

  if (riskError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(riskError)}`);
  }

  if (controlError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(controlError)}`);
  }

  if (actionError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(actionError)}`);
  }

  const mutation = {
    ...buildThirdPartyMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("third_parties")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(error?.message, "Could not create third-party record.")}`,
    );
  }

  const [riskLinkError, controlLinkError, actionLinkError] = await Promise.all([
    replaceRiskLinks(data.id, riskLinks.data),
    replaceControlLinks(data.id, controlLinks.data),
    replaceActionLinks(data.id, actionLinks.data),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/third-parties/${data.id}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(`/dashboard/third-parties/${data.id}?error=${encodeMessage(controlLinkError)}`);
  }

  if (actionLinkError) {
    redirect(`/dashboard/third-parties/${data.id}?error=${encodeMessage(actionLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "third_party",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      name: mutation.name,
      service: mutation.service,
      criticality: mutation.criticality,
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
      linked_actions: actionLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${data.id}`);
}

export async function updateThirdPartyAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));

  if (!thirdPartyIdResult.success) {
    redirect("/dashboard/third-parties?error=invalid_id");
  }

  const parsed = parseThirdPartyPayload(formData);
  const riskLinks = parseRiskLinks(formData);
  const controlLinks = parseControlLinks(formData);
  const actionLinks = parseActionLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted third-party fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  if (!actionLinks.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(actionLinks.error.issues[0]?.message, "Linked action values are invalid.")}`,
    );
  }

  const [existingError, ownerError, riskError, controlError, actionError] = await Promise.all([
    ensureThirdPartyExists(thirdPartyIdResult.data, profile.organizationId),
    validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId),
    validateActiveRisks(riskLinks.data, profile.organizationId),
    validateActiveControls(controlLinks.data, profile.organizationId),
    validateActiveActions(actionLinks.data, profile.organizationId),
  ]);

  if (existingError) {
    redirect(`/dashboard/third-parties?error=${encodeMessage(existingError)}`);
  }

  if (ownerError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(ownerError)}`);
  }

  if (riskError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(riskError)}`);
  }

  if (controlError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(controlError)}`);
  }

  if (actionError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(actionError)}`);
  }

  const mutation = buildThirdPartyMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("third_parties")
    .update(mutation)
    .eq("id", thirdPartyIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const [riskLinkError, controlLinkError, actionLinkError] = await Promise.all([
    replaceRiskLinks(thirdPartyIdResult.data, riskLinks.data),
    replaceControlLinks(thirdPartyIdResult.data, controlLinks.data),
    replaceActionLinks(thirdPartyIdResult.data, actionLinks.data),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(controlLinkError)}`);
  }

  if (actionLinkError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(actionLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "third_party",
    entityId: thirdPartyIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      service: mutation.service,
      criticality: mutation.criticality,
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
      linked_actions: actionLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}`);
}

export async function archiveThirdPartyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));

  if (!thirdPartyIdResult.success) {
    redirect("/dashboard/third-parties?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("third_parties")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", thirdPartyIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "third_party",
    entityId: thirdPartyIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/third-parties");
}

export async function createThirdPartyReviewAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseReviewPayload(formData);

  if (!parsed.success) {
    const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));
    const path = thirdPartyIdResult.success
      ? `/dashboard/third-parties/${thirdPartyIdResult.data}`
      : "/dashboard/third-parties";
    redirect(
      `${path}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted review fields are invalid.")}`,
    );
  }

  const reviewerProfileId = parsed.data.reviewerProfileId ?? profile.id;

  const [thirdPartyError, reviewerError] = await Promise.all([
    ensureThirdPartyExists(parsed.data.thirdPartyId, profile.organizationId),
    validateReviewerProfile(reviewerProfileId, profile.organizationId),
  ]);

  if (thirdPartyError) {
    redirect(`/dashboard/third-parties?error=${encodeMessage(thirdPartyError)}`);
  }

  if (reviewerError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(reviewerError)}`);
  }

  const mutation = buildThirdPartyReviewMutation(
    {
      ...parsed.data,
      reviewerProfileId,
    },
    profile.id,
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("third_party_reviews")
    .insert({
      ...mutation,
      organization_id: profile.organizationId,
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(error?.message, "Could not create review.")}`,
    );
  }

  const reviewTimestamp = `${mutation.review_date}T00:00:00.000Z`;
  const { error: syncError } = await supabase
    .from("third_parties")
    .update({
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
      last_reviewed_at: reviewTimestamp,
      updated_by: profile.id,
    })
    .eq("id", mutation.third_party_id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (syncError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(syncError.message)}`);
  }

  await recordAuditEvent({
    entityType: "third_party_review",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      third_party_id: mutation.third_party_id,
      review_date: mutation.review_date,
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
    },
  }).catch(() => undefined);

  await recordAuditEvent({
    entityType: "third_party",
    entityId: mutation.third_party_id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
      last_reviewed_at: reviewTimestamp,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?success=review_created`);
}
