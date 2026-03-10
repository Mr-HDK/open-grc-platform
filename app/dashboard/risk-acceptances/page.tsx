import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRiskAcceptanceStatus,
  riskAcceptanceStatusOptions,
  type RiskAcceptanceStatus,
} from "@/lib/validators/risk-acceptance";
import { cn } from "@/lib/utils/cn";

type RiskAcceptanceRow = {
  id: string;
  risk_id: string;
  approved_by_profile_id: string;
  expiration_date: string;
  status: RiskAcceptanceStatus;
  control_id: string | null;
  action_plan_id: string | null;
  updated_at: string;
};

type RiskRow = { id: string; title: string };
type ControlRow = { id: string; code: string; title: string };
type ActionPlanRow = { id: string; title: string };
type ProfileRow = { id: string; email: string; full_name: string | null };

function toUtcDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`);
}

function daysUntil(dateValue: string) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const target = toUtcDate(dateValue);
  return Math.floor((target.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

function deriveEffectiveStatus(status: RiskAcceptanceStatus, expirationDate: string): RiskAcceptanceStatus {
  if (status === "revoked") {
    return "revoked";
  }
  return daysUntil(expirationDate) < 0 ? "expired" : "active";
}

export default async function RiskAcceptancesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; riskId?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const status = isRiskAcceptanceStatus(params.status) ? params.status : "";
  const riskId = params.riskId?.trim() ?? "";

  let query = supabase
    .from("risk_acceptances")
    .select("id, risk_id, approved_by_profile_id, expiration_date, status, control_id, action_plan_id, updated_at")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("expiration_date", { ascending: true });

  if (riskId) {
    query = query.eq("risk_id", riskId);
  }

  const [{ data: acceptances, error }, { data: risks }, { data: controls }, { data: actionPlans }, { data: profiles }] =
    await Promise.all([
      query.returns<RiskAcceptanceRow[]>(),
      supabase
        .from("risks")
        .select("id, title")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .returns<RiskRow[]>(),
      supabase
        .from("controls")
        .select("id, code, title")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .returns<ControlRow[]>(),
      supabase
        .from("action_plans")
        .select("id, title")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .returns<ActionPlanRow[]>(),
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("organization_id", profile.organizationId)
        .returns<ProfileRow[]>(),
    ]);

  const riskById = new Map((risks ?? []).map((risk) => [risk.id, risk.title]));
  const controlById = new Map(
    (controls ?? []).map((control) => [control.id, `${control.code} - ${control.title}`]),
  );
  const actionPlanById = new Map((actionPlans ?? []).map((actionPlan) => [actionPlan.id, actionPlan.title]));
  const profileById = new Map(
    (profiles ?? []).map((item) => [
      item.id,
      item.full_name ? `${item.full_name} (${item.email})` : item.email,
    ]),
  );
  const filteredAcceptances = (acceptances ?? []).filter((acceptance) => {
    if (!status) {
      return true;
    }
    return deriveEffectiveStatus(acceptance.status, acceptance.expiration_date) === status;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk acceptances</h1>
          <p className="text-sm text-muted-foreground">
            Track risk acceptances, expirations, and exceptions by approver.
          </p>
        </div>
        {canManage ? (
          <Link href="/dashboard/risk-acceptances/new" className={buttonVariants()}>
            New acceptance
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {riskAcceptanceStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="riskId"
          aria-label="Filter by risk"
          defaultValue={riskId}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All risks</option>
          {(risks ?? []).map((risk) => (
            <option key={risk.id} value={risk.id}>
              {risk.title}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
          <caption className="sr-only">Risk acceptances results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Risk
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Expiration
              </th>
              <th scope="col" className="px-4 py-3">
                Reminder
              </th>
              <th scope="col" className="px-4 py-3">
                Approver
              </th>
              <th scope="col" className="px-4 py-3">
                Control
              </th>
              <th scope="col" className="px-4 py-3">
                Action plan
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAcceptances.map((acceptance) => {
              const effectiveStatus = deriveEffectiveStatus(acceptance.status, acceptance.expiration_date);
              const remainingDays = daysUntil(acceptance.expiration_date);
              const reminder =
                effectiveStatus === "revoked"
                  ? "-"
                  : remainingDays < 0
                    ? `Expired ${Math.abs(remainingDays)}d ago`
                    : remainingDays <= 14
                      ? `Expires in ${remainingDays}d`
                      : "-";

              return (
                <tr key={acceptance.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/risk-acceptances/${acceptance.id}`}
                      className="font-medium hover:underline"
                    >
                      {riskById.get(acceptance.risk_id) ?? "Unknown risk"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">{effectiveStatus}</td>
                  <td className="px-4 py-3 text-muted-foreground">{acceptance.expiration_date}</td>
                  <td
                    className={cn(
                      "px-4 py-3",
                      reminder.includes("Expired")
                        ? "text-red-700"
                        : reminder.includes("Expires in")
                          ? "text-amber-700"
                          : "text-muted-foreground",
                    )}
                  >
                    {reminder}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {profileById.get(acceptance.approved_by_profile_id) ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {acceptance.control_id ? controlById.get(acceptance.control_id) ?? "Unknown" : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {acceptance.action_plan_id
                      ? actionPlanById.get(acceptance.action_plan_id) ?? "Unknown"
                      : "-"}
                  </td>
                </tr>
              );
            })}

            {!error && filteredAcceptances.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No risk acceptances found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
