import {
  saveFrameworkMappingsAction,
  saveRequirementAssessmentAction,
} from "@/app/dashboard/frameworks/actions";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  frameworkAssessmentStatusOptions,
  type FrameworkAssessmentStatus,
} from "@/lib/validators/framework-assessment";

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

type AssessmentRow = {
  id: string;
  framework_requirement_id: string;
  status: FrameworkAssessmentStatus;
  justification: string | null;
  assessed_at: string;
  assessed_by_profile_id: string | null;
};

type AssessmentEvidenceRow = {
  assessment_id: string;
  evidence_id: string;
};

type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

function statusBadgeClass(status: FrameworkAssessmentStatus | null) {
  switch (status) {
    case "compliant":
      return "bg-emerald-100 text-emerald-800";
    case "partial":
      return "bg-amber-100 text-amber-800";
    case "gap":
      return "bg-rose-100 text-rose-800";
    case "not_applicable":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatStatus(status: FrameworkAssessmentStatus | null) {
  if (!status) {
    return "not_assessed";
  }

  return status;
}

export default async function FrameworksPage({
  searchParams,
}: {
  searchParams: Promise<{
    controlId?: string;
    frameworkId?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const params = await searchParams;
  const canEditAssessments = hasRole("contributor", profile.role);
  const isAdmin = profile.role === "admin";

  const supabase = await createSupabaseServerClient();

  const [
    frameworksResult,
    requirementsResult,
    assessmentsResult,
    controlsResult,
    evidenceResult,
  ] = await Promise.all([
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
    supabase
      .from("framework_requirement_assessments")
      .select("id, framework_requirement_id, status, justification, assessed_at, assessed_by_profile_id")
      .eq("organization_id", profile.organizationId)
      .returns<AssessmentRow[]>(),
    isAdmin
      ? supabase
          .from("controls")
          .select("id, code, title")
          .eq("organization_id", profile.organizationId)
          .is("deleted_at", null)
          .order("code")
          .returns<ControlOption[]>()
      : Promise.resolve({ data: [] as ControlOption[] }),
    supabase
      .from("evidence")
      .select("id, title, file_name, created_at")
      .eq("organization_id", profile.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<EvidenceRow[]>(),
  ]);

  const frameworks = frameworksResult.data ?? [];
  const requirements = requirementsResult.data ?? [];
  const assessments = assessmentsResult.data ?? [];
  const controls = controlsResult.data ?? [];
  const evidence = evidenceResult.data ?? [];

  const selectedFrameworkId =
    params.frameworkId && frameworks.some((framework) => framework.id === params.frameworkId)
      ? params.frameworkId
      : frameworks[0]?.id;

  const selectedControlId =
    isAdmin && params.controlId && controls.some((control) => control.id === params.controlId)
      ? params.controlId
      : controls[0]?.id;

  const selectedRequirements = selectedFrameworkId
    ? requirements.filter((requirement) => requirement.framework_id === selectedFrameworkId)
    : [];

  const selectedRequirementIds = new Set(selectedRequirements.map((requirement) => requirement.id));
  const selectedAssessments = assessments.filter((assessment) =>
    selectedRequirementIds.has(assessment.framework_requirement_id),
  );

  const assessorIds = Array.from(
    new Set(
      selectedAssessments
        .map((assessment) => assessment.assessed_by_profile_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const selectedAssessmentIds = selectedAssessments.map((assessment) => assessment.id);

  const [mappingResult, evidenceLinkResult, assessorsResult] = await Promise.all([
    isAdmin && selectedControlId && selectedRequirements.length > 0
      ? supabase
          .from("control_framework_mappings")
          .select("framework_requirement_id")
          .eq("control_id", selectedControlId)
          .in("framework_requirement_id", selectedRequirements.map((requirement) => requirement.id))
          .returns<MappingRow[]>()
      : Promise.resolve({ data: [] as MappingRow[] }),
    selectedAssessmentIds.length > 0
      ? supabase
          .from("framework_requirement_assessment_evidence")
          .select("assessment_id, evidence_id")
          .in("assessment_id", selectedAssessmentIds)
          .returns<AssessmentEvidenceRow[]>()
      : Promise.resolve({ data: [] as AssessmentEvidenceRow[] }),
    assessorIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("organization_id", profile.organizationId)
          .in("id", assessorIds)
          .returns<ProfileRow[]>()
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  const selectedRequirementMappings = new Set(
    (mappingResult.data ?? []).map((mapping) => mapping.framework_requirement_id),
  );

  const assessmentByRequirementId = new Map(
    selectedAssessments.map((assessment) => [assessment.framework_requirement_id, assessment]),
  );

  const evidenceByAssessmentId = new Map<string, Set<string>>();

  for (const link of evidenceLinkResult.data ?? []) {
    if (!evidenceByAssessmentId.has(link.assessment_id)) {
      evidenceByAssessmentId.set(link.assessment_id, new Set<string>());
    }

    evidenceByAssessmentId.get(link.assessment_id)?.add(link.evidence_id);
  }

  const assessorById = new Map(
    (assessorsResult.data ?? []).map((assessor) => [
      assessor.id,
      assessor.full_name ? `${assessor.full_name} (${assessor.email})` : assessor.email,
    ]),
  );

  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const totalByFramework = new Map<string, number>();
  const assessedByFramework = new Map<string, number>();
  const gapByFramework = new Map<string, number>();

  for (const requirement of requirements) {
    totalByFramework.set(
      requirement.framework_id,
      (totalByFramework.get(requirement.framework_id) ?? 0) + 1,
    );
  }

  for (const assessment of assessments) {
    const requirement = requirementById.get(assessment.framework_requirement_id);

    if (!requirement) {
      continue;
    }

    assessedByFramework.set(
      requirement.framework_id,
      (assessedByFramework.get(requirement.framework_id) ?? 0) + 1,
    );

    if (assessment.status === "gap") {
      gapByFramework.set(
        requirement.framework_id,
        (gapByFramework.get(requirement.framework_id) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Framework compliance</h1>
        <p className="text-sm text-muted-foreground">
          Assess requirement-level compliance, justify gaps, and link evidence records.
        </p>
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      {params.success === "assessment_saved" ? (
        <FeedbackAlert
          variant="success"
          title="Assessment updated."
          message="Requirement-level compliance assessment was saved successfully."
        />
      ) : null}

      {params.success === "mappings_updated" ? (
        <FeedbackAlert
          variant="success"
          title="Mappings updated."
          message="Framework mappings were saved successfully."
        />
      ) : null}

      {!canEditAssessments ? (
        <FeedbackAlert
          title="Read-only mode"
          message="Your role can review framework coverage but cannot edit assessments."
        />
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Consolidated framework coverage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Gap rate is calculated against total framework requirements.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {frameworks.map((framework) => {
            const total = totalByFramework.get(framework.id) ?? 0;
            const assessed = assessedByFramework.get(framework.id) ?? 0;
            const gap = gapByFramework.get(framework.id) ?? 0;

            return (
              <article key={framework.id} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">{framework.code}</p>
                <p className="text-xs text-muted-foreground">{framework.version}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Coverage {percentage(assessed, total)}% ({assessed}/{total})
                </p>
                <p className="text-xs text-muted-foreground">
                  Gap rate {percentage(gap, total)}% ({gap}/{total})
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <form className="rounded-lg border bg-card p-4">
        <label htmlFor="frameworkId" className="text-sm font-medium">
          Framework
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <select
            id="frameworkId"
            name="frameworkId"
            defaultValue={selectedFrameworkId}
            className="h-10 min-w-[280px] rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {frameworks.map((framework) => (
              <option key={framework.id} value={framework.id}>
                {framework.code} - {framework.name} ({framework.version})
              </option>
            ))}
          </select>
          {isAdmin ? <input type="hidden" name="controlId" value={selectedControlId} /> : null}
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm"
          >
            Load framework
          </button>
        </div>
      </form>

      {selectedFrameworkId ? (
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Requirement assessments</h2>
            <p className="text-sm text-muted-foreground">
              Statuses: compliant, partial, gap, not applicable. Justification is required for partial, gap, and not applicable.
            </p>
          </div>

          {selectedRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requirements found for this framework.</p>
          ) : (
            <div className="space-y-4">
              {selectedRequirements.map((requirement) => {
                const assessment = assessmentByRequirementId.get(requirement.id) ?? null;
                const linkedEvidenceIds = assessment
                  ? evidenceByAssessmentId.get(assessment.id) ?? new Set<string>()
                  : new Set<string>();
                const assessorLabel = assessment?.assessed_by_profile_id
                  ? (assessorById.get(assessment.assessed_by_profile_id) ?? "Unknown user")
                  : null;

                return (
                  <form
                    key={requirement.id}
                    action={saveRequirementAssessmentAction}
                    data-assessment-form
                    className="space-y-4 rounded-lg border p-4"
                  >
                    <input type="hidden" name="requirementId" value={requirement.id} />
                    <input type="hidden" name="frameworkId" value={selectedFrameworkId} />
                    {isAdmin && selectedControlId ? (
                      <input type="hidden" name="controlId" value={selectedControlId} />
                    ) : null}

                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {requirement.reference_code} - {requirement.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {requirement.domain ?? "General"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(assessment?.status ?? null)}`}
                      >
                        {formatStatus(assessment?.status ?? null)}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor={`status-${requirement.id}`} className="text-sm font-medium">
                          Status
                        </label>
                        <select
                          id={`status-${requirement.id}`}
                          name="status"
                          defaultValue={assessment?.status ?? "compliant"}
                          disabled={!canEditAssessments}
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"
                        >
                          {frameworkAssessmentStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor={`justification-${requirement.id}`} className="text-sm font-medium">
                          Justification
                        </label>
                        <textarea
                          id={`justification-${requirement.id}`}
                          name="justification"
                          defaultValue={assessment?.justification ?? ""}
                          disabled={!canEditAssessments}
                          maxLength={4000}
                          className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Linked evidence</p>
                      {evidence.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No evidence records are available.</p>
                      ) : (
                        <div className="max-h-52 space-y-2 overflow-auto rounded-md border p-3">
                          {evidence.map((evidenceItem) => (
                            <label key={evidenceItem.id} className="flex items-start gap-2 text-xs">
                              <input
                                type="checkbox"
                                name="evidenceIds"
                                value={evidenceItem.id}
                                defaultChecked={linkedEvidenceIds.has(evidenceItem.id)}
                                disabled={!canEditAssessments}
                                className="mt-0.5"
                              />
                              <span>
                                <span className="font-medium">{evidenceItem.title}</span>
                                <span className="block text-muted-foreground">{evidenceItem.file_name}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {assessment
                          ? `Last assessed ${new Date(assessment.assessed_at).toLocaleDateString()}${assessorLabel ? ` by ${assessorLabel}` : ""}`
                          : "Not assessed yet."}
                      </p>
                      <button
                        type="submit"
                        disabled={!canEditAssessments}
                        className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:bg-slate-400"
                      >
                        Save assessment
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No frameworks found.</p>
      )}

      {isAdmin ? (
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Control mappings</h2>
            <p className="text-sm text-muted-foreground">
              Map controls to framework requirements to align control coverage with compliance evaluations.
            </p>
          </div>

          <form className="rounded-lg border bg-card p-4">
            <input type="hidden" name="frameworkId" value={selectedFrameworkId} />
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
                {controls.map((control) => (
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

          {selectedControlId && selectedRequirements.length > 0 ? (
            <form action={saveFrameworkMappingsAction} className="space-y-4 rounded-xl border bg-card p-6">
              <input type="hidden" name="controlId" value={selectedControlId} />
              <input type="hidden" name="frameworkId" value={selectedFrameworkId} />

              <section className="space-y-3 rounded-lg border p-4">
                <div className="space-y-2">
                  {selectedRequirements.map((requirement) => (
                    <label
                      key={requirement.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="requirementIds"
                        value={requirement.id}
                        defaultChecked={selectedRequirementMappings.has(requirement.id)}
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

              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
              >
                Save mappings
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create at least one control and one framework requirement to configure mappings.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
