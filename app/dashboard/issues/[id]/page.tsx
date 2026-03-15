import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveIssueAction } from "@/app/dashboard/issues/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { dayDifferenceFromToday, getIssueAgeDays, isIssueOverdue } from "@/lib/issues/aging";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";

type IssueDetail = {
  id: string;
  title: string;
  description: string;
  issue_type: string;
  severity: string;
  status: string;
  owner_profile_id: string | null;
  due_date: string | null;
  root_cause: string | null;
  management_response: string | null;
  resolution_notes: string | null;
  source_finding_id: string | null;
  source_risk_acceptance_id: string | null;
  risk_id: string | null;
  control_id: string | null;
  action_plan_id: string | null;
  incident_id: string | null;
  policy_id: string | null;
  third_party_id: string | null;
  audit_engagement_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = { id: string; email: string; full_name: string | null };
type TitledRow = { id: string; title: string };
type ControlRow = { id: string; code: string; title: string };
type ThirdPartyRow = { id: string; name: string };
type RiskAcceptanceRow = { id: string; status: string; expiration_date: string };
type PolicyRow = { id: string; title: string; version: string };

function formatIssueTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

async function getIssue(issueId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("issues")
    .select(
      "id, title, description, issue_type, severity, status, owner_profile_id, due_date, root_cause, management_response, resolution_notes, source_finding_id, source_risk_acceptance_id, risk_id, control_id, action_plan_id, incident_id, policy_id, third_party_id, audit_engagement_id, created_at, updated_at",
    )
    .eq("id", issueId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IssueDetail>();

  return data;
}

export default async function IssueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);
  const { id } = await params;
  const query = await searchParams;
  const issue = await getIssue(id, profile.organizationId);

  if (!issue) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const [
    ownerResult,
    riskResult,
    controlResult,
    actionPlanResult,
    incidentResult,
    findingResult,
    riskAcceptanceResult,
    policyResult,
    thirdPartyResult,
    auditEngagementResult,
    auditEntries,
  ] = await Promise.all([
    issue.owner_profile_id
      ? supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", issue.owner_profile_id)
          .eq("organization_id", profile.organizationId)
          .maybeSingle<ProfileRow>()
      : Promise.resolve({ data: null as ProfileRow | null }),
    issue.risk_id
      ? supabase
          .from("risks")
          .select("id, title")
          .eq("id", issue.risk_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<TitledRow>()
      : Promise.resolve({ data: null as TitledRow | null }),
    issue.control_id
      ? supabase
          .from("controls")
          .select("id, code, title")
          .eq("id", issue.control_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<ControlRow>()
      : Promise.resolve({ data: null as ControlRow | null }),
    issue.action_plan_id
      ? supabase
          .from("action_plans")
          .select("id, title")
          .eq("id", issue.action_plan_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<TitledRow>()
      : Promise.resolve({ data: null as TitledRow | null }),
    issue.incident_id
      ? supabase
          .from("incidents")
          .select("id, title")
          .eq("id", issue.incident_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<TitledRow>()
      : Promise.resolve({ data: null as TitledRow | null }),
    issue.source_finding_id
      ? supabase
          .from("findings")
          .select("id, title")
          .eq("id", issue.source_finding_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<TitledRow>()
      : Promise.resolve({ data: null as TitledRow | null }),
    issue.source_risk_acceptance_id
      ? supabase
          .from("risk_acceptances")
          .select("id, status, expiration_date")
          .eq("id", issue.source_risk_acceptance_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<RiskAcceptanceRow>()
      : Promise.resolve({ data: null as RiskAcceptanceRow | null }),
    issue.policy_id
      ? supabase
          .from("policies")
          .select("id, title, version")
          .eq("id", issue.policy_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<PolicyRow>()
      : Promise.resolve({ data: null as PolicyRow | null }),
    issue.third_party_id
      ? supabase
          .from("third_parties")
          .select("id, name")
          .eq("id", issue.third_party_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<ThirdPartyRow>()
      : Promise.resolve({ data: null as ThirdPartyRow | null }),
    issue.audit_engagement_id
      ? supabase
          .from("audit_engagements")
          .select("id, title")
          .eq("id", issue.audit_engagement_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<TitledRow>()
      : Promise.resolve({ data: null as TitledRow | null }),
    getAuditEntries("issue", issue.id),
  ]);

  const owner = ownerResult.data;
  const ageDays = getIssueAgeDays(issue.created_at);
  const dueDelta = issue.due_date ? dayDifferenceFromToday(issue.due_date) : null;
  const overdue = isIssueOverdue({
    status: issue.status,
    dueDate: issue.due_date,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground capitalize">
            {formatIssueTypeLabel(issue.issue_type)} | {issue.status} | {issue.severity}
          </p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link href={`/dashboard/issues/${issue.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                Edit
              </Link>
            ) : null}
            {canArchive ? (
              <form action={archiveIssueAction}>
                <input type="hidden" name="issueId" value={issue.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      {overdue ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Overdue by {Math.abs(dueDelta ?? 0)} day(s).
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{issue.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
          <p className="mt-1 text-sm font-medium capitalize">{formatIssueTypeLabel(issue.issue_type)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium capitalize">{issue.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Severity</p>
          <p className="mt-1 text-sm font-medium capitalize">{issue.severity}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Aging</p>
          <p className="mt-1 text-sm font-medium">{ageDays} day(s)</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
          <p className="mt-1 text-sm font-medium">{issue.due_date ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Delay</p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              overdue
                ? "text-red-700"
                : dueDelta !== null && !["resolved", "closed"].includes(issue.status) && dueDelta <= 7
                  ? "text-amber-700"
                  : "",
            )}
          >
            {overdue
              ? `Overdue ${Math.abs(dueDelta ?? 0)} day(s)`
              : dueDelta !== null && !["resolved", "closed"].includes(issue.status)
                ? `${dueDelta} day(s) left`
                : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(issue.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(issue.updated_at).toLocaleString()}</p>
        </div>
      </div>

      {issue.root_cause ? (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Root cause</h2>
          <p className="mt-3 whitespace-pre-line text-sm">{issue.root_cause}</p>
        </section>
      ) : null}

      {issue.management_response ? (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Management response</h2>
          <p className="mt-3 whitespace-pre-line text-sm">{issue.management_response}</p>
        </section>
      ) : null}

      {issue.resolution_notes ? (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Resolution notes</h2>
          <p className="mt-3 whitespace-pre-line text-sm">{issue.resolution_notes}</p>
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Context links</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {findingResult.data ? (
            <li>
              <Link href={`/dashboard/findings/${findingResult.data.id}`} className="font-medium hover:underline">
                Source finding
              </Link>{" "}
              <span className="text-muted-foreground">{findingResult.data.title}</span>
            </li>
          ) : null}

          {riskAcceptanceResult.data ? (
            <li>
              <Link
                href={`/dashboard/risk-acceptances/${riskAcceptanceResult.data.id}`}
                className="font-medium hover:underline"
              >
                Source risk acceptance
              </Link>{" "}
              <span className="text-muted-foreground">
                {riskAcceptanceResult.data.status}, exp {riskAcceptanceResult.data.expiration_date}
              </span>
            </li>
          ) : null}

          {riskResult.data ? (
            <li>
              <Link href={`/dashboard/risks/${riskResult.data.id}`} className="font-medium hover:underline">
                Linked risk
              </Link>{" "}
              <span className="text-muted-foreground">{riskResult.data.title}</span>
            </li>
          ) : null}

          {controlResult.data ? (
            <li>
              <Link href={`/dashboard/controls/${controlResult.data.id}`} className="font-medium hover:underline">
                Linked control
              </Link>{" "}
              <span className="text-muted-foreground">
                {controlResult.data.code} - {controlResult.data.title}
              </span>
            </li>
          ) : null}

          {actionPlanResult.data ? (
            <li>
              <Link href={`/dashboard/actions/${actionPlanResult.data.id}`} className="font-medium hover:underline">
                Linked action plan
              </Link>{" "}
              <span className="text-muted-foreground">{actionPlanResult.data.title}</span>
            </li>
          ) : null}

          {incidentResult.data ? (
            <li>
              <Link href={`/dashboard/incidents/${incidentResult.data.id}`} className="font-medium hover:underline">
                Linked incident
              </Link>{" "}
              <span className="text-muted-foreground">{incidentResult.data.title}</span>
            </li>
          ) : null}

          {policyResult.data ? (
            <li>
              <Link href={`/dashboard/policies/${policyResult.data.id}`} className="font-medium hover:underline">
                Linked policy
              </Link>{" "}
              <span className="text-muted-foreground">
                {policyResult.data.title} v{policyResult.data.version}
              </span>
            </li>
          ) : null}

          {thirdPartyResult.data ? (
            <li>
              <Link
                href={`/dashboard/third-parties/${thirdPartyResult.data.id}`}
                className="font-medium hover:underline"
              >
                Linked third party
              </Link>{" "}
              <span className="text-muted-foreground">{thirdPartyResult.data.name}</span>
            </li>
          ) : null}

          {auditEngagementResult.data ? (
            <li>
              <Link
                href={`/dashboard/audits/engagements/${auditEngagementResult.data.id}`}
                className="font-medium hover:underline"
              >
                Linked audit engagement
              </Link>{" "}
              <span className="text-muted-foreground">{auditEngagementResult.data.title}</span>
            </li>
          ) : null}

          {!findingResult.data &&
          !riskAcceptanceResult.data &&
          !riskResult.data &&
          !controlResult.data &&
          !actionPlanResult.data &&
          !incidentResult.data &&
          !policyResult.data &&
          !thirdPartyResult.data &&
          !auditEngagementResult.data ? (
            <li className="text-muted-foreground">No linked context entities.</li>
          ) : null}
        </ul>
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
