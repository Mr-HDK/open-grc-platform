import { z } from "zod";

import { AuditEngagementForm } from "@/components/audits/audit-engagement-form";
import { createAuditEngagementAction } from "@/app/dashboard/audits/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAuditPeriodLabel } from "@/lib/audits/period";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
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

const uuidSchema = z.string().uuid();

export default async function NewAuditEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; auditPlanItemId?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    { data: planItems },
    { data: plans },
    { data: auditors },
    { data: findings },
    { data: actionPlans },
  ] = await Promise.all([
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
  ]);

  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const selectedPlanItemId = uuidSchema.safeParse(params.auditPlanItemId).success
    ? params.auditPlanItemId!
    : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New audit engagement</h1>
        <p className="text-sm text-muted-foreground">
          Launch fieldwork against a planned audit item and link it to existing findings and actions.
        </p>
      </div>

      <AuditEngagementForm
        mode="create"
        action={createAuditEngagementAction}
        planItems={(planItems ?? []).map((item) => {
          const plan = planById.get(item.audit_plan_id);
          return {
            id: item.id,
            label: `${item.topic}${plan ? ` (${formatAuditPeriodLabel(plan.plan_year, plan.cycle)})` : ""}`,
          };
        })}
        auditors={(auditors ?? []).map((auditor) => ({
          id: auditor.id,
          label: auditor.full_name ? `${auditor.full_name} (${auditor.email})` : auditor.email,
        }))}
        findingOptions={(findings ?? []).map((finding) => ({
          id: finding.id,
          title: finding.title,
          severity: finding.severity,
          status: finding.status,
        }))}
        actionOptions={(actionPlans ?? []).map((actionPlan) => ({
          id: actionPlan.id,
          title: actionPlan.title,
          priority: actionPlan.priority,
          status: actionPlan.status,
        }))}
        defaults={{
          auditPlanItemId: selectedPlanItemId,
          leadAuditorProfileId: profile.id,
          status: "planned",
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
