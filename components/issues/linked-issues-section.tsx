import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type LinkedIssue = {
  id: string;
  title: string;
  issueType: string;
  status: string;
  severity: string;
  dueDate: string | null;
  ageDays: number;
  overdue: boolean;
};

type LinkedIssuesSectionProps = {
  title?: string;
  items: LinkedIssue[];
  emptyMessage: string;
  canCreate?: boolean;
  createHref?: string;
  createLabel?: string;
};

function formatIssueTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function LinkedIssuesSection({
  title = "Linked issues",
  items,
  emptyMessage,
  canCreate = false,
  createHref,
  createLabel = "Raise issue",
}: LinkedIssuesSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {canCreate && createHref ? (
          <Link href={createHref} className={cn(buttonVariants({ variant: "outline" }))}>
            {createLabel}
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((issue) => (
            <li key={issue.id} className="rounded-lg border p-3">
              <Link href={`/dashboard/issues/${issue.id}`} className="text-sm font-medium hover:underline">
                {issue.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatIssueTypeLabel(issue.issueType)} | {issue.status} | {issue.severity}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Age: {issue.ageDays}d | Due: {issue.dueDate ?? "-"}
                {issue.overdue ? " | Overdue" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
