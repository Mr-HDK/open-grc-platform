import {
  inviteUserAction,
  transferOrganizationOwnershipAction,
  updateProfileRoleAction,
  updateProfileStatusAction,
} from "@/app/dashboard/settings/actions";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { type Role } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ProfileStatus } from "@/lib/validators/profile-admin";

type ProfileRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string;
  role: Role;
  status: ProfileStatus | null;
  invited_at: string | null;
  deactivated_at: string | null;
  created_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  owner_profile_id: string | null;
};

const roleOptions: Role[] = ["admin", "manager", "contributor", "viewer"];

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-slate-900 text-white",
  manager: "bg-slate-200 text-slate-900",
  contributor: "bg-sky-100 text-sky-700",
  viewer: "bg-zinc-100 text-zinc-700",
};

const statusBadgeClass: Record<ProfileStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  invited: "bg-amber-100 text-amber-700",
  deactivated: "bg-rose-100 text-rose-700",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; target?: string; state?: string }>;
}) {
  const actor = await requireSessionProfile("admin");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, owner_profile_id")
    .eq("id", actor.organizationId)
    .maybeSingle<OrganizationRow>();

  const { data } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, email, role, status, invited_at, deactivated_at, created_at")
    .eq("organization_id", actor.organizationId)
    .order("email")
    .returns<ProfileRow[]>();

  const profiles = data ?? [];
  const ownerProfile = organization?.owner_profile_id
    ? profiles.find((profile) => profile.id === organization.owner_profile_id)
    : null;
  const eligibleOwners = profiles.filter(
    (profile) =>
      profile.role === "admin" &&
      profile.status !== "deactivated" &&
      profile.id !== organization?.owner_profile_id,
  );
  const successTarget = params.target ? decodeURIComponent(params.target) : null;
  const successState = params.state ? decodeURIComponent(params.state) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Admin-only area for profile and permission administration.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}
      {params.success === "role" && successTarget ? (
        <FeedbackAlert variant="success" title="Role updated." message={`Updated role for ${successTarget}.`} />
      ) : null}
      {params.success === "invite" && successTarget ? (
        <FeedbackAlert
          variant="success"
          title="Invite sent."
          message={`Invitation sent to ${successTarget}.`}
        />
      ) : null}
      {params.success === "status" && successTarget ? (
        <FeedbackAlert
          variant="success"
          title={successState === "deactivated" ? "User deactivated." : "User reactivated."}
          message={`Updated status for ${successTarget}.`}
        />
      ) : null}
      {params.success === "owner" && successTarget ? (
        <FeedbackAlert
          variant="success"
          title="Ownership transferred."
          message={`Organization owner set to ${successTarget}.`}
        />
      ) : null}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Organization</h2>
        <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">{organization?.name ?? "Organization"}</p>
            <p className="text-xs text-muted-foreground">
              Owner: {ownerProfile?.full_name ?? ownerProfile?.email ?? "Unassigned"}
            </p>
          </div>
          {eligibleOwners.length > 0 ? (
            <form action={transferOrganizationOwnershipAction} className="flex flex-wrap items-center gap-2">
              <label htmlFor="owner-profile" className="sr-only">
                Transfer owner
              </label>
              <select
                id="owner-profile"
                name="profileId"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Select new owner
                </option>
                {eligibleOwners.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.email}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium"
              >
                Transfer ownership
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              No eligible admin available for ownership transfer.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">User lifecycle</h2>
        <form action={inviteUserAction} className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-name">
              Full name
            </label>
            <input
              id="invite-name"
              name="fullName"
              type="text"
              placeholder="Jane Doe"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="jane@company.com"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              defaultValue="viewer"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium"
            >
              Send invite
            </button>
          </div>
        </form>
      </section>

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
                <th className="border-b px-3 py-2">Status</th>
                <th className="border-b px-3 py-2">Lifecycle</th>
                <th className="border-b px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const isCurrentAdmin = profile.id === actor.id;
                const isOrgOwner = profile.id === organization?.owner_profile_id;
                const status = (profile.status ?? "active") as ProfileStatus;
                const statusDate =
                  status === "invited"
                    ? profile.invited_at
                    : status === "deactivated"
                      ? profile.deactivated_at
                      : null;

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
                    <td className="border-b px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass[status]}`}
                      >
                        {status}
                      </span>
                      {statusDate ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(statusDate).toLocaleDateString()}
                        </p>
                      ) : null}
                    </td>
                    <td className="border-b px-3 py-3">
                      {isCurrentAdmin ? (
                        <span className="text-xs text-muted-foreground">Current signed-in admin</span>
                      ) : isOrgOwner ? (
                        <span className="text-xs text-muted-foreground">Organization owner</span>
                      ) : (
                        <form action={updateProfileStatusAction}>
                          <input type="hidden" name="profileId" value={profile.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={status === "deactivated" ? "active" : "deactivated"}
                          />
                          <button
                            type="submit"
                            className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-medium"
                          >
                            {status === "deactivated" ? "Reactivate" : "Deactivate"}
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
