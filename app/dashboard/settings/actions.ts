"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfileRoleSchema } from "@/lib/validators/profile-admin";

type ProfileRoleRow = {
  id: string;
  email: string;
  organization_id: string;
};

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

export async function updateProfileRoleAction(formData: FormData) {
  const actor = await requireSessionProfile("admin");

  const parsed = updateProfileRoleSchema.safeParse({
    profileId: formData.get("profileId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/settings?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("id, email, organization_id")
    .eq("id", parsed.data.profileId)
    .maybeSingle<ProfileRoleRow>();

  if (targetProfileError || !targetProfile) {
    redirect(
      `/dashboard/settings?error=${encodeMessage(targetProfileError?.message ?? "Profile not found.")}`,
    );
  }

  if (targetProfile.organization_id !== actor.organizationId) {
    redirect(`/dashboard/settings?error=${encodeMessage("Profile is not in your organization.")}`);
  }

  if (targetProfile.id === actor.id) {
    redirect(`/dashboard/settings?error=${encodeMessage("You cannot change your own role.")}`);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.profileId);

  if (updateError) {
    redirect(`/dashboard/settings?error=${encodeMessage(updateError.message)}`);
  }

  redirect(`/dashboard/settings?success=${encodeURIComponent(targetProfile.email)}`);
}
