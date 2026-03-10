import { notFound } from "next/navigation";

import { updateRiskAcceptanceAction } from "@/app/dashboard/risk-acceptances/actions";
import { RiskAcceptanceForm } from "@/components/risk-acceptances/risk-acceptance-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  title?: string;
  code?: string;
  email?: string;
  full_name?: string | null;
};

type RiskAcceptanceRow = {
  id: string;
  risk_id: string;
  control_id: string | null;
  action_plan_id: string | null;
  approved_by_profile_id: string;
  justification: string;
  expiration_date: string;
  status: "active" | "expired" | "revoked";
};

async function getRiskAcceptance(riskAcceptanceId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risk_acceptances")
    .select(
      "id, risk_id, control_id, action_plan_id, approved_by_profile_id, justification, expiration_date, status",
    )
    .eq("id", riskAcceptanceId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<RiskAcceptanceRow>();

  return data;
}

export default async function EditRiskAcceptancePage({
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
  const [acceptance, risksResult, controlsResult, actionPlansResult, approversResult] = await Promise.all([
    getRiskAcceptance(id, profile.organizationId),
    supabase
      .from("risks")
      .select("id, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .in("role", ["manager", "admin"])
      .order("email")
      .returns<OptionRow[]>(),
  ]);

  if (!acceptance) {
    notFound();
  }

  if (acceptance.status === "revoked") {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit risk acceptance</h1>
        <p className="text-sm text-muted-foreground">Update scope, approver, and expiration date.</p>
      </div>

      <RiskAcceptanceForm
        mode="edit"
        action={updateRiskAcceptanceAction}
        riskOptions={(risksResult.data ?? []).map((risk) => ({
          id: risk.id,
          label: risk.title ?? risk.id,
        }))}
        controlOptions={(controlsResult.data ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        actionPlanOptions={(actionPlansResult.data ?? []).map((actionPlan) => ({
          id: actionPlan.id,
          label: actionPlan.title ?? actionPlan.id,
        }))}
        approverOptions={(approversResult.data ?? []).map((approver) => ({
          id: approver.id,
          label: approver.full_name
            ? `${approver.full_name} (${approver.email})`
            : (approver.email ?? approver.id),
        }))}
        defaults={{
          riskAcceptanceId: acceptance.id,
          riskId: acceptance.risk_id,
          controlId: acceptance.control_id,
          actionPlanId: acceptance.action_plan_id,
          approvedByProfileId: acceptance.approved_by_profile_id,
          justification: acceptance.justification,
          expirationDate: acceptance.expiration_date,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
