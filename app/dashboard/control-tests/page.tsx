import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  controlTestResultOptions,
  type ControlTestResult,
} from "@/lib/validators/control-test";
import { cn } from "@/lib/utils/cn";

type ControlTestRow = {
  id: string;
  control_id: string;
  tester_profile_id: string;
  result: ControlTestResult;
  test_period_start: string;
  test_period_end: string;
  updated_at: string;
};

type ControlRow = { id: string; code: string; title: string };
type TesterRow = { id: string; email: string; full_name: string | null };

type FindingRow = {
  id: string;
  source_control_test_id: string | null;
};

function isControlTestResult(value: string | null | undefined): value is ControlTestResult {
  return Boolean(value && controlTestResultOptions.includes(value as ControlTestResult));
}

export default async function ControlTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; controlId?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const result = isControlTestResult(params.result) ? params.result : "";
  const controlId = params.controlId?.trim() ?? "";

  let query = supabase
    .from("control_tests")
    .select("id, control_id, tester_profile_id, result, test_period_start, test_period_end, updated_at")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (result) {
    query = query.eq("result", result);
  }

  if (controlId) {
    query = query.eq("control_id", controlId);
  }

  const [{ data: tests, error }, { data: controls }, { data: testers }] = await Promise.all([
    query.returns<ControlTestRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .returns<TesterRow[]>(),
  ]);
  const controlById = new Map((controls ?? []).map((control) => [control.id, `${control.code} - ${control.title}`]));
  const testerById = new Map(
    (testers ?? []).map((tester) => [
      tester.id,
      tester.full_name ? `${tester.full_name} (${tester.email})` : tester.email,
    ]),
  );

  const controlTestIds = (tests ?? []).map((test) => test.id);
  const { data: findings } = controlTestIds.length
    ? await supabase
        .from("findings")
        .select("id, source_control_test_id")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .in("source_control_test_id", controlTestIds)
        .returns<FindingRow[]>()
    : { data: [] as FindingRow[] };
  const findingByControlTestId = new Map(
    (findings ?? [])
      .filter((finding) => finding.source_control_test_id)
      .map((finding) => [finding.source_control_test_id as string, finding.id]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control tests</h1>
          <p className="text-sm text-muted-foreground">
            Track periodic control testing campaigns and outcomes.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/control-tests/new" className={buttonVariants()}>
            New control test
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <select
          name="result"
          aria-label="Filter by result"
          defaultValue={result}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All results</option>
          {controlTestResultOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="controlId"
          aria-label="Filter by control"
          defaultValue={controlId}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All controls</option>
          {(controls ?? []).map((control) => (
            <option key={control.id} value={control.id}>
              {control.code} - {control.title}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Control tests results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Control
              </th>
              <th scope="col" className="px-4 py-3">
                Result
              </th>
              <th scope="col" className="px-4 py-3">
                Period
              </th>
              <th scope="col" className="px-4 py-3">
                Tester
              </th>
              <th scope="col" className="px-4 py-3">
                Finding
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(tests ?? []).map((test) => (
              <tr key={test.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/control-tests/${test.id}`}
                    className="font-medium hover:underline"
                  >
                    {controlById.get(test.control_id) ?? "Unknown control"}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{test.result}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {test.test_period_start} to {test.test_period_end}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {testerById.get(test.tester_profile_id) ?? "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {findingByControlTestId.get(test.id) ? (
                    <Link
                      href={`/dashboard/findings/${findingByControlTestId.get(test.id)}`}
                      className="hover:underline"
                    >
                      Linked finding
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(test.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (tests?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No control tests found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
