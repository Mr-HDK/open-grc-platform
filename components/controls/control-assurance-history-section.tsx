import Link from "next/link";

type ControlAssuranceHistoryItem = {
  id: string;
  typeLabel: string;
  title: string;
  dateLabel: string;
  href?: string | null;
  detail: string;
};

type ControlAssuranceHistorySectionProps = {
  items: ControlAssuranceHistoryItem[];
};

export function ControlAssuranceHistorySection({
  items,
}: ControlAssuranceHistorySectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Assurance history</h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No assurance activity recorded for this control yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {item.typeLabel}
              </p>
              {item.href ? (
                <Link href={item.href} className="mt-1 block text-sm font-medium hover:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="mt-1 text-sm font-medium">{item.title}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{item.dateLabel}</p>
              <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
