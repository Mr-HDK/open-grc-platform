import Link from "next/link";

import { importControlsAction, importRisksAction } from "@/app/dashboard/reporting/actions";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { cn } from "@/lib/utils/cn";

const riskHeaderSample = "title,description,category,impact,likelihood,status,due_date,owner_email";
const controlHeaderSample =
  "code,title,description,control_type,review_frequency,effectiveness_status,next_review_date,owner_email";

export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireSessionProfile("manager");
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="text-sm text-muted-foreground">
          Export data for management reporting and import bulk CSV/JSON updates.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}
      {params.success ? (
        <FeedbackAlert variant="success" message={decodeURIComponent(params.success)} />
      ) : null}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Exports</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold">Risks</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Export the full risk register for audit or management review.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/dashboard/reporting/export?type=risks&format=csv"
                className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
              >
                Export CSV
              </Link>
              <Link
                href="/dashboard/reporting/export?type=risks&format=json"
                className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
              >
                Export JSON
              </Link>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold">Controls</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Export the control catalog for audit packs or external review.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/dashboard/reporting/export?type=controls&format=csv"
                className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
              >
                Export CSV
              </Link>
              <Link
                href="/dashboard/reporting/export?type=controls&format=json"
                className={cn(buttonVariants({ variant: "outline" }), "text-xs")}
              >
                Export JSON
              </Link>
            </div>
          </div>
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
