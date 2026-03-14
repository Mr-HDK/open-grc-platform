import Link from "next/link";

import { ReportPackView } from "@/components/reporting/report-pack-view";
import { buttonVariants } from "@/components/ui/button";
import { requireSessionProfile } from "@/lib/auth/profile";
import { getReportingPack } from "@/lib/reporting/packs";

export default async function PrintableReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; owner?: string; horizon?: string }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const { pack } = await getReportingPack(profile, params);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Printable reporting pack</h1>
          <p className="text-sm text-muted-foreground">
            Use your browser print dialog to export this page as HTML or PDF.
          </p>
        </div>

        <Link href="/dashboard/reporting" className={buttonVariants({ variant: "outline" })}>
          Back to reporting
        </Link>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-2xl font-semibold tracking-tight">{pack.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Generated {new Date(pack.generatedAt).toLocaleString()} | Horizon {pack.horizonDays} days
          {pack.ownerLabel ? ` | Owner ${pack.ownerLabel}` : " | All owners"}
        </p>
      </section>

      <ReportPackView pack={pack} />
    </div>
  );
}
