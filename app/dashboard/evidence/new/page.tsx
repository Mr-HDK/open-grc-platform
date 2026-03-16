import { EvidenceForm } from "@/components/evidence/evidence-form";

import { createEvidenceAction } from "@/app/dashboard/evidence/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  title?: string;
  code?: string;
};

type EvidenceRequestRow = {
  id: string;
  title: string;
  control_id: string;
};

export default async function NewEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    riskId?: string;
    controlId?: string;
    actionPlanId?: string;
    controlEvidenceRequestId?: string;
  }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [{ data: risks }, { data: controls }, { data: actionPlans }, { data: evidenceRequest }] =
    await Promise.all([
    supabase
      .from("risks")
      .select("id, title")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(25)
      .returns<OptionRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(25)
      .returns<OptionRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(25)
      .returns<OptionRow[]>(),
    params.controlEvidenceRequestId
      ? supabase
          .from("control_evidence_requests")
          .select("id, title, control_id")
          .eq("id", params.controlEvidenceRequestId)
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .maybeSingle<EvidenceRequestRow>()
      : Promise.resolve({ data: null as EvidenceRequestRow | null }),
    ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload evidence</h1>
        <p className="text-sm text-muted-foreground">
          Store proof files and link them to risks, controls, and action plans.
        </p>
      </div>

      <EvidenceForm
        action={createEvidenceAction}
        riskOptions={(risks ?? []).map((risk) => ({ id: risk.id, label: risk.title ?? risk.id }))}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        actionPlanOptions={(actionPlans ?? []).map((actionPlan) => ({
          id: actionPlan.id,
          label: actionPlan.title ?? actionPlan.id,
        }))}
        defaults={{
          riskId: params.riskId,
          controlId: evidenceRequest?.control_id ?? params.controlId,
          actionPlanId: params.actionPlanId,
          controlEvidenceRequestId: params.controlEvidenceRequestId,
        }}
        requestContext={evidenceRequest ? { title: evidenceRequest.title } : null}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
