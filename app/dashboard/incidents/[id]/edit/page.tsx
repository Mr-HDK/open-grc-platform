import { notFound } from "next/navigation";

import { IncidentForm } from "@/components/incidents/incident-form";

import { updateIncidentAction } from "@/app/dashboard/incidents/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  title?: string;
  email?: string;
  full_name?: string | null;
};

type IncidentRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  occurred_at: string | null;
  risk_id: string | null;
  action_plan_id: string | null;
  owner_profile_id: string | null;
};

async function getIncident(incidentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("incidents")
    .select(
      "id, title, description, status, occurred_at, risk_id, action_plan_id, owner_profile_id",
    )
    .eq("id", incidentId)
    .is("deleted_at", null)
    .maybeSingle<IncidentRow>();

  return data;
}

export default async function EditIncidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("contributor");
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [{ data: incident }, { data: risks }, { data: actionPlans }, { data: owners }] =
    await Promise.all([
      getIncident(id),
      supabase
        .from("risks")
        .select("id, title")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(50)
        .returns<OptionRow[]>(),
      supabase
        .from("action_plans")
        .select("id, title")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(50)
        .returns<OptionRow[]>(),
      supabase.from("profiles").select("id, email, full_name").order("email").returns<OptionRow[]>(),
    ]);

  if (!incident) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit incident</h1>
        <p className="text-sm text-muted-foreground">Update incident metadata and links.</p>
      </div>

      <IncidentForm
        mode="edit"
        action={updateIncidentAction}
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
          incidentId: incident.id,
          title: incident.title,
          description: incident.description,
          status: incident.status as "open" | "investigating" | "mitigated" | "closed",
          occurredDate: incident.occurred_at,
          riskId: incident.risk_id,
          actionPlanId: incident.action_plan_id,
          ownerProfileId: incident.owner_profile_id,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
