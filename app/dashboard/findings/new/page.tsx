import { FindingForm } from "@/components/findings/finding-form";

import { createFindingAction } from "@/app/dashboard/findings/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  code?: string;
  title?: string;
  email?: string;
  full_name?: string | null;
  control_id?: string;
};

type ControlTestPrefillRow = {
  id: string;
  control_id: string;
};

export default async function NewFindingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; controlId?: string; sourceControlTestId?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const sourceControlTestId = params.sourceControlTestId?.trim() ?? "";
  const { data: sourceControlTest } = sourceControlTestId
    ? await supabase
        .from("control_tests")
        .select("id, control_id")
        .eq("id", sourceControlTestId)
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .maybeSingle<ControlTestPrefillRow>()
    : { data: null as ControlTestPrefillRow | null };

  const defaultControlId = sourceControlTest?.control_id ?? params.controlId?.trim() ?? "";
  const controlTestsQuery = supabase
    .from("control_tests")
    .select("id, control_id, controls(code, title)")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const { data: sourceControlTests } = defaultControlId
    ? await controlTestsQuery.eq("control_id", defaultControlId).returns<
        {
          id: string;
          control_id: string;
          controls: { code: string; title: string } | null;
        }[]
      >()
    : await controlTestsQuery.returns<
        {
          id: string;
          control_id: string;
          controls: { code: string; title: string } | null;
        }[]
      >();

  const [{ data: controls }, { data: owners }] = await Promise.all([
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OptionRow[]>(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New finding</h1>
        <p className="text-sm text-muted-foreground">
          Track a control deficiency and assign remediation ownership.
        </p>
      </div>

      <FindingForm
        mode="create"
        action={createFindingAction}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        sourceControlTestOptions={(sourceControlTests ?? []).map((test) => ({
          id: test.id,
          label: test.controls
            ? `${test.controls.code} - ${test.controls.title} (${test.id.slice(0, 8)})`
            : test.id,
        }))}
        ownerOptions={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : (owner.email ?? owner.id),
        }))}
        defaults={{
          controlId: defaultControlId,
          sourceControlTestId: sourceControlTest?.id ?? (sourceControlTestId || null),
          ownerProfileId: profile.id,
          status: "open",
          severity: "medium",
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
