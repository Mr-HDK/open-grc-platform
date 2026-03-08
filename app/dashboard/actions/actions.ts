"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  actionPlanFormSchema,
  actionPlanIdSchema,
  buildActionPlanMutation,
} from "@/lib/validators/action-plan";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
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

export async function createActionPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseActionPlanPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/actions/new?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid action plan payload")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("action_plans")
    .insert({
      ...buildActionPlanMutation(parsed.data, profile.id),
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/actions/new?error=${encodeMessage(error?.message ?? "Could not create action plan")}`,
    );
  }

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
      `/dashboard/actions/${actionPlanIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid action plan payload")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("action_plans")
    .update(buildActionPlanMutation(parsed.data, profile.id))
    .eq("id", actionPlanIdResult.data)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/actions/${actionPlanIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  redirect(`/dashboard/actions/${actionPlanIdResult.data}`);
}

export async function archiveActionPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const actionPlanIdResult = actionPlanIdSchema.safeParse(formData.get("actionPlanId"));

  if (!actionPlanIdResult.success) {
    redirect("/dashboard/actions?error=invalid_id");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("action_plans")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", actionPlanIdResult.data)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/actions/${actionPlanIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  redirect("/dashboard/actions");
}
