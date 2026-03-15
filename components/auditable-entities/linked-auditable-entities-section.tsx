import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { type LinkedAuditableEntity } from "@/lib/auditable-entities/links";

type LinkedAuditableEntitiesSectionProps = {
  title: string;
  items: LinkedAuditableEntity[];
  emptyMessage: string;
  canCreate?: boolean;
  createHref?: string;
  createLabel?: string;
};

function formatEntityTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function LinkedAuditableEntitiesSection({
  title,
  items,
  emptyMessage,
  canCreate = false,
  createHref,
  createLabel = "Link entity",
}: LinkedAuditableEntitiesSectionProps) {
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
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <Link
                href={`/dashboard/auditable-entities/${item.id}`}
                className="text-sm font-medium hover:underline"
              >
                {item.name}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatEntityTypeLabel(item.entityType)} | {item.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
