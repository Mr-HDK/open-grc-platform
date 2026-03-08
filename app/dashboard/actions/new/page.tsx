import { ActionPlanForm } from "@/components/actions/action-plan-form";

import { createActionPlanAction } from "@/app/dashboard/actions/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  title?: string;
  code?: string;
  email?: string;
  full_name?: string | null;
};

export default async function NewActionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New action plan</h1>
        <p className="text-sm text-muted-foreground">
          Create a remediation task linked to a risk and/or control.
        </p>
      </div>

      <ActionPlanForm
        mode="create"
        action={createActionPlanAction}
        riskOptions={(risks ?? []).map((risk) => ({ id: risk.id, label: risk.title ?? risk.id }))}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        ownerOptions={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : (owner.email ?? owner.id),
        }))}
        defaults={{
          ownerProfileId: profile.id,
          status: "open",
          priority: "medium",
          targetDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
