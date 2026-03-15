import Link from "next/link";
import { notFound } from "next/navigation";

import { createAuditPlanItemAction } from "@/app/dashboard/audits/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { formatAuditPeriodLabel } from "@/lib/audits/period";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditPlanItemStatusOptions } from "@/lib/validators/audit";

type AuditPlanDetail = {
  id: string;
  title: string;
  plan_year: number;
  cycle: string;
  status: string;
  owner_profile_id: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type AuditPlanItemRow = {
  id: string;
  topic: string;
  auditable_entity_id: string | null;
  risk_id: string | null;
  status: string;
  notes: string | null;
};

type AuditableEntityRow = {
  id: string;
  name: string;
  entity_type: string;
};

type RiskRow = {
  id: string;
  title: string;
  status: string;
  level: string;
  score: number;
};

type EngagementRow = {
  id: string;
  audit_plan_item_id: string;
  title: string;
  status: string;
  planned_start_date: string;
  planned_end_date: string;
};

function formatEntityTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

async function getAuditPlan(planId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_plans")
    .select("id, title, plan_year, cycle, status, owner_profile_id, summary, created_at, updated_at")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<AuditPlanDetail>();

  return data;
}

export default async function AuditPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const plan = await getAuditPlan(id, profile.organizationId);

  if (!plan) {
    notFound();
  }

  const [
    ownerResult,
    itemsResult,
    entityOptionsResult,
    riskOptionsResult,
    engagementsResult,
    auditEntries,
  ] = await Promise.all([
    plan.owner_profile_id
      ? supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", plan.owner_profile_id)
          .maybeSingle<ProfileRow>()
      : Promise.resolve({ data: null as ProfileRow | null }),
    supabase
      .from("audit_plan_items")
      .select("id, topic, auditable_entity_id, risk_id, status, notes")
      .eq("audit_plan_id", plan.id)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .returns<AuditPlanItemRow[]>(),
    supabase
      .from("auditable_entities")
      .select("id, name, entity_type")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("name")
      .returns<AuditableEntityRow[]>(),
    supabase
      .from("risks")
      .select("id, title, status, level, score")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(60)
      .returns<RiskRow[]>(),
    supabase
      .from("audit_engagements")
      .select("id, audit_plan_item_id, title, status, planned_start_date, planned_end_date")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<EngagementRow[]>(),
    getAuditEntries("audit_plan", plan.id),
  ]);

  const owner = ownerResult.data;
  const items = itemsResult.data ?? [];
  const entityOptions = entityOptionsResult.data ?? [];
  const riskOptions = riskOptionsResult.data ?? [];
  const engagements = engagementsResult.data ?? [];

  const entityById = new Map(entityOptions.map((entity) => [entity.id, entity]));
  const riskById = new Map(riskOptions.map((risk) => [risk.id, risk]));
  const engagementsByItemId = new Map<string, EngagementRow[]>();

  for (const engagement of engagements) {
    const current = engagementsByItemId.get(engagement.audit_plan_item_id) ?? [];
    current.push(engagement);
    engagementsByItemId.set(engagement.audit_plan_item_id, current);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatAuditPeriodLabel(plan.plan_year, plan.cycle)} | {plan.status}
          </p>
        </div>

        {canManage ? (
          <Link href={`/dashboard/audits/plans/${plan.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            Edit
          </Link>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Summary</p>
        <p className="mt-2 whitespace-pre-line text-sm">{plan.summary ?? "-"}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Period</p>
          <p className="mt-1 text-sm font-medium">{formatAuditPeriodLabel(plan.plan_year, plan.cycle)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{plan.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(plan.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(plan.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Plan items</h2>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No plan items added yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => {
              const entity = item.auditable_entity_id ? entityById.get(item.auditable_entity_id) : null;
              const risk = item.risk_id ? riskById.get(item.risk_id) : null;
              const itemEngagements = engagementsByItemId.get(item.id) ?? [];

              return (
                <li key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.topic}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.status}</p>
                    </div>

                    {canManage ? (
                      <Link
                        href={`/dashboard/audits/engagements/new?auditPlanItemId=${item.id}`}
                        className={buttonVariants({ variant: "outline" })}
                      >
                        Start engagement
                      </Link>
                    ) : null}
                  </div>

                  {entity ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Entity: {entity.name} ({formatEntityTypeLabel(entity.entity_type)})
                    </p>
                  ) : null}

                  {risk ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Risk: {risk.title} ({risk.status} / {risk.level} / score {risk.score})
                    </p>
                  ) : null}

                  {item.notes ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{item.notes}</p>
                  ) : null}

                  {itemEngagements.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {itemEngagements.map((engagement) => (
                        <li key={engagement.id} className="rounded-md border bg-muted/20 p-3">
                          <Link
                            href={`/dashboard/audits/engagements/${engagement.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {engagement.title}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {engagement.status} | {engagement.planned_start_date} to {engagement.planned_end_date}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canManage ? (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Add plan item</h2>

          <form action={createAuditPlanItemAction} className="mt-4 space-y-4">
            <input type="hidden" name="auditPlanId" value={plan.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="topic" className="text-sm font-medium">
                  Topic
                </label>
                <input
                  id="topic"
                  name="topic"
                  required
                  maxLength={180}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="auditableEntityId" className="text-sm font-medium">
                  Auditable entity
                </label>
                <select
                  id="auditableEntityId"
                  name="auditableEntityId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">No linked entity</option>
                  {entityOptions.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({formatEntityTypeLabel(entity.entity_type)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="riskId" className="text-sm font-medium">
                  Risk
                </label>
                <select
                  id="riskId"
                  name="riskId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">No linked risk</option>
                  {riskOptions.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="planned"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {auditPlanItemStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  maxLength={4000}
                  className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button type="submit" className={buttonVariants()}>
              Add item
            </button>
          </form>
        </section>
      ) : null}

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
