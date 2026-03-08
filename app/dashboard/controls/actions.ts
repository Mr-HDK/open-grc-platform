"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildControlMutation,
  controlFormSchema,
  controlIdSchema,
  riskLinkIdsSchema,
} from "@/lib/validators/control";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function parseControlPayload(formData: FormData) {
  return controlFormSchema.safeParse({
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description"),
    controlType: formData.get("controlType"),
    reviewFrequency: formData.get("reviewFrequency"),
    effectivenessStatus: formData.get("effectivenessStatus"),
    ownerProfileId: formData.get("ownerProfileId"),
    nextReviewDate: formData.get("nextReviewDate"),
  });
}

function parseRiskLinks(formData: FormData) {
  const rawValues = formData.getAll("riskIds").map((value) => String(value));
  return riskLinkIdsSchema.safeParse(rawValues);
}

async function replaceRiskLinks(controlId: string, riskIds: string[]) {
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("risk_controls")
    .delete()
    .eq("control_id", controlId);

  if (deleteError) {
    return deleteError.message;
  }

  if (riskIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("risk_controls").insert(
    riskIds.map((riskId) => ({
      control_id: controlId,
      risk_id: riskId,
    })),
  );

  return insertError ? insertError.message : null;
}

export async function createControlAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const parsed = parseControlPayload(formData);
  const riskLinks = parseRiskLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/controls/new?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid control payload")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/controls/new?error=${encodeMessage(riskLinks.error.issues[0]?.message ?? "Invalid risk links")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("controls")
    .insert({
      ...buildControlMutation(parsed.data, profile.id),
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/controls/new?error=${encodeMessage(error?.message ?? "Could not create control")}`,
    );
  }

  const linkError = await replaceRiskLinks(data.id, riskLinks.data);

  if (linkError) {
    redirect(`/dashboard/controls/${data.id}?error=${encodeMessage(linkError)}`);
  }

  redirect(`/dashboard/controls/${data.id}`);
}

export async function updateControlAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const controlIdResult = controlIdSchema.safeParse(formData.get("controlId"));

  if (!controlIdResult.success) {
    redirect("/dashboard/controls?error=invalid_id");
  }

  const parsed = parseControlPayload(formData);
  const riskLinks = parseRiskLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/controls/${controlIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message ?? "Invalid control payload")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/controls/${controlIdResult.data}/edit?error=${encodeMessage(riskLinks.error.issues[0]?.message ?? "Invalid risk links")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("controls")
    .update(buildControlMutation(parsed.data, profile.id))
    .eq("id", controlIdResult.data)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/controls/${controlIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const linkError = await replaceRiskLinks(controlIdResult.data, riskLinks.data);

  if (linkError) {
    redirect(`/dashboard/controls/${controlIdResult.data}?error=${encodeMessage(linkError)}`);
  }

  redirect(`/dashboard/controls/${controlIdResult.data}`);
}

export async function archiveControlAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");

  const controlIdResult = controlIdSchema.safeParse(formData.get("controlId"));

  if (!controlIdResult.success) {
    redirect("/dashboard/controls?error=invalid_id");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("controls")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", controlIdResult.data)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/controls/${controlIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  redirect("/dashboard/controls");
}
