import Link from "next/link";

type LinkedRiskItem = {
  id: string;
  title: string;
  status: string;
  level: string;
  score: number;
  rationale: string | null;
};

type LinkedRisksSectionProps = {
  items: LinkedRiskItem[];
};

export function LinkedRisksSection({ items }: LinkedRisksSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Linked risks</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No risks linked to this control.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <Link href={`/dashboard/risks/${item.id}`} className="text-sm font-medium hover:underline">
                {item.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.status} | {item.level} | score {item.score}
              </p>
              {item.rationale ? <p className="mt-2 text-xs text-muted-foreground">{item.rationale}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
