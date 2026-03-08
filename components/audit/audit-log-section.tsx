import { type AuditEntry } from "@/lib/audit/log";

type AuditLogSectionProps = {
  title?: string;
  items: AuditEntry[];
};

function renderSummary(summary: Record<string, unknown>) {
  const entries = Object.entries(summary);

  if (entries.length === 0) {
    return <p className="mt-1 text-xs text-muted-foreground">No additional details.</p>;
  }

  return (
    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
      {entries.map(([key, value]) => (
        <li key={key}>
          <span className="font-medium">{key}:</span> {String(value)}
        </li>
      ))}
    </ul>
  );
}

export function AuditLogSection({ title = "Audit log", items }: AuditLogSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{item.action.replace("_", " ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.actorLabel} | {new Date(item.createdAt).toLocaleString()}
              </p>
              {renderSummary(item.summary)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
