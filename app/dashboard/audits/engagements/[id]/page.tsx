import Link from "next/link";
import { notFound } from "next/navigation";

import { createAuditWorkpaperAction } from "@/app/dashboard/audits/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { formatAuditPeriodLabel } from "@/lib/audits/period";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EngagementDetail = {
  id: string;
  audit_plan_item_id: string;
  title: string;
  lead_auditor_profile_id: string | null;
  status: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  scope: string;
  objectives: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type AuditPlanItemRow = {
  id: string;
  audit_plan_id: string;
  topic: string;
  auditable_entity_id: string | null;
  risk_id: string | null;
  status: string;
  notes: string | null;
};

type AuditPlanRow = {
  id: string;
  title: string;
  plan_year: number;
  cycle: string;
};

type AuditableEntityRow = {
  id: string;
  name: string;
  entity_type: string;
};

type RiskRow = {
  id: string;
  title: string;
  status: string;
  level: string;
  score: number;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type FindingLinkRow = {
  findings: {
    id: string;
    title: string;
    severity: string;
    status: string;
    deleted_at: string | null;
  } | null;
};

type ActionLinkRow = {
  action_plans: {
    id: string;
    title: string;
    priority: string;
    status: string;
    target_date: string;
    deleted_at: string | null;
  } | null;
};

type WorkpaperRow = {
  id: string;
  title: string;
  procedure: string;
  conclusion: string;
  reviewer_profile_id: string | null;
  evidence_id: string | null;
  created_at: string;
};

type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
};

function formatEntityTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

