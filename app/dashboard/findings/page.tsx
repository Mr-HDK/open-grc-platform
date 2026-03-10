import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findingSeverityOptions,
  findingStatusOptions,
  isFindingSeverity,
  isFindingStatus,
  type FindingSeverity,
  type FindingStatus,
} from "@/lib/validators/finding";
import { cn } from "@/lib/utils/cn";

type FindingRow = {
  id: string;
  title: string;
  status: FindingStatus;
  severity: FindingSeverity;
  due_date: string | null;
  owner_profile_id: string | null;
  control_id: string;
  updated_at: string;
};

type ControlRow = { id: string; code: string; title: string };
type OwnerRow = { id: string; email: string; full_name: string | null };

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; controlId?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const status = isFindingStatus(params.status) ? params.status : "";
  const severity = isFindingSeverity(params.severity) ? params.severity : "";
  const controlId = params.controlId?.trim() ?? "";

  let query = supabase
    .from("findings")
    .select("id, title, status, severity, due_date, owner_profile_id, control_id, updated_at")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  if (controlId) {
    query = query.eq("control_id", controlId);
  }

  const [{ data: findings, error }, { data: controls }, { data: owners }] = await Promise.all([
    query.returns<FindingRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .returns<OwnerRow[]>(),
  ]);
  const controlById = new Map((controls ?? []).map((control) => [control.id, `${control.code} - ${control.title}`]));
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
          <h1 className="text-2xl font-semibold tracking-tight">Findings</h1>
          <p className="text-sm text-muted-foreground">
            Track control deficiencies and remediation progress.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/findings/new" className={buttonVariants()}>
            New finding
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {findingStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="severity"
          aria-label="Filter by severity"
          defaultValue={severity}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All severities</option>
          {findingSeverityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="controlId"
          aria-label="Filter by control"
          defaultValue={controlId}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All controls</option>
          {(controls ?? []).map((control) => (
            <option key={control.id} value={control.id}>
              {control.code} - {control.title}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Findings results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Control
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Severity
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Due
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(findings ?? []).map((finding) => (
              <tr key={finding.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/findings/${finding.id}`}
                    className="font-medium hover:underline"
                  >
                    {finding.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {controlById.get(finding.control_id) ?? "Unknown control"}
                </td>
                <td className="px-4 py-3 capitalize">{finding.status}</td>
                <td className="px-4 py-3 capitalize">{finding.severity}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {finding.owner_profile_id ? ownerById.get(finding.owner_profile_id) ?? "Unknown" : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{finding.due_date ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(finding.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (findings?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No findings found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
