import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { incidentStatusOptions } from "@/lib/validators/incident";
import { cn } from "@/lib/utils/cn";

type IncidentRow = {
  id: string;
  title: string;
  status: string;
  risk_id: string | null;
  action_plan_id: string | null;
  owner_profile_id: string | null;
  occurred_at: string | null;
  updated_at: string;
};

type RiskRow = { id: string; title: string };

type ActionRow = { id: string; title: string };

type OwnerRow = { id: string; email: string; full_name: string | null };

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = incidentStatusOptions.includes(params.status as (typeof incidentStatusOptions)[number])
    ? (params.status ?? "")
    : "";

  let query = supabase
    .from("incidents")
    .select("id, title, status, risk_id, action_plan_id, owner_profile_id, occurred_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const [{ data: incidents, error }, { data: risks }, { data: actions }, { data: owners }] =
    await Promise.all([
      query.returns<IncidentRow[]>(),
      supabase.from("risks").select("id, title").is("deleted_at", null).returns<RiskRow[]>(),
      supabase
        .from("action_plans")
        .select("id, title")
        .is("deleted_at", null)
        .returns<ActionRow[]>(),
      supabase.from("profiles").select("id, email, full_name").order("email").returns<OwnerRow[]>(),
    ]);

  const riskById = new Map((risks ?? []).map((risk) => [risk.id, risk.title]));
  const actionById = new Map((actions ?? []).map((action) => [action.id, action.title]));
  const ownerById = new Map(
    (owners ?? []).map((owner) => [
      owner.id,
      owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident register</h1>
          <p className="text-sm text-muted-foreground">
            Track incidents and link them to risks and remediation actions.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/incidents/new" className={buttonVariants()}>
            New incident
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input name="q" placeholder="Search by title" defaultValue={q} />

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {incidentStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[780px] text-left text-sm">
          <caption className="sr-only">Incident register results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Risk
              </th>
              <th scope="col" className="px-4 py-3">
                Action plan
              </th>
              <th scope="col" className="px-4 py-3">
                Occurred
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(incidents ?? []).map((incident) => (
              <tr key={incident.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="font-medium hover:underline"
                  >
                    {incident.title}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{incident.status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {incident.owner_profile_id
                    ? ownerById.get(incident.owner_profile_id) ?? "Unknown"
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {incident.risk_id ? riskById.get(incident.risk_id) ?? "Unknown" : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {incident.action_plan_id
                    ? actionById.get(incident.action_plan_id) ?? "Unknown"
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{incident.occurred_at ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(incident.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (incidents?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No incidents found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
