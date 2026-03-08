import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { hasRole, isRole, type Role } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PROFILE_COLUMNS = "id, email, full_name, role";

export type SessionProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

function normalizeProfile(row: ProfileRow): SessionProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: isRole(row.role) ? row.role : "viewer",
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

  return data ? normalizeProfile(data) : null;
}

export async function getSessionProfile() {
  return ensureProfileFromUser();
}

export async function requireSessionProfile(requiredRole: Role = "viewer") {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login?error=profile_missing");
  }

  if (!hasRole(requiredRole, profile.role)) {
    redirect("/dashboard?error=forbidden");
  }

  return profile;
}
