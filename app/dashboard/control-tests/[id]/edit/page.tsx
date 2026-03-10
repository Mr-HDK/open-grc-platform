import { notFound } from "next/navigation";

import { updateControlTestAction } from "@/app/dashboard/control-tests/actions";
import { ControlTestForm } from "@/components/control-tests/control-test-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { controlTestResultOptions, type ControlTestResult } from "@/lib/validators/control-test";

type OptionRow = {
  id: string;
  code?: string;
  title?: string;
  email?: string;
  full_name?: string | null;
};

type ControlTestRow = {
  id: string;
  control_id: string;
  test_period_start: string;
  test_period_end: string;
  tester_profile_id: string;
  result: ControlTestResult;
  notes: string | null;
};

function isControlTestResult(value: string): value is ControlTestResult {
  return controlTestResultOptions.includes(value as ControlTestResult);
}

async function getControlTest(controlTestId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_tests")
    .select("id, control_id, test_period_start, test_period_end, tester_profile_id, result, notes")
    .eq("id", controlTestId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlTestRow>();

  return data;
}

export default async function EditControlTestPage({
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
  const [controlTest, controlsResult, testersResult] = await Promise.all([
    getControlTest(id, profile.organizationId),
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
  const controls = controlsResult.data;
  const testers = testersResult.data;

  if (!controlTest) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit control test</h1>
        <p className="text-sm text-muted-foreground">Update control test campaign metadata.</p>
      </div>

      <ControlTestForm
        mode="edit"
        action={updateControlTestAction}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        testerOptions={(testers ?? []).map((tester) => ({
          id: tester.id,
          label: tester.full_name ? `${tester.full_name} (${tester.email})` : (tester.email ?? tester.id),
        }))}
        defaults={{
          controlTestId: controlTest.id,
          controlId: controlTest.control_id,
          testPeriodStart: controlTest.test_period_start,
          testPeriodEnd: controlTest.test_period_end,
          testerProfileId: controlTest.tester_profile_id,
          result: isControlTestResult(controlTest.result) ? controlTest.result : "passed",
          notes: controlTest.notes,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
