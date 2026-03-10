import { createRiskAcceptanceAction } from "@/app/dashboard/risk-acceptances/actions";
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

export default async function NewRiskAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; riskId?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: risks }, { data: controls }, { data: actionPlans }, { data: approvers }] = await Promise.all([
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

  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New risk acceptance</h1>
        <p className="text-sm text-muted-foreground">
          Record an approved risk acceptance with mandatory justification and expiration date.
        </p>
      </div>

      <RiskAcceptanceForm
        mode="create"
        action={createRiskAcceptanceAction}
        riskOptions={(risks ?? []).map((risk) => ({
          id: risk.id,
          label: risk.title ?? risk.id,
        }))}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        actionPlanOptions={(actionPlans ?? []).map((actionPlan) => ({
          id: actionPlan.id,
          label: actionPlan.title ?? actionPlan.id,
        }))}
        approverOptions={(approvers ?? []).map((approver) => ({
          id: approver.id,
          label: approver.full_name
            ? `${approver.full_name} (${approver.email})`
            : (approver.email ?? approver.id),
        }))}
        defaults={{
          riskId: params.riskId?.trim() ?? "",
          approvedByProfileId: profile.id,
          expirationDate: nextMonth,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
