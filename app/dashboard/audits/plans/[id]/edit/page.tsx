import { notFound } from "next/navigation";

import { AuditPlanForm } from "@/components/audits/audit-plan-form";
import { updateAuditPlanAction } from "@/app/dashboard/audits/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isAuditPlanCycle,
  isAuditPlanStatus,
  type AuditPlanCycle,
  type AuditPlanStatus,
} from "@/lib/validators/audit";

type AuditPlanRow = {
  id: string;
  title: string;
  plan_year: number;
  cycle: string;
  status: string;
  owner_profile_id: string | null;
  summary: string | null;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

async function getAuditPlan(planId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_plans")
    .select("id, title, plan_year, cycle, status, owner_profile_id, summary")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<AuditPlanRow>();

  return data;
}

export default async function EditAuditPlanPage({
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

  const [plan, ownersResult] = await Promise.all([
    getAuditPlan(id, profile.organizationId),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
  ]);

  if (!plan) {
    notFound();
  }

  const cycle: AuditPlanCycle = isAuditPlanCycle(plan.cycle) ? plan.cycle : "annual";
  const status: AuditPlanStatus = isAuditPlanStatus(plan.status) ? plan.status : "draft";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit audit plan</h1>
        <p className="text-sm text-muted-foreground">Update planning metadata and ownership.</p>
      </div>

      <AuditPlanForm
        mode="edit"
        action={updateAuditPlanAction}
        owners={(ownersResult.data ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        defaults={{
          auditPlanId: plan.id,
          title: plan.title,
          planYear: plan.plan_year,
          cycle,
          status,
          ownerProfileId: plan.owner_profile_id,
          summary: plan.summary,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
