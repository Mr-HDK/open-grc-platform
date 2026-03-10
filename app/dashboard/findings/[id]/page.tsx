import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveFindingAction } from "@/app/dashboard/findings/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type FindingDetail = {
  id: string;
  control_id: string;
  source_control_test_id: string | null;
  resolved_by_control_test_id: string | null;
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  severity: "low" | "medium" | "high" | "critical";
  root_cause: string | null;
  remediation_plan: string | null;
  due_date: string | null;
  owner_profile_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ControlRow = { id: string; code: string; title: string };

type OwnerRow = { id: string; email: string; full_name: string | null };

type ControlTestRow = {
  id: string;
  result: string;
  test_period_start: string;
  test_period_end: string;
};

async function getFindingById(findingId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("findings")
    .select(
      "id, control_id, source_control_test_id, resolved_by_control_test_id, title, description, status, severity, root_cause, remediation_plan, due_date, owner_profile_id, closed_at, created_at, updated_at",
    )
    .eq("id", findingId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<FindingDetail>();

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

async function getOwner(ownerId: string | null, organizationId: string) {
  if (!ownerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ownerId)
    .eq("organization_id", organizationId)
    .maybeSingle<OwnerRow>();

  return data;
}

async function getControlTest(controlTestId: string | null, organizationId: string) {
  if (!controlTestId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_tests")
    .select("id, result, test_period_start, test_period_end")
    .eq("id", controlTestId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlTestRow>();

  return data;
}

export default async function FindingDetailPage({
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
  const finding = await getFindingById(id, profile.organizationId);

  if (!finding) {
    notFound();
  }

  const [control, owner, sourceControlTest, resolvedControlTest, auditEntries] = await Promise.all([
    getControl(finding.control_id, profile.organizationId),
    getOwner(finding.owner_profile_id, profile.organizationId),
    getControlTest(finding.source_control_test_id, profile.organizationId),
    getControlTest(finding.resolved_by_control_test_id, profile.organizationId),
    getAuditEntries("finding", finding.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{finding.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground capitalize">
            {finding.status} - {finding.severity}
          </p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/findings/${finding.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canEdit && finding.status !== "closed" ? (
              <Link
                href={`/dashboard/control-tests/new?controlId=${finding.control_id}&findingId=${finding.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Record retest
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveFindingAction}>
                <input type="hidden" name="findingId" value={finding.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{finding.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Control</p>
          <p className="mt-1 text-sm font-medium">
            {control ? `${control.code} - ${control.title}` : "Unknown control"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium capitalize">{finding.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Severity</p>
          <p className="mt-1 text-sm font-medium capitalize">{finding.severity}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
          <p className="mt-1 text-sm font-medium">{finding.due_date ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Closed at</p>
          <p className="mt-1 text-sm font-medium">
            {finding.closed_at ? new Date(finding.closed_at).toLocaleString() : "-"}
          </p>
        </div>
      </div>

      {finding.root_cause ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Root cause</p>
          <p className="mt-2 whitespace-pre-line text-sm">{finding.root_cause}</p>
        </div>
      ) : null}

      {finding.remediation_plan ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Remediation plan</p>
          <p className="mt-2 whitespace-pre-line text-sm">{finding.remediation_plan}</p>
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Control tests</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {sourceControlTest ? (
            <li>
              <Link
                href={`/dashboard/control-tests/${sourceControlTest.id}`}
                className="font-medium hover:underline"
              >
                Source test
              </Link>{" "}
              <span className="text-muted-foreground">
                ({sourceControlTest.result}, {sourceControlTest.test_period_start} to{" "}
                {sourceControlTest.test_period_end})
              </span>
            </li>
          ) : null}
          {resolvedControlTest ? (
            <li>
              <Link
                href={`/dashboard/control-tests/${resolvedControlTest.id}`}
                className="font-medium hover:underline"
              >
                Resolution retest
              </Link>{" "}
              <span className="text-muted-foreground">
                ({resolvedControlTest.result}, {resolvedControlTest.test_period_start} to{" "}
                {resolvedControlTest.test_period_end})
              </span>
            </li>
          ) : null}
          {!sourceControlTest && !resolvedControlTest ? (
            <li className="text-muted-foreground">No linked tests.</li>
          ) : null}
        </ul>
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
