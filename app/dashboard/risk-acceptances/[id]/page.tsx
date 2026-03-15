import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditLogSection } from "@/components/audit/audit-log-section";
import { LinkedIssuesSection } from "@/components/issues/linked-issues-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { getIssueAgeDays, isIssueOverdue } from "@/lib/issues/aging";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revokeRiskAcceptanceAction } from "@/app/dashboard/risk-acceptances/actions";
import { cn } from "@/lib/utils/cn";

type RiskAcceptanceDetail = {
  id: string;
  risk_id: string;
  control_id: string | null;
  action_plan_id: string | null;
  justification: string;
  approved_by_profile_id: string;
  approved_at: string;
  expiration_date: string;
  status: "active" | "expired" | "revoked";
  revoked_at: string | null;
  revoked_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

type RiskRow = { id: string; title: string };
type ControlRow = { id: string; code: string; title: string };
type ActionPlanRow = { id: string; title: string };
type ProfileRow = { id: string; email: string; full_name: string | null };
type LinkedIssueRow = {
  id: string;
  title: string;
  issue_type: string;
  status: string;
  severity: string;
  due_date: string | null;
  created_at: string;
};

function toUtcDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`);
}

function daysUntil(dateValue: string) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const target = toUtcDate(dateValue);
  return Math.floor((target.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

function deriveEffectiveStatus(status: "active" | "expired" | "revoked", expirationDate: string) {
  if (status === "revoked") {
    return "revoked";
  }
  return daysUntil(expirationDate) < 0 ? "expired" : "active";
}

async function getRiskAcceptanceById(riskAcceptanceId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risk_acceptances")
    .select(
      "id, risk_id, control_id, action_plan_id, justification, approved_by_profile_id, approved_at, expiration_date, status, revoked_at, revoked_by_profile_id, created_at, updated_at",
    )
    .eq("id", riskAcceptanceId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<RiskAcceptanceDetail>();

  return data;
}

async function getRisk(riskId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select("id, title")
    .eq("id", riskId)
    .eq("organization_id", organizationId)
    .maybeSingle<RiskRow>();

  return data;
}

async function getControl(controlId: string | null, organizationId: string) {
  if (!controlId) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select("id, code, title")
    .eq("id", controlId)
    .eq("organization_id", organizationId)
    .maybeSingle<ControlRow>();

  return data;
}

async function getActionPlan(actionPlanId: string | null, organizationId: string) {
  if (!actionPlanId) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("action_plans")
    .select("id, title")
    .eq("id", actionPlanId)
    .eq("organization_id", organizationId)
    .maybeSingle<ActionPlanRow>();

  return data;
}

async function getProfile(profileId: string | null, organizationId: string) {
  if (!profileId) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .maybeSingle<ProfileRow>();

  return data;
}

async function getLinkedIssuesForRiskAcceptance(riskAcceptanceId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("issues")
    .select("id, title, issue_type, status, severity, due_date, created_at")
    .eq("organization_id", organizationId)
    .eq("source_risk_acceptance_id", riskAcceptanceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(20)
    .returns<LinkedIssueRow[]>();

  return data ?? [];
}

export default async function RiskAcceptanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;
  const acceptance = await getRiskAcceptanceById(id, profile.organizationId);

  if (!acceptance) {
    notFound();
  }

  const effectiveStatus = deriveEffectiveStatus(acceptance.status, acceptance.expiration_date);
  const reminderDays = daysUntil(acceptance.expiration_date);

  const [risk, control, actionPlan, approver, revokedBy, linkedIssues, auditEntries] =
    await Promise.all([
    getRisk(acceptance.risk_id, profile.organizationId),
    getControl(acceptance.control_id, profile.organizationId),
    getActionPlan(acceptance.action_plan_id, profile.organizationId),
    getProfile(acceptance.approved_by_profile_id, profile.organizationId),
    getProfile(acceptance.revoked_by_profile_id, profile.organizationId),
    getLinkedIssuesForRiskAcceptance(acceptance.id, profile.organizationId),
    getAuditEntries("risk_acceptance", acceptance.id),
  ]);

  const issuePrefill = new URLSearchParams({
    riskAcceptanceId: acceptance.id,
    riskId: acceptance.risk_id,
  });

  if (acceptance.control_id) {
    issuePrefill.set("controlId", acceptance.control_id);
  }

  if (acceptance.action_plan_id) {
    issuePrefill.set("actionPlanId", acceptance.action_plan_id);
  }

  const raiseIssueHref = `/dashboard/issues/new?${issuePrefill.toString()}`;

  const approverLabel = approver
    ? approver.full_name
      ? `${approver.full_name} (${approver.email})`
      : approver.email
    : "Unknown";
  const revokedByLabel = revokedBy
    ? revokedBy.full_name
      ? `${revokedBy.full_name} (${revokedBy.email})`
      : revokedBy.email
    : "-";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk acceptance</h1>
          <p className="mt-2 text-sm text-muted-foreground capitalize">{effectiveStatus}</p>
        </div>

        {canManage ? (
          <div className="flex gap-2">
            {effectiveStatus !== "revoked" ? (
              <Link
                href={`/dashboard/risk-acceptances/${acceptance.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}
            {effectiveStatus !== "revoked" ? (
              <form action={revokeRiskAcceptanceAction}>
                <input type="hidden" name="riskAcceptanceId" value={acceptance.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Revoke
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      {effectiveStatus !== "revoked" && reminderDays <= 14 ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            reminderDays < 0
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800",
          )}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">
            {reminderDays < 0 ? "Acceptance expired." : "Acceptance expires soon."}
          </p>
          <p className="mt-1">
            {reminderDays < 0
              ? `Expired ${Math.abs(reminderDays)} day(s) ago.`
              : `Expires in ${reminderDays} day(s).`}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk</p>
          <p className="mt-1 text-sm font-medium">{risk?.title ?? "Unknown risk"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approver</p>
          <p className="mt-1 text-sm font-medium">{approverLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved at</p>
          <p className="mt-1 text-sm font-medium">{new Date(acceptance.approved_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expiration date</p>
          <p className="mt-1 text-sm font-medium">{acceptance.expiration_date}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Control</p>
          <p className="mt-1 text-sm font-medium">
            {control ? `${control.code} - ${control.title}` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Action plan</p>
          <p className="mt-1 text-sm font-medium">{actionPlan?.title ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Revoked at</p>
          <p className="mt-1 text-sm font-medium">
            {acceptance.revoked_at ? new Date(acceptance.revoked_at).toLocaleString() : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Revoked by</p>
          <p className="mt-1 text-sm font-medium">{revokedByLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(acceptance.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Justification</p>
        <p className="mt-2 whitespace-pre-line text-sm">{acceptance.justification}</p>
      </div>

      <LinkedIssuesSection
        title="Linked issues"
        items={linkedIssues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          issueType: issue.issue_type,
          status: issue.status,
          severity: issue.severity,
          dueDate: issue.due_date,
          ageDays: getIssueAgeDays(issue.created_at),
          overdue: isIssueOverdue({
            status: issue.status,
            dueDate: issue.due_date,
          }),
        }))}
        emptyMessage="No issues linked to this risk acceptance."
        canCreate={hasRole("contributor", profile.role)}
        createHref={raiseIssueHref}
        createLabel="Raise issue"
      />

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
