import Link from "next/link";

import { importControlsAction, importRisksAction } from "@/app/dashboard/reporting/actions";
import { ReportPackView } from "@/components/reporting/report-pack-view";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import {
  getReportingPack,
  reportPresetOptions,
  reportingHorizonOptions,
} from "@/lib/reporting/packs";
import { cn } from "@/lib/utils/cn";

const riskHeaderSample = "title,description,category,impact,likelihood,status,due_date,owner_email";
const controlHeaderSample =
  "code,title,description,control_type,review_frequency,effectiveness_status,next_review_date,owner_email";

const datasetExports = [
  {
    id: "risks",
    title: "Risks",
    description: "Full risk register export for audit and management review.",
  },
  {
    id: "controls",
    title: "Controls",
    description: "Control catalog export including review cadence and effectiveness.",
  },
  {
    id: "actions",
    title: "Action plans",
    description: "Remediation backlog export for overdue and ownership analysis.",
  },
  {
    id: "findings",
    title: "Findings",
    description: "Open and historical findings export for assurance reporting.",
  },
] as const;

function buildPackQuery(input: { preset: string; ownerId: string; horizonDays: number }) {
  const query = new URLSearchParams({
    preset: input.preset,
    horizon: String(input.horizonDays),
  });

  if (input.ownerId) {
    query.set("owner", input.ownerId);
  }

  return query.toString();
}

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string;
    owner?: string;
    horizon?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const profile = await requireSessionProfile("manager");
  const params = await searchParams;
  const { filters, ownerOptions, pack } = await getReportingPack(profile, params);
  const packQuery = buildPackQuery(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="text-sm text-muted-foreground">
          Preset report packs for management, audit, and compliance reviews, plus supporting
          dataset exports and bulk imports.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}
      {params.success ? (
        <FeedbackAlert variant="success" message={decodeURIComponent(params.success)} />
      ) : null}

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report packs</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch between board-ready presets without rebuilding the underlying model.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {reportPresetOptions.map((option) => {
            const optionQuery = buildPackQuery({
              preset: option.id,
              ownerId: filters.ownerId,
              horizonDays: filters.horizonDays,
            });
            const active = option.id === filters.preset;

            return (
              <article
                key={option.id}
                className={`rounded-lg border p-4 ${active ? "border-slate-900 bg-slate-50" : "bg-white"}`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-2 text-xs text-muted-foreground">{option.description}</p>
                <Link
                  href={`/dashboard/reporting?${optionQuery}`}
                  className={cn(buttonVariants({ variant: active ? "default" : "outline" }), "mt-4 text-xs")}
                >
                  {active ? "Current pack" : "View pack"}
                </Link>
              </article>
            );
          })}
        </div>

        <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
          <select
            name="preset"
            aria-label="Filter by report preset"
            defaultValue={filters.preset}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {reportPresetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name="owner"
            aria-label="Filter by owner"
            defaultValue={filters.ownerId}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>

          <select
            name="horizon"
            aria-label="Filter by horizon"
            defaultValue={String(filters.horizonDays)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {reportingHorizonOptions.map((days) => (
              <option key={days} value={days}>
                Next {days} days
              </option>
            ))}
          </select>

          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Apply filters
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{pack.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Generated from live data. Horizon: {pack.horizonDays} days
              {pack.ownerLabel ? ` | Owner: ${pack.ownerLabel}` : " | All owners"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/reporting/print?${packQuery}`}
              className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
            >
              Printable pack
            </Link>
            <Link
              href={`/dashboard/reporting/export?type=report_pack&format=json&${packQuery}`}
              className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
            >
              Export pack JSON
            </Link>
          </div>
        </div>

        <ReportPackView pack={pack} />
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dataset exports
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {datasetExports.map((item) => (
            <div key={item.id} className="rounded-lg border bg-white p-4">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/reporting/export?type=${item.id}&format=csv`}
                  className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
                >
                  Export CSV
                </Link>
                <Link
                  href={`/dashboard/reporting/export?type=${item.id}&format=json`}
                  className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
                >
                  Export JSON
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Imports</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold">Import risks</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV or JSON array. CSV must use simple commas (no quoted commas). Limit 200 rows.
            </p>
            <code className="mt-3 block rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              {riskHeaderSample}
            </code>
            <form action={importRisksAction} className="mt-4 space-y-3">
              <input
                type="file"
                name="file"
                accept=".csv,application/json,text/csv"
                required
                className="w-full text-xs"
              />
              <select
                name="format"
                defaultValue="auto"
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              >
                <option value="auto">Auto-detect format</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "outline" }), "w-full text-xs")}
              >
                Import risks
              </button>
            </form>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold">Import controls</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV or JSON array. CSV must use simple commas (no quoted commas). Limit 200 rows.
            </p>
            <code className="mt-3 block rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              {controlHeaderSample}
            </code>
            <form action={importControlsAction} className="mt-4 space-y-3">
              <input
                type="file"
                name="file"
                accept=".csv,application/json,text/csv"
                required
                className="w-full text-xs"
              />
              <select
                name="format"
                defaultValue="auto"
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              >
                <option value="auto">Auto-detect format</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "outline" }), "w-full text-xs")}
              >
                Import controls
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
