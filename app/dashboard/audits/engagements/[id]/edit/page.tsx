import { notFound } from "next/navigation";

import { AuditEngagementForm } from "@/components/audits/audit-engagement-form";
import { updateAuditEngagementAction } from "@/app/dashboard/audits/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAuditPeriodLabel } from "@/lib/audits/period";
import {
  isAuditEngagementStatus,
  type AuditEngagementStatus,
} from "@/lib/validators/audit";

type EngagementRow = {
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
};

type PlanItemRow = {
  id: string;
  topic: string;
  audit_plan_id: string;
};

type PlanRow = {
  id: string;
  title: string;
  plan_year: number;
  cycle: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type FindingRow = {
  id: string;
  title: string;
  severity: string;
  status: string;
};

type ActionPlanRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
};

type EngagementFindingRow = {
  finding_id: string;
};

type EngagementActionRow = {
  action_plan_id: string;
};

async function getEngagement(engagementId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_engagements")
    .select(
      "id, audit_plan_item_id, title, lead_auditor_profile_id, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, scope, objectives, summary",
    )
    .eq("id", engagementId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<EngagementRow>();

  return data;
}

export default async function EditAuditEngagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    engagement,
    planItemsResult,
    plansResult,
    auditorsResult,
    findingsResult,
    actionsResult,
    engagementFindingsResult,
    engagementActionsResult,
  ] = await Promise.all([
    getEngagement(id, profile.organizationId),
    supabase
      .from("audit_plan_items")
      .select("id, topic, audit_plan_id")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .returns<PlanItemRow[]>(),
    supabase
      .from("audit_plans")
      .select("id, title, plan_year, cycle")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<PlanRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    supabase
      .from("findings")
      .select("id, title, severity, status")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<FindingRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title, priority, status")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<ActionPlanRow[]>(),
    supabase
      .from("audit_engagement_findings")
      .select("finding_id")
      .eq("audit_engagement_id", id)
      .returns<EngagementFindingRow[]>(),
    supabase
      .from("audit_engagement_action_plans")
      .select("action_plan_id")
      .eq("audit_engagement_id", id)
      .returns<EngagementActionRow[]>(),
  ]);

  if (!engagement) {
    notFound();
  }

  const status: AuditEngagementStatus = isAuditEngagementStatus(engagement.status)
    ? engagement.status
    : "planned";
  const planById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit audit engagement</h1>
        <p className="text-sm text-muted-foreground">
          Update scope, scheduling, and linked findings/actions.
        </p>
      </div>

      <AuditEngagementForm
        mode="edit"
        action={updateAuditEngagementAction}
        planItems={(planItemsResult.data ?? []).map((item) => {
          const plan = planById.get(item.audit_plan_id);
          return {
            id: item.id,
            label: `${item.topic}${plan ? ` (${formatAuditPeriodLabel(plan.plan_year, plan.cycle)})` : ""}`,
          };
        })}
        auditors={(auditorsResult.data ?? []).map((auditor) => ({
          id: auditor.id,
          label: auditor.full_name ? `${auditor.full_name} (${auditor.email})` : auditor.email,
        }))}
        findingOptions={(findingsResult.data ?? []).map((finding) => ({
          id: finding.id,
          title: finding.title,
          severity: finding.severity,
          status: finding.status,
        }))}
        actionOptions={(actionsResult.data ?? []).map((actionPlan) => ({
          id: actionPlan.id,
          title: actionPlan.title,
          priority: actionPlan.priority,
          status: actionPlan.status,
        }))}
        defaults={{
          auditEngagementId: engagement.id,
          title: engagement.title,
          auditPlanItemId: engagement.audit_plan_item_id,
          leadAuditorProfileId: engagement.lead_auditor_profile_id ?? "",
          status,
          plannedStartDate: engagement.planned_start_date,
          plannedEndDate: engagement.planned_end_date,
          actualStartDate: engagement.actual_start_date,
          actualEndDate: engagement.actual_end_date,
          scope: engagement.scope,
          objectives: engagement.objectives,
          summary: engagement.summary,
          selectedFindingIds: (engagementFindingsResult.data ?? []).map((row) => row.finding_id),
          selectedActionPlanIds: (engagementActionsResult.data ?? []).map((row) => row.action_plan_id),
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