async function getEngagement(engagementId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_engagements")
    .select(
      "id, audit_plan_item_id, title, lead_auditor_profile_id, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, scope, objectives, summary, created_at, updated_at",
    )
    .eq("id", engagementId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<EngagementDetail>();

  return data;
}

export default async function AuditEngagementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const canExecute = hasRole("contributor", profile.role);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const engagement = await getEngagement(id, profile.organizationId);

  if (!engagement) {
    notFound();
  }

  const [
    planItemResult,
    leadAuditorResult,
    findingsResult,
    actionsResult,
    workpapersResult,
    evidenceOptionsResult,
    reviewersResult,
    auditEntries,
  ] = await Promise.all([
    supabase
      .from("audit_plan_items")
      .select("id, audit_plan_id, topic, auditable_entity_id, risk_id, status, notes")
      .eq("id", engagement.audit_plan_item_id)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .maybeSingle<AuditPlanItemRow>(),
    engagement.lead_auditor_profile_id
      ? supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", engagement.lead_auditor_profile_id)
          .maybeSingle<ProfileRow>()
      : Promise.resolve({ data: null as ProfileRow | null }),
    supabase
      .from("audit_engagement_findings")
      .select("findings(id, title, severity, status, deleted_at)")
      .eq("audit_engagement_id", engagement.id)
      .returns<FindingLinkRow[]>(),
    supabase
      .from("audit_engagement_action_plans")
      .select("action_plans(id, title, priority, status, target_date, deleted_at)")
      .eq("audit_engagement_id", engagement.id)
      .returns<ActionLinkRow[]>(),
    supabase
      .from("audit_workpapers")
      .select("id, title, procedure, conclusion, reviewer_profile_id, evidence_id, created_at")
      .eq("audit_engagement_id", engagement.id)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .returns<WorkpaperRow[]>(),
    supabase
      .from("evidence")
      .select("id, title, file_name")
      .eq("organization_id", profile.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(80)
      .returns<EvidenceRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    getAuditEntries("audit_engagement", engagement.id),
  ]);

  const planItem = planItemResult.data;

  if (!planItem) {
    notFound();
  }

  const [planResult, entityResult, riskResult] = await Promise.all([
    supabase
      .from("audit_plans")
      .select("id, title, plan_year, cycle")
      .eq("id", planItem.audit_plan_id)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .maybeSingle<AuditPlanRow>(),
    planItem.auditable_entity_id
      ? supabase
          .from("auditable_entities")
          .select("id, name, entity_type")
          .eq("id", planItem.auditable_entity_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<AuditableEntityRow>()
      : Promise.resolve({ data: null as AuditableEntityRow | null }),
    planItem.risk_id
      ? supabase
          .from("risks")
          .select("id, title, status, level, score")
          .eq("id", planItem.risk_id)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<RiskRow>()
      : Promise.resolve({ data: null as RiskRow | null }),
  ]);

  const leadAuditor = leadAuditorResult.data;
  const plan = planResult.data;
  const entity = entityResult.data;
  const risk = riskResult.data;
  const reviewers = reviewersResult.data ?? [];
  const reviewerById = new Map(
    reviewers.map((reviewer) => [
      reviewer.id,
      reviewer.full_name ? `${reviewer.full_name} (${reviewer.email})` : reviewer.email,
    ]),
  );
  const evidenceById = new Map((evidenceOptionsResult.data ?? []).map((evidence) => [evidence.id, evidence]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{engagement.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{engagement.status}</p>
        </div>

        {canManage ? (
          <Link href={`/dashboard/audits/engagements/${engagement.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            Edit
          </Link>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
          <p className="mt-1 text-sm font-medium">
            {plan ? `${plan.title} (${formatAuditPeriodLabel(plan.plan_year, plan.cycle)})` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan item</p>
          <p className="mt-1 text-sm font-medium">{planItem.topic}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead auditor</p>
          <p className="mt-1 text-sm font-medium">
            {leadAuditor
              ? leadAuditor.full_name
                ? `${leadAuditor.full_name} (${leadAuditor.email})`
                : leadAuditor.email
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Planned dates</p>
          <p className="mt-1 text-sm font-medium">
            {engagement.planned_start_date} to {engagement.planned_end_date}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual dates</p>
          <p className="mt-1 text-sm font-medium">
            {engagement.actual_start_date && engagement.actual_end_date
              ? `${engagement.actual_start_date} to ${engagement.actual_end_date}`
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(engagement.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Scope</h2>
        <p className="mt-3 whitespace-pre-line text-sm">{engagement.scope}</p>

        {entity ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Auditable entity: {entity.name} ({formatEntityTypeLabel(entity.entity_type)})
          </p>
        ) : null}
        {risk ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Risk: {risk.title} ({risk.status} / {risk.level} / score {risk.score})
          </p>
        ) : null}
        {planItem.notes ? (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{planItem.notes}</p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Objectives</h2>
        <p className="mt-3 whitespace-pre-line text-sm">{engagement.objectives}</p>
        {engagement.summary ? (
          <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{engagement.summary}</p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked findings</h2>

        {(findingsResult.data ?? []).filter((row) => row.findings && !row.findings.deleted_at).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No findings linked to this engagement.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(findingsResult.data ?? [])
              .filter((row) => row.findings && !row.findings.deleted_at)
              .map((row) => (
                <li key={row.findings!.id} className="rounded-lg border p-3">
                  <Link
                    href={`/dashboard/findings/${row.findings!.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {row.findings!.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.findings!.severity} | {row.findings!.status}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Remediation actions</h2>

        {(actionsResult.data ?? []).filter((row) => row.action_plans && !row.action_plans.deleted_at).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No action plans linked to this engagement.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(actionsResult.data ?? [])
              .filter((row) => row.action_plans && !row.action_plans.deleted_at)
              .map((row) => (
                <li key={row.action_plans!.id} className="rounded-lg border p-3">
                  <Link
                    href={`/dashboard/actions/${row.action_plans!.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {row.action_plans!.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.action_plans!.priority} | {row.action_plans!.status} | target {row.action_plans!.target_date}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Workpapers</h2>

        {(workpapersResult.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No workpapers logged yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(workpapersResult.data ?? []).map((workpaper) => {
              const evidence = workpaper.evidence_id ? evidenceById.get(workpaper.evidence_id) : null;
              return (
                <li key={workpaper.id} className="rounded-lg border p-4">
                  <p className="text-sm font-medium">{workpaper.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Procedure</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{workpaper.procedure}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Conclusion</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{workpaper.conclusion}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Reviewer: {workpaper.reviewer_profile_id ? reviewerById.get(workpaper.reviewer_profile_id) ?? "Unknown" : "-"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Evidence: {evidence ? `${evidence.title} (${evidence.file_name})` : "-"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {canExecute ? (
          <form action={createAuditWorkpaperAction} className="mt-6 space-y-4 rounded-lg border p-4">
            <input type="hidden" name="auditEngagementId" value={engagement.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Workpaper title
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  maxLength={180}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="procedure" className="text-sm font-medium">
                  Procedure
                </label>
                <textarea
                  id="procedure"
                  name="procedure"
                  required
                  maxLength={6000}
                  className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="conclusion" className="text-sm font-medium">
                  Conclusion
                </label>
                <textarea
                  id="conclusion"
                  name="conclusion"
                  required
                  maxLength={6000}
                  className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="reviewerProfileId" className="text-sm font-medium">
                  Reviewer
                </label>
                <select
                  id="reviewerProfileId"
                  name="reviewerProfileId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">No reviewer</option>
                  {reviewers.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.full_name ? `${reviewer.full_name} (${reviewer.email})` : reviewer.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="evidenceId" className="text-sm font-medium">
                  Evidence
                </label>
                <select
                  id="evidenceId"
                  name="evidenceId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">No linked evidence</option>
                  {(evidenceOptionsResult.data ?? []).map((evidence) => (
                    <option key={evidence.id} value={evidence.id}>
                      {evidence.title} ({evidence.file_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className={buttonVariants()}>
              Add workpaper
            </button>
          </form>
        ) : null}
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
