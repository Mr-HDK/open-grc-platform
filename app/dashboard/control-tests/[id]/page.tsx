import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveControlTestAction } from "@/app/dashboard/control-tests/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ControlTestDetail = {
  id: string;
  control_id: string;
  tester_profile_id: string;
  result: string;
  test_period_start: string;
  test_period_end: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ControlRow = { id: string; code: string; title: string };

type TesterRow = { id: string; email: string; full_name: string | null };

type FindingRow = { id: string; status: string };

async function getControlTestById(controlTestId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_tests")
    .select(
      "id, control_id, tester_profile_id, result, test_period_start, test_period_end, notes, created_at, updated_at",
    )
    .eq("id", controlTestId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlTestDetail>();

  return data;
}

async function getControl(controlId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select("id, code, title")
    .eq("id", controlId)
    .eq("organization_id", organizationId)
    .maybeSingle<ControlRow>();

  return data;
}

async function getTester(testerId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", testerId)
    .eq("organization_id", organizationId)
    .maybeSingle<TesterRow>();

  return data;
}

async function getRelatedFindings(controlTestId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: sourced }, { data: resolved }] = await Promise.all([
    supabase
      .from("findings")
      .select("id, status")
      .eq("source_control_test_id", controlTestId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .returns<FindingRow[]>(),
    supabase
      .from("findings")
      .select("id, status")
      .eq("resolved_by_control_test_id", controlTestId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .returns<FindingRow[]>(),
  ]);

  return {
    sourced: sourced ?? [],
    resolved: resolved ?? [],
  };
}

export default async function ControlTestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;
  const controlTest = await getControlTestById(id, profile.organizationId);

  if (!controlTest) {
    notFound();
  }

  const [control, tester, findings, auditEntries] = await Promise.all([
    getControl(controlTest.control_id, profile.organizationId),
    getTester(controlTest.tester_profile_id, profile.organizationId),
    getRelatedFindings(controlTest.id, profile.organizationId),
    getAuditEntries("control_test", controlTest.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control test</h1>
          <p className="mt-2 text-sm text-muted-foreground capitalize">{controlTest.result}</p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/control-tests/${controlTest.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveControlTestAction}>
                <input type="hidden" name="controlTestId" value={controlTest.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Control</p>
          <p className="mt-1 text-sm font-medium">
            {control ? `${control.code} - ${control.title}` : "Unknown control"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tester</p>
          <p className="mt-1 text-sm font-medium">
            {tester
              ? tester.full_name
                ? `${tester.full_name} (${tester.email})`
                : tester.email
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Result</p>
          <p className="mt-1 text-sm font-medium capitalize">{controlTest.result}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Test period start</p>
          <p className="mt-1 text-sm font-medium">{controlTest.test_period_start}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Test period end</p>
          <p className="mt-1 text-sm font-medium">{controlTest.test_period_end}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">
            {new Date(controlTest.updated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {controlTest.notes ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="mt-2 whitespace-pre-line text-sm">{controlTest.notes}</p>
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Related findings</h2>
          {canEdit && controlTest.result === "failed" && findings.sourced.length === 0 ? (
            <Link
              href={`/dashboard/findings/new?controlId=${controlTest.control_id}&sourceControlTestId=${controlTest.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Create finding
            </Link>
          ) : null}
        </div>

        {findings.sourced.length === 0 && findings.resolved.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No findings linked to this control test.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {findings.sourced.map((finding) => (
              <li key={finding.id}>
                <Link href={`/dashboard/findings/${finding.id}`} className="font-medium hover:underline">
                  Source finding
                </Link>{" "}
                <span className="text-muted-foreground">({finding.status})</span>
              </li>
            ))}
            {findings.resolved.map((finding) => (
              <li key={finding.id}>
                <Link href={`/dashboard/findings/${finding.id}`} className="font-medium hover:underline">
                  Resolved finding
                </Link>{" "}
                <span className="text-muted-foreground">({finding.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
