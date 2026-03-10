import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveIncidentAction } from "@/app/dashboard/incidents/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { buttonVariants } from "@/components/ui/button";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IncidentDetail = {
  id: string;
  title: string;
  description: string;
  status: string;
  occurred_at: string | null;
  risk_id: string | null;
  action_plan_id: string | null;
  owner_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

type RiskRow = { id: string; title: string };

type ActionRow = { id: string; title: string };

type OwnerRow = { id: string; email: string; full_name: string | null };

async function getIncidentById(incidentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("incidents")
    .select(
      "id, title, description, status, occurred_at, risk_id, action_plan_id, owner_profile_id, created_at, updated_at",
    )
    .eq("id", incidentId)
    .is("deleted_at", null)
    .maybeSingle<IncidentDetail>();

  return data;
}

async function getRisk(riskId: string | null) {
  if (!riskId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select("id, title")
    .eq("id", riskId)
    .maybeSingle<RiskRow>();

  return data;
}

async function getActionPlan(actionPlanId: string | null) {
  if (!actionPlanId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("action_plans")
    .select("id, title")
    .eq("id", actionPlanId)
    .maybeSingle<ActionRow>();

  return data;
}

async function getOwner(ownerId: string | null) {
  if (!ownerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ownerId)
    .maybeSingle<OwnerRow>();

  return data;
}

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;
  const incident = await getIncidentById(id);

  if (!incident) {
    notFound();
  }

  const [risk, actionPlan, owner, auditEntries] = await Promise.all([
    getRisk(incident.risk_id),
    getActionPlan(incident.action_plan_id),
    getOwner(incident.owner_profile_id),
    getAuditEntries("incident", incident.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{incident.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground capitalize">{incident.status}</p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/incidents/${incident.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveIncidentAction}>
                <input type="hidden" name="incidentId" value={incident.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{incident.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium capitalize">{incident.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Occurred</p>
          <p className="mt-1 text-sm font-medium">{incident.occurred_at ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked risk</p>
          <p className="mt-1 text-sm font-medium">{risk ? risk.title : "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked action plan</p>
          <p className="mt-1 text-sm font-medium">{actionPlan ? actionPlan.title : "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">
            {new Date(incident.updated_at).toLocaleString()}
          </p>
        </div>
      </div>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
