import { applyLibraryBundleAction } from "@/app/dashboard/libraries/actions";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { listLibraryBundles } from "@/lib/libraries/bundles";

function parseCount(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function LibrariesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    bundle?: string;
    risksInserted?: string;
    risksSkipped?: string;
    controlsInserted?: string;
    controlsSkipped?: string;
    linksInserted?: string;
    linksSkipped?: string;
  }>;
}) {
  await requireSessionProfile("admin");
  const params = await searchParams;
  const bundles = listLibraryBundles();

  const successMessage =
    params.success === "bundle_applied"
      ? `${decodeURIComponent(params.bundle ?? "Bundle")} applied. Risks inserted: ${parseCount(params.risksInserted)}, skipped: ${parseCount(params.risksSkipped)}. Controls inserted: ${parseCount(params.controlsInserted)}, skipped: ${parseCount(params.controlsSkipped)}. Links inserted: ${parseCount(params.linksInserted)}, skipped: ${parseCount(params.linksSkipped)}.`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Libraries</h1>
        <p className="text-sm text-muted-foreground">
          Apply reusable risk and control bundles to bootstrap your organization workspace.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}
      {successMessage ? (
        <FeedbackAlert variant="success" title="Bundle applied." message={successMessage} />
      ) : null}

      <div className="space-y-4">
        {bundles.map((bundle) => (
          <section key={bundle.id} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{bundle.name}</h2>
                <p className="max-w-3xl text-sm text-muted-foreground">{bundle.description}</p>
                <p className="text-xs text-muted-foreground">
                  Tags: {bundle.tags.join(", ")} | Risks: {bundle.risks.length} | Controls:{" "}
                  {bundle.controls.length}
                </p>
              </div>

              <form action={applyLibraryBundleAction}>
                <input type="hidden" name="bundleId" value={bundle.id} />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
                >
                  Apply bundle
                </button>
              </form>
            </div>

            {(bundle.risks.length > 0 || bundle.controls.length > 0) && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Risk templates
                  </p>
                  {bundle.risks.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No risk templates in this bundle.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {bundle.risks.slice(0, 4).map((risk) => (
                        <li key={risk.title}>{risk.title}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Control templates
                  </p>
                  {bundle.controls.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No control templates in this bundle.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {bundle.controls.slice(0, 4).map((control) => (
                        <li key={control.code}>
                          {control.code} - {control.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
