import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { formatAuditPeriodLabel } from "@/lib/audits/period";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditEngagementStatusOptions,
  auditPlanCycleOptions,
  auditPlanStatusOptions,
  isAuditEngagementStatus,
  isAuditPlanCycle,
  isAuditPlanStatus,
  type AuditEngagementStatus,
  type AuditPlanCycle,
  type AuditPlanStatus,
} from "@/lib/validators/audit";
import { cn } from "@/lib/utils/cn";

type AuditPlanRow = {
  id: string;
  title: string;
  plan_year: number;
  cycle: AuditPlanCycle;
  status: AuditPlanStatus;
  owner_profile_id: string | null;
  updated_at: string;
};

type AuditPlanListRow = AuditPlanRow;

type AuditPlanReferenceRow = {
  id: string;
  title: string;
  plan_year: number;
  cycle: AuditPlanCycle;
};

type AuditPlanItemReferenceRow = {
  id: string;
  audit_plan_id: string;
  topic: string;
};

type AuditEngagementRow = {
  id: string;
  audit_plan_item_id: string;
  title: string;
  lead_auditor_profile_id: string | null;
  status: AuditEngagementStatus;
  planned_start_date: string;
  planned_end_date: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function formatCycleLabel(value: string) {
  return value === "semiannual" ? "Semiannual" : "Annual";
}

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{
    planStatus?: string;
    planOwner?: string;
    planYear?: string;
    planCycle?: string;
    engagementStatus?: string;
    leadAuditor?: string;
    engagementYear?: string;
    engagementCycle?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const params = await searchParams;

  const planStatus = isAuditPlanStatus(params.planStatus) ? params.planStatus : "";
  const planCycle = isAuditPlanCycle(params.planCycle) ? params.planCycle : "";
  const planOwner = z.string().uuid().safeParse(params.planOwner).success ? (params.planOwner ?? "") : "";
  const parsedPlanYear = Number(params.planYear ?? "");
  const planYear = Number.isInteger(parsedPlanYear) ? parsedPlanYear : null;

  const engagementStatus = isAuditEngagementStatus(params.engagementStatus) ? params.engagementStatus : "";
  const leadAuditor = z.string().uuid().safeParse(params.leadAuditor).success
    ? (params.leadAuditor ?? "")
    : "";
  const parsedEngagementYear = Number(params.engagementYear ?? "");
  const engagementYear = Number.isInteger(parsedEngagementYear) ? parsedEngagementYear : null;
  const engagementCycle = isAuditPlanCycle(params.engagementCycle) ? params.engagementCycle : "";

  const supabase = await createSupabaseServerClient();

  let plansQuery = supabase
    .from("audit_plans")
    .select("id, title, plan_year, cycle, status, owner_profile_id, updated_at")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("plan_year", { ascending: false })
    .order("title", { ascending: true });

  if (planStatus) {
    plansQuery = plansQuery.eq("status", planStatus);
  }

  if (planOwner) {
    plansQuery = plansQuery.eq("owner_profile_id", planOwner);
  }

  if (planYear) {
    plansQuery = plansQuery.eq("plan_year", planYear);
  }

  if (planCycle) {
    plansQuery = plansQuery.eq("cycle", planCycle);
  }

  let engagementPlanQuery = supabase
    .from("audit_plans")
    .select("id, title, plan_year, cycle")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (engagementYear) {
    engagementPlanQuery = engagementPlanQuery.eq("plan_year", engagementYear);
  }

  if (engagementCycle) {
    engagementPlanQuery = engagementPlanQuery.eq("cycle", engagementCycle);
  }

  const [
    { data: plans, error: plansError },
    { data: engagementPlans },
    { data: allPlans },
    { data: owners },
  ] = await Promise.all([
    plansQuery.returns<AuditPlanListRow[]>(),
    engagementPlanQuery.returns<AuditPlanReferenceRow[]>(),
    supabase
      .from("audit_plans")
      .select("id, title, plan_year, cycle")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<AuditPlanReferenceRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
  ]);

  const engagementPlanIds = (engagementPlans ?? []).map((plan) => plan.id);
  const allPlanIds = (allPlans ?? []).map((plan) => plan.id);

  let planItemsQuery = supabase
    .from("audit_plan_items")
    .select("id, audit_plan_id, topic")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (engagementYear || engagementCycle) {
    if (engagementPlanIds.length === 0) {
      planItemsQuery = planItemsQuery.in("audit_plan_id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      planItemsQuery = planItemsQuery.in("audit_plan_id", engagementPlanIds);
    }
  } else if (allPlanIds.length > 0) {
    planItemsQuery = planItemsQuery.in("audit_plan_id", allPlanIds);
  }

  const { data: planItems } = await planItemsQuery.returns<AuditPlanItemReferenceRow[]>();
  const planItemIds = (planItems ?? []).map((item) => item.id);

  let engagementsQuery = supabase
    .from("audit_engagements")
    .select(
      "id, audit_plan_item_id, title, lead_auditor_profile_id, status, planned_start_date, planned_end_date, updated_at",
    )
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("planned_start_date", { ascending: true });

  if (engagementStatus) {
    engagementsQuery = engagementsQuery.eq("status", engagementStatus);
  }

  if (leadAuditor) {
    engagementsQuery = engagementsQuery.eq("lead_auditor_profile_id", leadAuditor);
  }

  if (planItemIds.length > 0) {
    engagementsQuery = engagementsQuery.in("audit_plan_item_id", planItemIds);
  } else if (engagementYear || engagementCycle) {
    engagementsQuery = engagementsQuery.in("audit_plan_item_id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: engagements, error: engagementsError } = await engagementsQuery.returns<AuditEngagementRow[]>();

  const ownerById = new Map(
    (owners ?? []).map((owner) => [
      owner.id,
      owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
    ]),
  );
  const planById = new Map((allPlans ?? []).map((plan) => [plan.id, plan]));
  const planItemById = new Map((planItems ?? []).map((item) => [item.id, item]));

  const uniqueYears = Array.from(
    new Set((allPlans ?? []).map((plan) => String(plan.plan_year))),
  ).sort((left, right) => Number(right) - Number(left));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audits</h1>
          <p className="text-sm text-muted-foreground">
            Plan internal audits, launch engagements, and capture working papers against existing findings and actions.
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/audits/plans/new" className={buttonVariants({ variant: "outline" })}>
              New plan
            </Link>
            <Link href="/dashboard/audits/engagements/new" className={buttonVariants()}>
              New engagement
            </Link>
          </div>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Audit plans</h2>
          <p className="text-sm text-muted-foreground">Annual and semiannual planning cycles.</p>
        </div>

        <form className="grid gap-3 md:grid-cols-5">
          <select
            name="planStatus"
            aria-label="Filter plans by status"
            defaultValue={planStatus}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {auditPlanStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            name="planOwner"
            aria-label="Filter plans by owner"
            defaultValue={planOwner}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All owners</option>
            {(owners ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email}
              </option>
            ))}
          </select>

          <select
            name="planYear"
            aria-label="Filter plans by year"
            defaultValue={planYear ? String(planYear) : ""}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All years</option>
            {uniqueYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            name="planCycle"
            aria-label="Filter plans by cycle"
            defaultValue={planCycle}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All cycles</option>
            {auditPlanCycleOptions.map((option) => (
              <option key={option} value={option}>
                {formatCycleLabel(option)}
              </option>
            ))}
          </select>

          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Apply plan filters
          </button>
        </form>

        {plansError ? <FeedbackAlert message={plansError.message} /> : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Plan
                </th>
                <th scope="col" className="px-4 py-3">
                  Period
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Owner
                </th>
                <th scope="col" className="px-4 py-3">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {(plans ?? []).map((plan) => (
                <tr key={plan.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/audits/plans/${plan.id}`} className="font-medium hover:underline">
                      {plan.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatAuditPeriodLabel(plan.plan_year, plan.cycle)}
                  </td>
                  <td className="px-4 py-3">{plan.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {plan.owner_profile_id ? ownerById.get(plan.owner_profile_id) ?? "Unknown" : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(plan.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}

              {!plansError && (plans?.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    No audit plans found for the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Audit engagements</h2>
          <p className="text-sm text-muted-foreground">Fieldwork, reporting, and remediation tracking.</p>
        </div>

        <form className="grid gap-3 md:grid-cols-5">
          <select
            name="engagementStatus"
            aria-label="Filter engagements by status"
            defaultValue={engagementStatus}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {auditEngagementStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            name="leadAuditor"
            aria-label="Filter engagements by lead auditor"
            defaultValue={leadAuditor}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All lead auditors</option>
            {(owners ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email}
              </option>
            ))}
          </select>

          <select
            name="engagementYear"
            aria-label="Filter engagements by year"
            defaultValue={engagementYear ? String(engagementYear) : ""}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All years</option>
            {uniqueYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            name="engagementCycle"
            aria-label="Filter engagements by cycle"
            defaultValue={engagementCycle}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All cycles</option>
            {auditPlanCycleOptions.map((option) => (
              <option key={option} value={option}>
                {formatCycleLabel(option)}
              </option>
            ))}
          </select>

          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Apply engagement filters
          </button>
        </form>

        {engagementsError ? <FeedbackAlert message={engagementsError.message} /> : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Engagement
                </th>
                <th scope="col" className="px-4 py-3">
                  Plan item
                </th>
                <th scope="col" className="px-4 py-3">
                  Period
                </th>
                <th scope="col" className="px-4 py-3">
                  Lead auditor
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Planned dates
                </th>
              </tr>
            </thead>
            <tbody>
              {(engagements ?? []).map((engagement) => {
                const planItem = planItemById.get(engagement.audit_plan_item_id);
                const plan = planItem ? planById.get(planItem.audit_plan_id) : null;

                return (
                  <tr key={engagement.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/audits/engagements/${engagement.id}`}
                        className="font-medium hover:underline"
                      >
                        {engagement.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{planItem?.topic ?? "Unknown item"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {plan ? formatAuditPeriodLabel(plan.plan_year, plan.cycle) : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {engagement.lead_auditor_profile_id
                        ? ownerById.get(engagement.lead_auditor_profile_id) ?? "Unknown"
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{engagement.status}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {engagement.planned_start_date} to {engagement.planned_end_date}
                    </td>
                  </tr>
                );
              })}

              {!engagementsError && (engagements?.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    No audit engagements found for the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
