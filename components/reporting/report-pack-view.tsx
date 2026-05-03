import Link from "next/link";

import {
  type AuditStatusCard,
  type ControlHealthItem,
  type FrameworkSummaryItem,
  type PolicyCoverageItem,
  type ReportListItem,
  type ReportPack,
  type ReportSectionId,
} from "@/lib/reporting/packs";

type ReportPackViewProps = {
  pack: ReportPack;
};

type SectionConfig = {
  title: string;
  description: string;
};

const sectionConfig: Record<ReportSectionId, SectionConfig> = {
  top_risks: {
    title: "Top risks",
    description: "Highest-exposure risks based on current level, score, and due-date pressure.",
  },
  open_issues: {
    title: "Open issues",
    description: "Escalation backlog across audit, control, policy, vendor, and incident follow-up items.",
  },
  overdue_actions: {
    title: "Overdue actions",
    description: "Remediation work that has already passed its target date.",
  },
  control_health: {
    title: "Control health",
    description: "Derived assurance posture using attestations, evidence requests, testing, and findings.",
  },
  framework_summary: {
    title: "Framework gaps",
    description: "Coverage and gap rates at requirement level for active framework assessments.",
  },
  vendor_watchlist: {
    title: "Critical vendors",
    description: "Third parties with elevated posture, review horizon, or renewal pressure.",
  },
  policy_coverage: {
    title: "Policy attestation coverage",
    description: "Latest attestation campaign coverage and overdue acknowledgement pressure.",
  },
  audit_state: {
    title: "Audit state",
    description: "Execution status for audit plans, plan items, and in-flight engagements.",
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

function ControlHealthSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ControlHealthItem[];
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No controls match the current filters.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Control</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Effectiveness</th>
                <th className="px-4 py-3">Latest test</th>
                <th className="px-4 py-3">Open findings</th>
                <th className="px-4 py-3">Overdue items</th>
                <th className="px-4 py-3">Next review</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={item.href} className="font-medium hover:underline">
                      {item.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.title}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.ownerLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.health === "at_risk" ? "font-medium text-amber-700" : "text-emerald-700"
                      }
                    >
                      {item.health.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.effectivenessStatus}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.latestTestResult ?? "-"}</td>
                  <td className="px-4 py-3">{item.openFindings}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.overdueAttestations} attestations / {item.overdueEvidenceRequests} evidence
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.nextReviewDate ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Framework</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Gap count</th>
                <th className="px-4 py-3">Gap rate</th>
                <th className="px-4 py-3">Assessed</th>
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
                  <td className="px-4 py-3">{item.gapCount}</td>
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
              <p className="mt-1 text-xs text-muted-foreground">
                Campaign {item.latestCampaignName ?? "not started"}
                {item.campaignDueDate ? ` | due ${item.campaignDueDate}` : ""}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                  Coverage {item.coverageRate}% ({item.acknowledged}/{item.totalAudience})
                </div>
                <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                  Pending {item.pending} | Overdue {item.overdue}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AuditStateSection({
  title,
  description,
  cards,
  engagements,
}: {
  title: string;
  description: string;
  cards: AuditStatusCard[];
  engagements: ReportListItem[];
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.id} className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
          </article>
        ))}
      </div>

      {engagements.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No audit engagements match the current filters.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {engagements.map((engagement) => (
            <li key={engagement.id} className="rounded-lg border p-4">
              <Link href={engagement.href} className="text-sm font-medium hover:underline">
                {engagement.title}
              </Link>
              <p className="mt-2 text-xs text-muted-foreground">{engagement.meta}</p>
            </li>
          ))}
        </ul>
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

        switch (sectionId) {
          case "top_risks":
            return (
              <ListSection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.topRisks}
                emptyMessage="No active risks match the current filters."
              />
            );
          case "open_issues":
            return (
              <ListSection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.openIssues}
                emptyMessage="No issues match the current filters."
              />
            );
          case "overdue_actions":
            return (
              <ListSection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.overdueActions}
                emptyMessage="No overdue actions match the current filters."
              />
            );
          case "control_health":
            return (
              <ControlHealthSection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.controlHealth}
              />
            );
          case "framework_summary":
            return (
              <FrameworkSummarySection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.frameworkSummary}
              />
            );
          case "vendor_watchlist":
            return (
              <ListSection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.vendorWatchlist}
                emptyMessage="No vendors match the current filters."
              />
            );
          case "policy_coverage":
            return (
              <PolicyCoverageSection
                key={sectionId}
                title={config.title}
                description={config.description}
                items={pack.policyCoverage}
              />
            );
          case "audit_state":
            return (
              <AuditStateSection
                key={sectionId}
                title={config.title}
                description={config.description}
                cards={pack.auditStatusCards}
                engagements={pack.auditEngagements}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
