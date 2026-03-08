import { notFound } from "next/navigation";

import { updateActionPlanAction } from "@/app/dashboard/actions/actions";
import { ActionPlanForm } from "@/components/actions/action-plan-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ActionPriority, type ActionStatus } from "@/lib/validators/action-plan";

type ActionPlanEditRow = {
  id: string;
  title: string;
  description: string;
  risk_id: string | null;
  control_id: string | null;
  owner_profile_id: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  target_date: string;
};

type OptionRow = {
  id: string;
  title?: string;
  code?: string;
  email?: string;
  full_name?: string | null;
};

async function getActionPlanForEdit(actionPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("action_plans")
    .select("id, title, description, risk_id, control_id, owner_profile_id, status, priority, target_date")
    .eq("id", actionPlanId)
    .is("deleted_at", null)
    .maybeSingle<ActionPlanEditRow>();

  return data;
}

async function getFormOptions() {
  const supabase = await createSupabaseServerClient();
  const [{ data: risks }, { data: controls }, { data: owners }] = await Promise.all([
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
    supabase.from("profiles").select("id, email, full_name").order("email").returns<OptionRow[]>(),
  ]);

  return {
    risks: risks ?? [],
    controls: controls ?? [],
    owners: owners ?? [],
  };
}

export default async function EditActionPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("contributor");

  const { id } = await params;
  const query = await searchParams;

  const actionPlan = await getActionPlanForEdit(id);

  if (!actionPlan) {
    notFound();
  }

  const { risks, controls, owners } = await getFormOptions();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit action plan</h1>
        <p className="text-sm text-muted-foreground">Update remediation tracking and ownership.</p>
      </div>

      <ActionPlanForm
        mode="edit"
        action={updateActionPlanAction}
        riskOptions={risks.map((risk) => ({ id: risk.id, label: risk.title ?? risk.id }))}
        controlOptions={controls.map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        ownerOptions={owners.map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : (owner.email ?? owner.id),
        }))}
        defaults={{
          actionPlanId: actionPlan.id,
          title: actionPlan.title,
          description: actionPlan.description,
          riskId: actionPlan.risk_id,
          controlId: actionPlan.control_id,
          ownerProfileId: actionPlan.owner_profile_id,
          status: actionPlan.status,
          priority: actionPlan.priority,
          targetDate: actionPlan.target_date,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
