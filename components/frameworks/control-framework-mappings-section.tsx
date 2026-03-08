type ControlFrameworkMapping = {
  requirementId: string;
  frameworkCode: string;
  frameworkVersion: string;
  referenceCode: string;
  title: string;
};

type ControlFrameworkMappingsSectionProps = {
  items: ControlFrameworkMapping[];
};

export function ControlFrameworkMappingsSection({ items }: ControlFrameworkMappingsSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Framework mappings</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No framework requirements mapped.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.requirementId} className="rounded-lg border p-3">
              <p className="text-sm font-medium">
                {item.frameworkCode} {item.referenceCode}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">Version {item.frameworkVersion}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
