import { IncidentForm } from "@/components/incidents/incident-form";

import { createIncidentAction } from "@/app/dashboard/incidents/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  title?: string;
  email?: string;
  full_name?: string | null;
};

export default async function NewIncidentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: risks }, { data: actionPlans }, { data: owners }] = await Promise.all([
    supabase
      .from("risks")
      .select("id, title")
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
    supabase.from("profiles").select("id, email, full_name").order("email").returns<OptionRow[]>(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New incident</h1>
        <p className="text-sm text-muted-foreground">
          Record an incident and link it to risks or action plans.
        </p>
      </div>

      <IncidentForm
        mode="create"
        action={createIncidentAction}
        riskOptions={(risks ?? []).map((risk) => ({ id: risk.id, label: risk.title ?? risk.id }))}
        actionOptions={(actionPlans ?? []).map((action) => ({
          id: action.id,
          label: action.title ?? action.id,
        }))}
        ownerOptions={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : (owner.email ?? owner.id),
        }))}
        defaults={{
          ownerProfileId: profile.id,
          status: "open",
          occurredDate: new Date().toISOString().slice(0, 10),
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
