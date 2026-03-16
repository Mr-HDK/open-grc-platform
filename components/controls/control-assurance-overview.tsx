import { toLabel } from "@/lib/control-assurance/health";

type ControlAssuranceOverviewProps = {
  health: "healthy" | "at_risk";
  overdueAttestations: number;
  openEvidenceRequests: number;
  overdueEvidenceRequests: number;
  openFindings: number;
  latestTestResult: string | null;
};

export function ControlAssuranceOverview({
  health,
  overdueAttestations,
  openEvidenceRequests,
  overdueEvidenceRequests,
  openFindings,
  latestTestResult,
}: ControlAssuranceOverviewProps) {
  const cards = [
    {
      label: "Health",
      value: toLabel(health),
      tone:
        health === "healthy"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      label: "Overdue attestations",
      value: String(overdueAttestations),
      tone: overdueAttestations > 0 ? "border-rose-200 bg-rose-50 text-rose-900" : "",
    },
    {
      label: "Open evidence requests",
      value: `${openEvidenceRequests}${overdueEvidenceRequests > 0 ? ` (${overdueEvidenceRequests} overdue)` : ""}`,
      tone: overdueEvidenceRequests > 0 ? "border-rose-200 bg-rose-50 text-rose-900" : "",
    },
    {
      label: "Open findings",
      value: String(openFindings),
      tone: openFindings > 0 ? "border-rose-200 bg-rose-50 text-rose-900" : "",
    },
    {
      label: "Latest test",
      value: latestTestResult ? toLabel(latestTestResult) : "none",
      tone:
        latestTestResult === "failed" || latestTestResult === "partial"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "",
    },
  ];

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Control assurance</h2>
        <p className="text-xs text-muted-foreground">
          Operating view across attestations, evidence, tests, and findings.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`rounded-lg border p-3 ${card.tone || "bg-muted/20"}`}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-sm font-semibold capitalize">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
