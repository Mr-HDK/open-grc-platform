import Link from "next/link";

import {
  type FrameworkSummaryItem,
  type PolicyCoverageItem,
  type ReportListItem,
  type ReportPack,
  type ReportSectionId,
} from "@/lib/reporting/packs";

type ReportPackViewProps = {
  pack: ReportPack;
  mode?: "default" | "print";
};

type SectionConfig = {
  title: string;
  description: string;
};

const sectionConfig: Record<ReportSectionId, SectionConfig> = {
  top_risks: {
    title: "Top risks",
    description: "Highest-exposure active risks based on current level and score.",
  },
  overdue_actions: {
    title: "Overdue actions",
    description: "Remediation tasks that have already missed target date.",
  },
  control_watchlist: {
    title: "Control watchlist",
    description: "Controls with upcoming review pressure or weak effectiveness signals.",
  },
  open_findings: {
    title: "Open findings",
    description: "Outstanding findings requiring management follow-up.",
  },
  framework_summary: {
    title: "Framework gap summary",
    description: "Requirement-level coverage and gap rate by framework.",
  },
  vendor_watchlist: {
    title: "Vendor watchlist",
    description: "Critical or time-sensitive third-party reviews.",
  },
  policy_coverage: {
    title: "Policy attestation coverage",
    description: "Active policies with acknowledgement coverage and missing attestations.",
  },
  risk_acceptances: {
    title: "Risk acceptances",
    description: "Accepted risks that are nearing expiration or already expired.",
  },
};

function ListSection({
  title,
  description,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: ReportListItem[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border p-4">
              <Link href={item.href} className="text-sm font-medium hover:underline">
                {item.title}
              </Link>
              <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FrameworkSummarySection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: FrameworkSummaryItem[];
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No framework assessments available.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Framework
                </th>
                <th scope="col" className="px-4 py-3">
                  Coverage
                </th>
                <th scope="col" className="px-4 py-3">
                  Gap rate
                </th>
                <th scope="col" className="px-4 py-3">
                  Assessed
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.name} | {item.version}
                    </p>
                  </td>
                  <td className="px-4 py-3">{item.coverageRate}%</td>
                  <td className="px-4 py-3">{item.gapRate}%</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.assessed}/{item.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PolicyCoverageSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: PolicyCoverageItem[];
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No active policies match the current filters.</p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-lg border p-4">
              <Link href={item.href} className="text-sm font-medium hover:underline">
                {item.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">Version {item.version}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Acknowledged {item.acknowledged}/{item.totalAudience}
              </p>
              <p className="text-xs text-muted-foreground">Missing {item.missing}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function ReportPackView({ pack }: ReportPackViewProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pack.summaryCards.map((card) => (
          <article key={card.id} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
          </article>
        ))}
      </section>

      {pack.sections.map((sectionId) => {
        const config = sectionConfig[sectionId];

        if (sectionId === "framework_summary") {
          return (
            <FrameworkSummarySection
              key={sectionId}
              title={config.title}
              description={config.description}
              items={pack.frameworkSummary}
            />
          );
        }

        if (sectionId === "policy_coverage") {
          return (
            <PolicyCoverageSection
              key={sectionId}
              title={config.title}
              description={config.description}
              items={pack.policyCoverage}
            />
          );
        }

        const listItemsBySection: Record<Exclude<ReportSectionId, "framework_summary" | "policy_coverage">, ReportListItem[]> =
          {
            top_risks: pack.topRisks,
            overdue_actions: pack.overdueActions,
            control_watchlist: pack.controlWatchlist,
            open_findings: pack.openFindings,
            vendor_watchlist: pack.vendorWatchlist,
            risk_acceptances: pack.riskAcceptances,
          };

        const emptyMessageBySection: Record<
          Exclude<ReportSectionId, "framework_summary" | "policy_coverage">,
          string
        > = {
          top_risks: "No active risks match the current filters.",
          overdue_actions: "No overdue actions match the current filters.",
          control_watchlist: "No control watchlist items match the current filters.",
          open_findings: "No open findings match the current filters.",
          vendor_watchlist: "No vendor watchlist items match the current filters.",
          risk_acceptances: "No expiring risk acceptances match the current filters.",
        };

        return (
          <ListSection
            key={sectionId}
            title={config.title}
            description={config.description}
            items={listItemsBySection[sectionId]}
            emptyMessage={emptyMessageBySection[sectionId]}
          />
        );
      })}
    </div>
  );
}
