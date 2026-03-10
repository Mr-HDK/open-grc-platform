import { notFound } from "next/navigation";

import { updateFindingAction } from "@/app/dashboard/findings/actions";
import { FindingForm } from "@/components/findings/finding-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findingSeverityOptions,
  findingStatusOptions,
  type FindingSeverity,
  type FindingStatus,
} from "@/lib/validators/finding";

type OptionRow = {
  id: string;
  code?: string;
  title?: string;
  email?: string;
  full_name?: string | null;
  control_id?: string;
};

type FindingRow = {
  id: string;
  control_id: string;
  source_control_test_id: string | null;
  title: string;
  description: string;
  status: FindingStatus;
  severity: FindingSeverity;
  root_cause: string | null;
  remediation_plan: string | null;
  due_date: string | null;
  owner_profile_id: string | null;
};

function isFindingStatus(value: string): value is FindingStatus {
  return findingStatusOptions.includes(value as FindingStatus);
}

function isFindingSeverity(value: string): value is FindingSeverity {
  return findingSeverityOptions.includes(value as FindingSeverity);
}

async function getFinding(findingId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("findings")
    .select(
      "id, control_id, source_control_test_id, title, description, status, severity, root_cause, remediation_plan, due_date, owner_profile_id",
    )
    .eq("id", findingId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<FindingRow>();

  return data;
}

export default async function EditFindingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [finding, controlsResult, sourceTestsResult, ownersResult] = await Promise.all([
    getFinding(id, profile.organizationId),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("control_tests")
      .select("id, control_id, controls(code, title)")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<
        {
          id: string;
          control_id: string;
          controls: { code: string; title: string } | null;
        }[]
      >(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OptionRow[]>(),
  ]);

  if (!finding) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit finding</h1>
        <p className="text-sm text-muted-foreground">Update remediation ownership and status.</p>
      </div>

      <FindingForm
        mode="edit"
        action={updateFindingAction}
        controlOptions={(controlsResult.data ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        sourceControlTestOptions={(sourceTestsResult.data ?? []).map((test) => ({
          id: test.id,
          label: test.controls
            ? `${test.controls.code} - ${test.controls.title} (${test.id.slice(0, 8)})`
            : test.id,
        }))}
        ownerOptions={(ownersResult.data ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : (owner.email ?? owner.id),
        }))}
        defaults={{
          findingId: finding.id,
          controlId: finding.control_id,
          sourceControlTestId: finding.source_control_test_id,
          title: finding.title,
          description: finding.description,
          status: isFindingStatus(finding.status) ? finding.status : "open",
          severity: isFindingSeverity(finding.severity) ? finding.severity : "medium",
          rootCause: finding.root_cause,
          remediationPlan: finding.remediation_plan,
          dueDate: finding.due_date,
          ownerProfileId: finding.owner_profile_id,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
