"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildControlReviewMutation,
  controlReviewFormSchema,
  controlReviewIdSchema,
} from "@/lib/validators/control-review";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseControlReviewPayload(formData: FormData) {
  return controlReviewFormSchema.safeParse({
    controlId: formData.get("controlId"),
    status: formData.get("status"),
    targetDate: formData.get("targetDate"),
    reviewerProfileId: formData.get("reviewerProfileId"),
    notes: formData.get("notes"),
  });
}

type IdRow = { id: string };

type ControlReviewRow = {
  id: string;
  completed_at: string | null;
};

async function validateControlReviewReferences(input: {
  controlId: string;
  reviewerProfileId: string | null;
}, organizationId: string) {
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

  if (input.reviewerProfileId) {
    const { data: reviewer } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", input.reviewerProfileId)
      .eq("organization_id", organizationId)
      .maybeSingle<IdRow>();

    if (!reviewer) {
      return "Selected reviewer does not exist.";
    }
  }

  return null;
}

export async function createControlReviewAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseControlReviewPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/control-reviews/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted review fields are invalid.")}`,
    );
  }

  const referenceError = await validateControlReviewReferences(parsed.data, profile.organizationId);
  if (referenceError) {
    redirect(`/dashboard/control-reviews/new?error=${encodeMessage(referenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildControlReviewMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
    completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("control_reviews")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/control-reviews/new?error=${encodeMessage(error?.message, "Could not create control review.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "control_review",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      target_date: mutation.target_date,
      control_id: mutation.control_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/control-reviews/${data.id}`);
}

export async function updateControlReviewAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const reviewIdResult = controlReviewIdSchema.safeParse(formData.get("reviewId"));

  if (!reviewIdResult.success) {
    redirect("/dashboard/control-reviews?error=invalid_id");
  }

  const parsed = parseControlReviewPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/control-reviews/${reviewIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted review fields are invalid.")}`,
    );
  }

  const referenceError = await validateControlReviewReferences(parsed.data, profile.organizationId);
  if (referenceError) {
    redirect(`/dashboard/control-reviews/${reviewIdResult.data}/edit?error=${encodeMessage(referenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingReview } = await supabase
    .from("control_reviews")
    .select("id, completed_at")
    .eq("id", reviewIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlReviewRow>();

  if (!existingReview) {
    redirect(`/dashboard/control-reviews?error=${encodeMessage("Review not found.")}`);
  }

  const mutation = buildControlReviewMutation(parsed.data, profile.id);
  const completedAt =
    mutation.status === "completed"
      ? existingReview.completed_at ?? new Date().toISOString()
      : null;

  const { error } = await supabase
    .from("control_reviews")
    .update({
      ...mutation,
      completed_at: completedAt,
    })
    .eq("id", reviewIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/control-reviews/${reviewIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "control_review",
    entityId: reviewIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      target_date: mutation.target_date,
      control_id: mutation.control_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/control-reviews/${reviewIdResult.data}`);
}

export async function archiveControlReviewAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const reviewIdResult = controlReviewIdSchema.safeParse(formData.get("reviewId"));

  if (!reviewIdResult.success) {
    redirect("/dashboard/control-reviews?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("control_reviews")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", reviewIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/control-reviews/${reviewIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "control_review",
    entityId: reviewIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/control-reviews");
}
