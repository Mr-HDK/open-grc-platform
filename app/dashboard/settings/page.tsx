import { updateProfileRoleAction } from "@/app/dashboard/settings/actions";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { type Role } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string;
  role: Role;
  created_at: string;
};

const roleOptions: Role[] = ["admin", "manager", "contributor", "viewer"];

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-slate-900 text-white",
  manager: "bg-slate-200 text-slate-900",
  contributor: "bg-sky-100 text-sky-700",
  viewer: "bg-zinc-100 text-zinc-700",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const actor = await requireSessionProfile("admin");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, email, role, created_at")
    .eq("organization_id", actor.organizationId)
    .order("email")
    .returns<ProfileRow[]>();

  const profiles = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Admin-only area for profile and permission administration.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}
      {params.success ? (
        <FeedbackAlert
          variant="success"
          title="Role updated."
          message={`Updated role for ${decodeURIComponent(params.success)}.`}
        />
      ) : null}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Profile administration
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="border-b px-3 py-2">Name</th>
                <th className="border-b px-3 py-2">Email</th>
                <th className="border-b px-3 py-2">Current role</th>
                <th className="border-b px-3 py-2">Role assignment</th>
                <th className="border-b px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const isCurrentAdmin = profile.id === actor.id;

                return (
                  <tr key={profile.id} data-email={profile.email}>
                    <td className="border-b px-3 py-3">
                      <p className="font-medium">{profile.full_name ?? "No name"}</p>
                    </td>
                    <td className="border-b px-3 py-3">{profile.email}</td>
                    <td className="border-b px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${roleBadgeClass[profile.role]}`}
                      >
                        {profile.role}
                      </span>
                    </td>
                    <td className="border-b px-3 py-3">
                      {isCurrentAdmin ? (
                        <span className="text-xs text-muted-foreground">Current signed-in admin</span>
                      ) : (
                        <form action={updateProfileRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="profileId" value={profile.id} />
                          <label htmlFor={`role-${profile.id}`} className="sr-only">
                            Role
                          </label>
                          <select
                            id={`role-${profile.id}`}
                            name="role"
                            defaultValue={profile.role}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium"
                          >
                            Save
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="border-b px-3 py-3 text-xs text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
