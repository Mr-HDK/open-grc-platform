"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { buildRiskMutation, riskFormSchema, riskIdSchema } from "@/lib/validators/risk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function parseRiskPayload(formData: FormData) {
  return riskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    impact: formData.get("impact"),
    likelihood: formData.get("likelihood"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
  });
}

export async function createRiskAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseRiskPayload(formData);

  if (!parsed.success) {
    redirect(`/dashboard/risks/new?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid risk payload")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("risks")
    .insert({
      ...buildRiskMutation(parsed.data, profile.id),
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(`/dashboard/risks/new?error=${encodeMessage(error?.message ?? "Could not create risk")}`);
  }

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
    redirect(`/dashboard/risks/${riskIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid risk payload")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("risks")
    .update(buildRiskMutation(parsed.data, profile.id))
    .eq("id", riskIdResult.data)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/risks/${riskIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  redirect(`/dashboard/risks/${riskIdResult.data}`);
}

export async function archiveRiskAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const riskIdResult = riskIdSchema.safeParse(formData.get("riskId"));

  if (!riskIdResult.success) {
    redirect("/dashboard/risks?error=invalid_id");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("risks")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", riskIdResult.data)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/risks/${riskIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  redirect("/dashboard/risks");
}
