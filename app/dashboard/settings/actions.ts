"use server";

import { redirect } from "next/navigation";

import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import {
  inviteUserSchema,
  transferOwnershipSchema,
  updateProfileRoleSchema,
  updateProfileStatusSchema,
} from "@/lib/validators/profile-admin";

type ProfileRoleRow = {
  id: string;
  email: string;
  organization_id: string;
  role?: string | null;
  status?: string | null;
};

type OrganizationRow = {
  id: string;
  owner_profile_id: string | null;
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

  redirect(`/dashboard/settings?success=role&target=${encodeURIComponent(targetProfile.email)}`);
}

export async function inviteUserAction(formData: FormData) {
  const actor = await requireSessionProfile("admin");

  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/settings?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, organization_id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle<ProfileRoleRow>();

  if (existingProfile?.organization_id === actor.organizationId) {
    redirect(`/dashboard/settings?error=${encodeMessage("User already exists in your organization.")}`);
  }

  if (existingProfile?.organization_id && existingProfile.organization_id !== actor.organizationId) {
    redirect(`/dashboard/settings?error=${encodeMessage("User belongs to another organization.")}`);
  }

  const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: parsed.data.fullName ? { full_name: parsed.data.fullName.trim() } : {},
  });

  if (inviteResult.error) {
    redirect(`/dashboard/settings?error=${encodeMessage(inviteResult.error.message)}`);
  }

  const invitedUserId = inviteResult.data?.user?.id;

  if (!invitedUserId) {
    redirect(`/dashboard/settings?error=${encodeMessage("Invite could not be created.")}`);
  }

  const now = new Date().toISOString();

  const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: invitedUserId,
      email: normalizedEmail,
      full_name: parsed.data.fullName?.trim() || null,
      role: parsed.data.role,
      organization_id: actor.organizationId,
      status: "invited",
      invited_at: now,
      invited_by: actor.id,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    redirect(`/dashboard/settings?error=${encodeMessage(upsertError.message)}`);
  }

  redirect(`/dashboard/settings?success=invite&target=${encodeURIComponent(normalizedEmail)}`);
}

export async function updateProfileStatusAction(formData: FormData) {
  const actor = await requireSessionProfile("admin");

  const parsed = updateProfileStatusSchema.safeParse({
    profileId: formData.get("profileId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/settings?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, organization_id, role, status")
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
    redirect(`/dashboard/settings?error=${encodeMessage("You cannot change your own status.")}`);
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id, owner_profile_id")
    .eq("id", actor.organizationId)
    .maybeSingle<OrganizationRow>();

  if (organization?.owner_profile_id === targetProfile.id) {
    redirect(
      `/dashboard/settings?error=${encodeMessage(
        "Transfer organization ownership before changing this user.",
      )}`,
    );
  }

  if (parsed.data.status === "invited") {
    redirect(`/dashboard/settings?error=${encodeMessage("Invite status cannot be set manually.")}`);
  }

  if (parsed.data.status === "deactivated") {
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(targetProfile.id, {
      ban_duration: "876000h",
    });

    if (banError) {
      redirect(`/dashboard/settings?error=${encodeMessage(banError.message)}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        status: "deactivated",
        deactivated_at: new Date().toISOString(),
        deactivated_by: actor.id,
      })
      .eq("id", targetProfile.id);

    if (updateError) {
      redirect(`/dashboard/settings?error=${encodeMessage(updateError.message)}`);
    }

    redirect(
      `/dashboard/settings?success=status&state=deactivated&target=${encodeURIComponent(
        targetProfile.email,
      )}`,
    );
  }

  const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(targetProfile.id, {
    ban_duration: "none",
  });

  if (unbanError) {
    redirect(`/dashboard/settings?error=${encodeMessage(unbanError.message)}`);
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      status: "active",
      deactivated_at: null,
      deactivated_by: null,
    })
    .eq("id", targetProfile.id);

  if (updateError) {
    redirect(`/dashboard/settings?error=${encodeMessage(updateError.message)}`);
  }

  redirect(
    `/dashboard/settings?success=status&state=active&target=${encodeURIComponent(
      targetProfile.email,
    )}`,
  );
}

export async function transferOrganizationOwnershipAction(formData: FormData) {
  const actor = await requireSessionProfile("admin");

  const parsed = transferOwnershipSchema.safeParse({
    profileId: formData.get("profileId"),
  });

  if (!parsed.success) {
    redirect(`/dashboard/settings?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .select("id, owner_profile_id")
    .eq("id", actor.organizationId)
    .maybeSingle<OrganizationRow>();

  if (organizationError || !organization) {
    redirect(
      `/dashboard/settings?error=${encodeMessage(
        organizationError?.message ?? "Organization not found.",
      )}`,
    );
  }

  if (organization.owner_profile_id && organization.owner_profile_id !== actor.id) {
    redirect(`/dashboard/settings?error=${encodeMessage("Only the organization owner can transfer.")}`);
  }

  if (parsed.data.profileId === actor.id) {
    redirect(`/dashboard/settings?error=${encodeMessage("You already own this organization.")}`);
  }

  const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, organization_id, role, status")
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

  if (targetProfile.role !== "admin") {
    redirect(`/dashboard/settings?error=${encodeMessage("Ownership can only be transferred to an admin.")}`);
  }

  if (targetProfile.status === "deactivated") {
    redirect(`/dashboard/settings?error=${encodeMessage("Cannot transfer ownership to a deactivated user.")}`);
  }

  const { error: updateError } = await supabaseAdmin
    .from("organizations")
    .update({ owner_profile_id: targetProfile.id })
    .eq("id", actor.organizationId);

  if (updateError) {
    redirect(`/dashboard/settings?error=${encodeMessage(updateError.message)}`);
  }

  redirect(`/dashboard/settings?success=owner&target=${encodeURIComponent(targetProfile.email)}`);
}
