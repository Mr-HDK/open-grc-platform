import Link from "next/link";

import { runReminderSyncAction } from "@/app/dashboard/notifications/actions";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { queryDirect } from "@/lib/db/direct";
import { cn } from "@/lib/utils/cn";

type NotificationEventRow = {
  id: string;
  reminder_type: "overdue_action" | "control_review_due" | "risk_acceptance_expiring";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  due_date: string | null;
  metadata: Record<string, unknown> | null;
  last_detected_at: string;
};

type LatestEventRow = {
  updated_at: string;
};

const groupOrder: NotificationEventRow["reminder_type"][] = [
  "overdue_action",
  "control_review_due",
  "risk_acceptance_expiring",
];

const groupLabels: Record<
  NotificationEventRow["reminder_type"],
  { title: string; description: string; empty: string }
> = {
  overdue_action: {
    title: "Overdue actions",
    description: "Action plans that missed their target date and still require remediation.",
    empty: "No overdue actions in the synced queue.",
  },
  control_review_due: {
    title: "Control reviews due soon",
    description: "Controls with a review date within the 30-day reminder window.",
    empty: "No due-soon control reviews in the synced queue.",
  },
  risk_acceptance_expiring: {
    title: "Risk acceptances expiring soon",
    description: "Accepted risks that are approaching expiration or already expired.",
    empty: "No expiring risk acceptances in the synced queue.",
  },
};

const severityClasses: Record<NotificationEventRow["severity"], string> = {
  info: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-800",
};

const severityRank: Record<NotificationEventRow["severity"], number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

function compareEvents(left: NotificationEventRow, right: NotificationEventRow) {
  const severityDelta = severityRank[right.severity] - severityRank[left.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  const dueDelta = (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31");
  if (dueDelta !== 0) {
    return dueDelta;
  }

  return left.title.localeCompare(right.title);
}

function eventPath(metadata: Record<string, unknown> | null) {
  return metadata && typeof metadata.path === "string" ? metadata.path : null;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  let errorMessage: string | null = null;
  let events: NotificationEventRow[] = [];
  let latestUpdate: LatestEventRow | null = null;

  try {
    const [eventsResult, latestResult] = await Promise.all([
      queryDirect<NotificationEventRow>(
        `select
          id,
          reminder_type,
          title,
          message,
          severity,
          due_date::text as due_date,
          metadata,
          last_detected_at::text as last_detected_at
        from public.notification_events
        where organization_id = $1::uuid
          and resolved_at is null
        order by last_detected_at desc`,
        [profile.organizationId],
      ),
      queryDirect<LatestEventRow>(
        `select updated_at::text as updated_at
        from public.notification_events
        where organization_id = $1::uuid
        order by updated_at desc
        limit 1`,
        [profile.organizationId],
      ),
    ]);

    events = eventsResult.rows;
    latestUpdate = latestResult.rows[0] ?? null;
  } catch (error) {
    errorMessage = (error as Error).message;
  }

  const sortedEvents = events.sort(compareEvents);
  const countByType = new Map<NotificationEventRow["reminder_type"], number>();

  for (const type of groupOrder) {
    countByType.set(type, sortedEvents.filter((event) => event.reminder_type === type).length);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Scheduler-backed reminder queue for overdue actions, due control reviews, and expiring
            risk acceptances.
          </p>
          {latestUpdate?.updated_at ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Latest reminder update: {new Date(latestUpdate.updated_at).toLocaleString()}
            </p>
          ) : null}
        </div>

        <form action={runReminderSyncAction}>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Run reminder sync
          </button>
        </form>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}
      {params.success ? (
        <FeedbackAlert
          variant="success"
          title="Reminder sync complete."
          message={decodeURIComponent(params.success)}
        />
      ) : null}
      {errorMessage ? <FeedbackAlert message={errorMessage} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active reminders
          </p>
          <p className="mt-2 text-3xl font-semibold">{sortedEvents.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">All unresolved reminder events.</p>
        </article>
        {groupOrder.map((type) => (
          <article key={type} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {groupLabels[type].title}
            </p>
            <p className="mt-2 text-3xl font-semibold">{countByType.get(type) ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{groupLabels[type].description}</p>
          </article>
        ))}
      </section>

      {groupOrder.map((type) => {
        const items = sortedEvents.filter((event) => event.reminder_type === type);
        const config = groupLabels[type];

        return (
          <section key={type} className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{config.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{items.length} active</span>
            </div>

            {items.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{config.empty}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {items.map((event) => {
                  const href = eventPath(event.metadata);

                  return (
                    <li key={event.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          {href ? (
                            <Link href={href} className="text-sm font-medium hover:underline">
                              {event.title}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium">{event.title}</p>
                          )}
                          <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide",
                            severityClasses[event.severity],
                          )}
                        >
                          {event.severity}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Due {event.due_date ?? "-"}</span>
                        <span>Last detected {new Date(event.last_detected_at).toLocaleString()}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
