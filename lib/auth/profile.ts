import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { hasRole, isRole, type Role } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PROFILE_COLUMNS = "id, email, full_name, role, organization_id, status";

export type SessionProfile = {
  id: string;
  email: string;
  fullName: string | null;
  organizationId: string;
  role: Role;
  status: ProfileStatus;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  role: string;
  status?: string | null;
};

type ProfileStatus = "active" | "invited" | "deactivated";

function normalizeProfileStatus(
  status: string | null | undefined,
): ProfileStatus {
  if (status === "invited" || status === "deactivated") {
    return status;
  }

  return "active";
}

function normalizeProfile(row: ProfileRow): SessionProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    organizationId: row.organization_id ?? row.id,
    role: isRole(row.role) ? row.role : "viewer",
    status: normalizeProfileStatus(row.status),
  };
}

async function ensureProfileFromUser() {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const email = user.email ?? `${user.id}@local.test`;
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
    },
    { onConflict: "id" },
  );

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!data) {
    return null;
  }

  let profileRow = data;

  if (data.status === "invited") {
    await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", user.id);
    profileRow = { ...data, status: "active" };
  }

  if (profileRow.organization_id) {
    return normalizeProfile(profileRow);
  }

  // Self-heal legacy rows with null organization_id when organizations table exists.
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!org?.id) {
    return normalizeProfile(profileRow);
  }

  await supabase
    .from("profiles")
    .update({ organization_id: org.id })
    .eq("id", user.id);

  const { data: refreshed } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  return refreshed ? normalizeProfile(refreshed) : normalizeProfile(profileRow);
}

export async function getSessionProfile() {
  return ensureProfileFromUser();
}

export async function requireSessionProfile(requiredRole: Role = "viewer") {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login?error=profile_missing");
  }

  if (profile.status !== "active") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect(
      profile.status === "deactivated"
        ? "/login?error=account_deactivated"
        : "/login?error=account_inactive",
    );
  }

  if (!hasRole(requiredRole, profile.role)) {
    redirect("/dashboard?error=forbidden");
  }

  return profile;
}
