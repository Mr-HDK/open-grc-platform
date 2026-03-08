import { saveFrameworkMappingsAction } from "@/app/dashboard/frameworks/actions";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ControlOption = {
  id: string;
  code: string;
  title: string;
};

type FrameworkRow = {
  id: string;
  code: string;
  name: string;
  version: string;
};

type RequirementRow = {
  id: string;
  framework_id: string;
  reference_code: string;
  title: string;
  domain: string | null;
};

type MappingRow = {
  framework_requirement_id: string;
};

export default async function FrameworksPage({
  searchParams,
}: {
  searchParams: Promise<{ controlId?: string; error?: string; success?: string }>;
}) {
  await requireSessionProfile("admin");
  const params = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [{ data: controls }, { data: frameworks }, { data: requirements }] = await Promise.all([
    supabase
      .from("controls")
      .select("id, code, title")
      .is("deleted_at", null)
      .order("code")
      .returns<ControlOption[]>(),
    supabase
      .from("frameworks")
      .select("id, code, name, version")
      .order("code")
      .returns<FrameworkRow[]>(),
    supabase
      .from("framework_requirements")
      .select("id, framework_id, reference_code, title, domain")
      .order("reference_code")
      .returns<RequirementRow[]>(),
  ]);

  const controlOptions = controls ?? [];
  const selectedControlId =
    params.controlId && controlOptions.some((control) => control.id === params.controlId)
      ? params.controlId
      : controlOptions[0]?.id;

  let selectedRequirementIds = new Set<string>();

  if (selectedControlId) {
    const { data: mappings } = await supabase
      .from("control_framework_mappings")
      .select("framework_requirement_id")
      .eq("control_id", selectedControlId)
      .returns<MappingRow[]>();

    selectedRequirementIds = new Set((mappings ?? []).map((row) => row.framework_requirement_id));
  }

  const frameworkById = new Map((frameworks ?? []).map((framework) => [framework.id, framework]));

  const groupedRequirements = new Map<string, RequirementRow[]>();

  for (const requirement of requirements ?? []) {
    const framework = frameworkById.get(requirement.framework_id);
    const key = framework ? framework.code : "Other";

    if (!groupedRequirements.has(key)) {
      groupedRequirements.set(key, []);
    }

    groupedRequirements.get(key)?.push(requirement);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Framework mappings</h1>
        <p className="text-sm text-muted-foreground">
          Map controls to COBIT, ISO 27001, NIST CSF, and NIS2 requirements.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      {params.success === "mappings_updated" ? (
        <FeedbackAlert variant="success" title="Mappings updated." message="Framework mappings were saved successfully." />
      ) : null}

      <form className="rounded-lg border bg-card p-4">
        <label htmlFor="controlId" className="text-sm font-medium">
          Control
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <select
            id="controlId"
            name="controlId"
            defaultValue={selectedControlId}
            className="h-10 min-w-[320px] rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {controlOptions.map((control) => (
              <option key={control.id} value={control.id}>
                {control.code} - {control.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm"
          >
            Load control
          </button>
        </div>
      </form>

      {selectedControlId ? (
        <form action={saveFrameworkMappingsAction} className="space-y-4 rounded-xl border bg-card p-6">
          <input type="hidden" name="controlId" value={selectedControlId} />

          {[...groupedRequirements.entries()].map(([frameworkCode, frameworkRequirements]) => {
            const framework = frameworks?.find((item) => item.code === frameworkCode);

            return (
              <section key={frameworkCode} className="space-y-3 rounded-lg border p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {frameworkCode}
                  {framework ? ` (${framework.version})` : ""}
                </h2>

                <div className="space-y-2">
                  {frameworkRequirements.map((requirement) => (
                    <label
                      key={requirement.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="requirementIds"
                        value={requirement.id}
                        defaultChecked={selectedRequirementIds.has(requirement.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">
                          {requirement.reference_code} - {requirement.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {requirement.domain ?? "General"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}

          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
          >
            Save mappings
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Create at least one control to configure mappings.</p>
      )}
    </div>
  );
}
