import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import {
  actionPriorityOptions,
  actionStatusOptions,
  isActionPriority,
  isActionStatus,
  isOverdueAction,
} from "@/lib/validators/action-plan";

type ActionPlanListItem = {
  id: string;
  title: string;
  risk_id: string | null;
  control_id: string | null;
  status: string;
  priority: string;
  target_date: string;
  completed_at: string | null;
  updated_at: string;
};

type RiskLabelRow = {
  id: string;
  title: string;
};

type ControlLabelRow = {
  id: string;
  code: string;
  title: string;
};

export default async function ActionPlansPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    overdue?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = isActionStatus(params.status) ? params.status : "";
  const priority = isActionPriority(params.priority) ? params.priority : "";
  const overdueFilter = params.overdue === "yes" || params.overdue === "no" ? params.overdue : "";

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("action_plans")
    .select("id, title, risk_id, control_id, status, priority, target_date, completed_at, updated_at")
    .is("deleted_at", null)
    .order("target_date", { ascending: true });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (priority) {
    query = query.eq("priority", priority);
  }

  const { data, error } = await query.returns<ActionPlanListItem[]>();

  let rows = data ?? [];

  if (overdueFilter) {
    rows = rows.filter((row) => {
      const overdue = isOverdueAction(row.target_date, row.status);
      return overdueFilter === "yes" ? overdue : !overdue;
    });
  }

  const riskIds = Array.from(new Set(rows.map((item) => item.risk_id).filter(Boolean))) as string[];
  const controlIds = Array.from(new Set(rows.map((item) => item.control_id).filter(Boolean))) as string[];

  const [riskLabels, controlLabels] = await Promise.all([
    riskIds.length
      ? supabase.from("risks").select("id, title").in("id", riskIds).returns<RiskLabelRow[]>()
      : Promise.resolve({ data: [] as RiskLabelRow[] }),
    controlIds.length
      ? supabase
          .from("controls")
          .select("id, code, title")
          .in("id", controlIds)
          .returns<ControlLabelRow[]>()
      : Promise.resolve({ data: [] as ControlLabelRow[] }),
  ]);

  const riskById = new Map((riskLabels.data ?? []).map((risk) => [risk.id, risk.title]));
  const controlById = new Map(
    (controlLabels.data ?? []).map((control) => [control.id, `${control.code} - ${control.title}`]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Action plans</h1>
          <p className="text-sm text-muted-foreground">
            Track remediation work linked to risks and controls.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/actions/new" className={buttonVariants()}>
            New action plan
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <Input name="q" placeholder="Search by title" defaultValue={q} />

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {actionStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="priority"
          aria-label="Filter by priority"
          defaultValue={priority}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All priorities</option>
          {actionPriorityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="overdue"
          aria-label="Filter by overdue state"
          defaultValue={overdueFilter}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All timelines</option>
          <option value="yes">Overdue only</option>
          <option value="no">Not overdue</option>
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[920px] text-left text-sm">
          <caption className="sr-only">Action plan results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Priority
              </th>
              <th scope="col" className="px-4 py-3">
                Target
              </th>
              <th scope="col" className="px-4 py-3">
                Overdue
              </th>
              <th scope="col" className="px-4 py-3">
                Links
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const overdue = isOverdueAction(item.target_date, item.status);
              const linkedRisk = item.risk_id ? riskById.get(item.risk_id) : null;
              const linkedControl = item.control_id ? controlById.get(item.control_id) : null;

              return (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/actions/${item.id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">{item.priority}</td>
                  <td className="px-4 py-3">{item.target_date}</td>
                  <td className="px-4 py-3">
                    {overdue ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                        Yes
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{linkedRisk ? `Risk: ${linkedRisk}` : "Risk: -"}</div>
                    <div>{linkedControl ? `Control: ${linkedControl}` : "Control: -"}</div>
                  </td>
                </tr>
              );
            })}

            {!error && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No action plans found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
