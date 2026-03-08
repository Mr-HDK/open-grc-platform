import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveActionPlanAction } from "@/app/dashboard/actions/actions";
import { buttonVariants } from "@/components/ui/button";
import { EvidenceListSection } from "@/components/evidence/evidence-list-section";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOverdueAction } from "@/lib/validators/action-plan";

type ActionPlanDetail = {
  id: string;
  title: string;
  description: string;
  risk_id: string | null;
  control_id: string | null;
  owner_profile_id: string | null;
  status: string;
  priority: string;
  target_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type RiskRow = { id: string; title: string };
type ControlRow = { id: string; code: string; title: string };
type OwnerRow = { id: string; email: string; full_name: string | null };
type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

async function getActionPlanById(actionPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("action_plans")
    .select(
      "id, title, description, risk_id, control_id, owner_profile_id, status, priority, target_date, completed_at, created_at, updated_at",
    )
    .eq("id", actionPlanId)
    .is("deleted_at", null)
    .maybeSingle<ActionPlanDetail>();

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

async function getControl(controlId: string | null) {
  if (!controlId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select("id, code, title")
    .eq("id", controlId)
    .maybeSingle<ControlRow>();

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

async function getActionPlanEvidence(actionPlanId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name, file_size, created_at")
    .eq("action_plan_id", actionPlanId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<EvidenceRow[]>();

  return data ?? [];
}

export default async function ActionPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("viewer");

  const { id } = await params;
  const query = await searchParams;

  const actionPlan = await getActionPlanById(id);

  if (!actionPlan) {
    notFound();
  }

  const [risk, control, owner, evidence] = await Promise.all([
    getRisk(actionPlan.risk_id),
    getControl(actionPlan.control_id),
    getOwner(actionPlan.owner_profile_id),
    getActionPlanEvidence(actionPlan.id),
  ]);

  const overdue = isOverdueAction(actionPlan.target_date, actionPlan.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{actionPlan.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{actionPlan.status}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard/actions/${actionPlan.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>

          <form action={archiveActionPlanAction}>
            <input type="hidden" name="actionPlanId" value={actionPlan.id} />
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Archive
            </button>
          </form>
        </div>
      </div>

      {query.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(query.error)}
        </p>
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{actionPlan.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
          <p className="mt-1 text-sm font-medium">{actionPlan.priority}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Target date</p>
          <p className="mt-1 text-sm font-medium">{actionPlan.target_date}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
          <p className="mt-1 text-sm font-medium">{overdue ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked risk</p>
          <p className="mt-1 text-sm font-medium">{risk ? risk.title : "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked control</p>
          <p className="mt-1 text-sm font-medium">
            {control ? `${control.code} - ${control.title}` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
      </div>

      <EvidenceListSection
        title="Evidence"
        emptyMessage="No evidence linked to this action plan."
        items={evidence}
        createHref={`/dashboard/evidence/new?actionPlanId=${actionPlan.id}`}
      />
    </div>
  );
}
