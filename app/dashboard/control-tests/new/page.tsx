import { ControlTestForm } from "@/components/control-tests/control-test-form";

import { createControlTestAction } from "@/app/dashboard/control-tests/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OptionRow = {
  id: string;
  code?: string;
  title?: string;
  email?: string;
  full_name?: string | null;
};

type FindingPrefillRow = {
  id: string;
  control_id: string;
  owner_profile_id: string | null;
};

export default async function NewControlTestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; controlId?: string; findingId?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const requestedFindingId = params.findingId?.trim() || "";
  const { data: retestFinding } = requestedFindingId
    ? await supabase
        .from("findings")
        .select("id, control_id, owner_profile_id")
        .eq("id", requestedFindingId)
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .maybeSingle<FindingPrefillRow>()
    : { data: null as FindingPrefillRow | null };

  const defaultControlId = retestFinding?.control_id ?? params.controlId?.trim() ?? "";
  const defaultTesterProfileId = retestFinding?.owner_profile_id ?? profile.id;

  const [{ data: controls }, { data: testers }] = await Promise.all([
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

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New control test</h1>
        <p className="text-sm text-muted-foreground">
          Capture a control test campaign result for a specific review period.
        </p>
      </div>

      <ControlTestForm
        mode="create"
        action={createControlTestAction}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        testerOptions={(testers ?? []).map((tester) => ({
          id: tester.id,
          label: tester.full_name ? `${tester.full_name} (${tester.email})` : (tester.email ?? tester.id),
        }))}
        defaults={{
          controlId: defaultControlId,
          testerProfileId: defaultTesterProfileId,
          testPeriodStart: today,
          testPeriodEnd: today,
          findingId: retestFinding?.id ?? null,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
        cancelHref={retestFinding ? `/dashboard/findings/${retestFinding.id}` : "/dashboard/control-tests"}
      />
    </div>
  );
}
