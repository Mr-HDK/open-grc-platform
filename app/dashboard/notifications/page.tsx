import Link from "next/link";

import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { buttonVariants } from "@/components/ui/button";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";

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

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("manager");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: actionPlans }, { data: controls }] = await Promise.all([
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

  const todayIso = new Date().toISOString().slice(0, 10);
  const in30DaysIso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const overdueActions = (actionPlans ?? [])
    .filter((action) => isOverdueAction(action, todayIso))
    .sort((left, right) => left.target_date.localeCompare(right.target_date));

  const controlsDueSoon = (controls ?? [])
    .filter((control) => isControlReviewDueSoon(control, in30DaysIso))
    .sort((left, right) => (left.next_review_date ?? "").localeCompare(right.next_review_date ?? ""));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Reminders for overdue actions and upcoming control reviews.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Overdue actions</h2>
          <Link
            href="/dashboard/actions?status=open"
            className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
          >
            View action plans
          </Link>
        </div>

        {overdueActions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No overdue actions right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {overdueActions.map((action) => (
              <li key={action.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/actions/${action.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {action.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {action.priority} priority | {action.status} | target {action.target_date}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Control reviews due soon</h2>
          <Link
            href="/dashboard/controls"
            className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
          >
            View controls
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Next review date within 30 days.</p>

        {controlsDueSoon.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No upcoming reviews in the next 30 days.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {controlsDueSoon.map((control) => (
              <li key={control.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/controls/${control.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {control.code} - {control.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  review {control.next_review_date ?? "-"} | {control.effectiveness_status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
