import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { dayDifferenceFromToday, getIssueAgeDays, isIssueOverdue } from "@/lib/issues/aging";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isIssueSeverity,
  isIssueStatus,
  isIssueType,
  issueSeverityOptions,
  issueStatusOptions,
  issueTypeOptions,
  type IssueSeverity,
  type IssueStatus,
  type IssueType,
} from "@/lib/validators/issue";
import { cn } from "@/lib/utils/cn";

type IssueListRow = {
  id: string;
  title: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  owner_profile_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function formatIssueTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    issueType?: string;
    status?: string;
    severity?: string;
    ownerId?: string;
    overdue?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const issueType = isIssueType(params.issueType) ? params.issueType : "";
  const status = isIssueStatus(params.status) ? params.status : "";
  const severity = isIssueSeverity(params.severity) ? params.severity : "";
  const ownerId = z.string().uuid().safeParse(params.ownerId).success ? (params.ownerId ?? "") : "";
  const overdueOnly = params.overdue === "true";

  let query = supabase
    .from("issues")
    .select("id, title, issue_type, severity, status, owner_profile_id, due_date, created_at, updated_at")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (issueType) {
    query = query.eq("issue_type", issueType);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  if (ownerId) {
    query = query.eq("owner_profile_id", ownerId);
  }

  const [{ data: issues, error }, { data: owners }] = await Promise.all([
    query.returns<IssueListRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
  ]);

  const ownerById = new Map(
    (owners ?? []).map((owner) => [
      owner.id,
      owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
    ]),
  );

  const filteredIssues = (issues ?? []).filter((issue) => {
    if (!overdueOnly) {
      return true;
    }
    return isIssueOverdue({
      status: issue.status,
      dueDate: issue.due_date,
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground">
            Unified register for findings, exceptions, and remediation follow-up.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/issues/new" className={buttonVariants()}>
            New issue
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6">
        <select
          name="issueType"
          aria-label="Filter by issue type"
          defaultValue={issueType}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {issueTypeOptions.map((option) => (
            <option key={option} value={option}>
              {formatIssueTypeLabel(option)}
            </option>
          ))}
        </select>

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {issueStatusOptions.map((option) => (
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
          {issueSeverityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="ownerId"
          aria-label="Filter by owner"
          defaultValue={ownerId}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All owners</option>
          {(owners ?? []).map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email}
            </option>
          ))}
        </select>

        <select
          name="overdue"
          aria-label="Filter overdue issues"
          defaultValue={overdueOnly ? "true" : ""}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All due dates</option>
          <option value="true">Overdue only</option>
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <caption className="sr-only">Issues results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Type
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
                Aging
              </th>
              <th scope="col" className="px-4 py-3">
                Due
              </th>
              <th scope="col" className="px-4 py-3">
                Delay
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue) => {
              const ageDays = getIssueAgeDays(issue.created_at);
              const overdue = isIssueOverdue({
                status: issue.status,
                dueDate: issue.due_date,
              });
              const dueDelta = issue.due_date ? dayDifferenceFromToday(issue.due_date) : null;

              return (
                <tr key={issue.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/issues/${issue.id}`} className="font-medium hover:underline">
                      {issue.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {formatIssueTypeLabel(issue.issue_type)}
                  </td>
                  <td className="px-4 py-3 capitalize">{issue.status}</td>
                  <td className="px-4 py-3 capitalize">{issue.severity}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {issue.owner_profile_id ? ownerById.get(issue.owner_profile_id) ?? "Unknown" : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ageDays}d</td>
                  <td className="px-4 py-3 text-muted-foreground">{issue.due_date ?? "-"}</td>
                  <td
                    className={cn(
                      "px-4 py-3",
                      overdue
                        ? "text-red-700"
                        : dueDelta !== null && !["resolved", "closed"].includes(issue.status) && dueDelta <= 7
                          ? "text-amber-700"
                          : "text-muted-foreground",
                    )}
                  >
                    {overdue
                      ? `Overdue ${Math.abs(dueDelta ?? 0)}d`
                      : dueDelta !== null && !["resolved", "closed"].includes(issue.status)
                        ? `${dueDelta}d left`
                        : "-"}
                  </td>
                </tr>
              );
            })}

            {!error && filteredIssues.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                  No issues found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
