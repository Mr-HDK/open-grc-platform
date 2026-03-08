import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RiskRow = {
  id: string;
  status: "draft" | "open" | "mitigated" | "accepted" | "closed";
  level: "low" | "medium" | "high" | "critical";
  impact: number;
  likelihood: number;
};

type ActionRow = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "blocked" | "done" | "cancelled";
  target_date: string;
};

type ControlRow = {
  id: string;
  code: string;
  title: string;
  next_review_date: string | null;
  effectiveness_status: string;
};

const riskStatuses: RiskRow["status"][] = ["draft", "open", "mitigated", "accepted", "closed"];
const riskLevels: RiskRow["level"][] = ["low", "medium", "high", "critical"];

const errorMessageByCode: Record<string, string> = {
  forbidden: "You do not have access to that area.",
};

async function signOut() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function countByKey<T extends string>(values: T[], keys: T[]) {
  const map = new Map<T, number>(keys.map((key) => [key, 0]));

  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }

  return map;
}

function buildHeatmap(risks: RiskRow[]) {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));

  for (const risk of risks) {
    matrix[risk.impact - 1][risk.likelihood - 1] += 1;
  }

  return matrix;
}

function isOverdueAction(action: ActionRow, todayIso: string) {
  if (action.status === "done" || action.status === "cancelled") {
    return false;
  }

  return action.target_date < todayIso;
}

function isControlReviewDueSoon(control: ControlRow, limitIso: string) {
  if (!control.next_review_date) {
    return false;
  }

  return control.next_review_date <= limitIso;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const profile = await getSessionProfile();
  const errorMessage = params.error
    ? errorMessageByCode[params.error] ?? "Action blocked."
    : null;

  const supabase = await createSupabaseServerClient();
  const [{ data: risks }, { data: actionPlans }, { data: controls }] = await Promise.all([
    supabase
      .from("risks")
      .select("id, status, level, impact, likelihood")
      .is("deleted_at", null)
      .returns<RiskRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title, priority, status, target_date")
      .is("deleted_at", null)
      .returns<ActionRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title, next_review_date, effectiveness_status")
      .is("deleted_at", null)
      .returns<ControlRow[]>(),
  ]);

  const riskRows = risks ?? [];
  const actionRows = actionPlans ?? [];
  const controlRows = controls ?? [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const in30DaysIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const riskByStatus = countByKey(
    riskRows.map((risk) => risk.status),
    riskStatuses,
  );

  const riskByLevel = countByKey(
    riskRows.map((risk) => risk.level),
    riskLevels,
  );

  const overdueActions = actionRows
    .filter((action) => isOverdueAction(action, todayIso))
    .sort((left, right) => left.target_date.localeCompare(right.target_date));

  const controlsDueSoon = controlRows
    .filter((control) => isControlReviewDueSoon(control, in30DaysIso))
    .sort((left, right) => (left.next_review_date ?? "").localeCompare(right.next_review_date ?? ""));

  const heatmap = buildHeatmap(riskRows);

  const maxStatusCount = Math.max(...Array.from(riskByStatus.values()), 1);
  const maxLevelCount = Math.max(...Array.from(riskByLevel.values()), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{profile?.role ?? "viewer"}</span>.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total risks" value={String(riskRows.length)} helper="Active risk records" />
        <Card
          title="Open risks"
          value={String(riskByStatus.get("open") ?? 0)}
          helper="Status = open"
        />
        <Card
          title="Overdue actions"
          value={String(overdueActions.length)}
          helper="Target date before today"
        />
        <Card
          title="Controls due soon"
          value={String(controlsDueSoon.length)}
          helper="Next review in <= 30 days"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Risks by status</h2>
          <div className="mt-4 space-y-3">
            {riskStatuses.map((status) => {
              const count = riskByStatus.get(status) ?? 0;
              const width = `${(count / maxStatusCount) * 100}%`;

              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-slate-700" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Risks by level</h2>
          <div className="mt-4 space-y-3">
            {riskLevels.map((level) => {
              const count = riskByLevel.get(level) ?? 0;
              const width = `${(count / maxLevelCount) * 100}%`;

              return (
                <div key={level} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{level}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-sky-700" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Risk heatmap (impact x likelihood)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Rows = impact (5 high to 1 low), columns = likelihood (1 low to 5 high).
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2 text-left text-xs text-muted-foreground">Impact \ Likelihood</th>
                {[1, 2, 3, 4, 5].map((likelihood) => (
                  <th key={likelihood} className="border p-2 text-center text-xs text-muted-foreground">
                    {likelihood}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map((impact) => (
                <tr key={impact}>
                  <th className="border p-2 text-left text-xs text-muted-foreground">{impact}</th>
                  {[1, 2, 3, 4, 5].map((likelihood) => {
                    const count = heatmap[impact - 1][likelihood - 1];
                    const intensity = Math.min(1, count / 3);

                    return (
                      <td
                        key={`${impact}-${likelihood}`}
                        className="border p-2 text-center font-medium"
                        style={{ backgroundColor: `rgba(15, 23, 42, ${0.05 + intensity * 0.25})` }}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Overdue actions</h2>

          {overdueActions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No overdue actions.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overdueActions.slice(0, 8).map((action) => (
                <li key={action.id} className="rounded-lg border p-3">
                  <Link href={`/dashboard/actions/${action.id}`} className="text-sm font-medium hover:underline">
                    {action.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {action.priority} | due {action.target_date} | {action.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Controls to review soon</h2>

          {controlsDueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No controls due within 30 days.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {controlsDueSoon.slice(0, 8).map((control) => (
                <li key={control.id} className="rounded-lg border p-3">
                  <Link
                    href={`/dashboard/controls/${control.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {control.code} - {control.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    next review {control.next_review_date} | {control.effectiveness_status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
