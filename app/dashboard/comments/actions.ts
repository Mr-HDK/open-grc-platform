"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCommentSchema } from "@/lib/validators/comment";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

async function assertEntityExists(
  entityType: "risk" | "control" | "action_plan",
  entityId: string,
  organizationId: string,
) {
  const supabase = await createSupabaseServerClient();

  if (entityType === "risk") {
    const { data } = await supabase
      .from("risks")
      .select("id, organization_id")
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; organization_id: string }>();

    return Boolean(data && data.organization_id === organizationId);
  }

  if (entityType === "control") {
    const { data } = await supabase
      .from("controls")
      .select("id, organization_id")
      .eq("id", entityId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; organization_id: string }>();

    return Boolean(data && data.organization_id === organizationId);
  }

  const { data } = await supabase
    .from("action_plans")
    .select("id, organization_id")
    .eq("id", entityId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; organization_id: string }>();

  return Boolean(data && data.organization_id === organizationId);
}

export async function createCommentAction(formData: FormData) {
  const actor = await requireSessionProfile("contributor");

  const parsed = createCommentSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(`/dashboard?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const exists = await assertEntityExists(
    parsed.data.entityType,
    parsed.data.entityId,
    actor.organizationId,
  );

  if (!exists) {
    redirect(`/dashboard?error=${encodeMessage("Comment target not found.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("comments").insert({
    organization_id: actor.organizationId,
    entity_type: parsed.data.entityType,
    entity_id: parsed.data.entityId,
    body: parsed.data.body,
    created_by: actor.id,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeMessage(error.message)}`);
  }

  const path =
    parsed.data.entityType === "risk"
      ? `/dashboard/risks/${parsed.data.entityId}`
      : parsed.data.entityType === "control"
        ? `/dashboard/controls/${parsed.data.entityId}`
        : `/dashboard/actions/${parsed.data.entityId}`;

  redirect(`${path}?success=comment`);
}
