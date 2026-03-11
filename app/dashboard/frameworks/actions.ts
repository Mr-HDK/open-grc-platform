"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  frameworkRequirementAssessmentSchema,
  normalizeAssessmentJustification,
} from "@/lib/validators/framework-assessment";
import {
  frameworkControlIdSchema,
  frameworkRequirementIdsSchema,
} from "@/lib/validators/framework-mapping";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

type IdRow = {
  id: string;
};

type RequirementRow = {
  id: string;
  framework_id: string;
};

type AssessmentRow = {
  id: string;
};

function buildFrameworkQuery(input: {
  controlId?: string | null;
  frameworkId?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.controlId) {
    params.set("controlId", input.controlId);
  }

  if (input.frameworkId) {
    params.set("frameworkId", input.frameworkId);
  }

  return params.toString();
}

function redirectToFrameworks(input: {
  controlId?: string | null;
  frameworkId?: string | null;
  error?: string;
  success?: string;
}): never {
  const query = new URLSearchParams(buildFrameworkQuery(input));

  if (input.error) {
    query.set("error", encodeMessage(input.error));
  }

  if (input.success) {
    query.set("success", input.success);
  }

  const suffix = query.toString();
  redirect(`/dashboard/frameworks${suffix ? `?${suffix}` : ""}`);
}

export async function saveFrameworkMappingsAction(formData: FormData) {
  await requireSessionProfile("admin");

  const controlIdResult = frameworkControlIdSchema.safeParse(formData.get("controlId"));
  const context = {
    controlId: controlIdResult.success ? controlIdResult.data : null,
    frameworkId: typeof formData.get("frameworkId") === "string" ? String(formData.get("frameworkId")) : null,
  };

  if (!controlIdResult.success) {
    redirectToFrameworks({ frameworkId: context.frameworkId, error: "Invalid control identifier." });
  }

  const requirementIdsResult = frameworkRequirementIdsSchema.safeParse(
    formData.getAll("requirementIds").map((value) => String(value)),
  );

  if (!requirementIdsResult.success) {
    redirectToFrameworks({
      controlId: controlIdResult.data,
      frameworkId: context.frameworkId,
      error: requirementIdsResult.error.issues[0]?.message ?? "Invalid requirement identifiers.",
    });
  }

  const supabase = await createSupabaseServerClient();

  const { data: control } = await supabase
    .from("controls")
    .select("id")
    .eq("id", controlIdResult.data)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  if (!control) {
    redirectToFrameworks({
      frameworkId: context.frameworkId,
      error: "Selected control does not exist or is archived.",
    });
  }

  if (requirementIdsResult.data.length > 0) {
    const { data: requirements } = await supabase
      .from("framework_requirements")
      .select("id")
      .in("id", requirementIdsResult.data)
      .returns<IdRow[]>();

    if ((requirements ?? []).length !== requirementIdsResult.data.length) {
      redirectToFrameworks({
        controlId: controlIdResult.data,
        frameworkId: context.frameworkId,
        error: "One or more framework requirements are invalid.",
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("control_framework_mappings")
    .delete()
    .eq("control_id", controlIdResult.data);

  if (deleteError) {
    redirectToFrameworks({
      controlId: controlIdResult.data,
      frameworkId: context.frameworkId,
      error: deleteError.message,
    });
  }

  if (requirementIdsResult.data.length > 0) {
    const { error: insertError } = await supabase.from("control_framework_mappings").insert(
      requirementIdsResult.data.map((requirementId) => ({
        control_id: controlIdResult.data,
        framework_requirement_id: requirementId,
      })),
    );

    if (insertError) {
      redirectToFrameworks({
        controlId: controlIdResult.data,
        frameworkId: context.frameworkId,
        error: insertError.message,
      });
    }
  }

  redirectToFrameworks({
    controlId: controlIdResult.data,
    frameworkId: context.frameworkId,
    success: "mappings_updated",
  });
}

export async function saveRequirementAssessmentAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");

  const rawControlId = typeof formData.get("controlId") === "string" ? String(formData.get("controlId")) : null;
  const rawFrameworkId = typeof formData.get("frameworkId") === "string" ? String(formData.get("frameworkId")) : null;
  const context = {
    controlId: rawControlId,
    frameworkId: rawFrameworkId,
  };

  const parsed = frameworkRequirementAssessmentSchema.safeParse({
    requirementId: formData.get("requirementId"),
    status: formData.get("status"),
    justification: formData.get("justification"),
    evidenceIds: Array.from(new Set(formData.getAll("evidenceIds").map((value) => String(value)))),
    controlId: rawControlId,
    frameworkId: rawFrameworkId,
  });

  if (!parsed.success) {
    redirectToFrameworks({
      ...context,
      error:
        parsed.error.issues[0]?.message ??
        "Submitted compliance assessment fields are invalid.",
    });
  }

  const supabase = await createSupabaseServerClient();

  const { data: requirement } = await supabase
    .from("framework_requirements")
    .select("id, framework_id")
    .eq("id", parsed.data.requirementId)
    .maybeSingle<RequirementRow>();

  if (!requirement) {
    redirectToFrameworks({
      ...context,
      error: "Selected framework requirement does not exist.",
    });
  }

  if (parsed.data.frameworkId && requirement.framework_id !== parsed.data.frameworkId) {
    redirectToFrameworks({
      ...context,
      error: "Requirement does not match the selected framework.",
    });
  }

  if (parsed.data.evidenceIds.length > 0) {
    const { data: evidence } = await supabase
      .from("evidence")
      .select("id")
      .in("id", parsed.data.evidenceIds)
      .eq("organization_id", profile.organizationId)
      .is("archived_at", null)
      .returns<IdRow[]>();

    if ((evidence ?? []).length !== parsed.data.evidenceIds.length) {
      redirectToFrameworks({
        ...context,
        error: "One or more evidence records are invalid or archived.",
      });
    }
  }

  const nowIso = new Date().toISOString();
  const justification = normalizeAssessmentJustification(parsed.data.status, parsed.data.justification);

  const { data: existingAssessment } = await supabase
    .from("framework_requirement_assessments")
    .select("id")
    .eq("organization_id", profile.organizationId)
    .eq("framework_requirement_id", parsed.data.requirementId)
    .maybeSingle<AssessmentRow>();

  let assessmentId = existingAssessment?.id ?? null;
  let auditAction: "create" | "update" = "update";

  if (assessmentId) {
    const { error: updateError } = await supabase
      .from("framework_requirement_assessments")
      .update({
        status: parsed.data.status,
        justification,
        assessed_at: nowIso,
        assessed_by_profile_id: profile.id,
        updated_by: profile.id,
      })
      .eq("id", assessmentId)
      .eq("organization_id", profile.organizationId);

    if (updateError) {
      redirectToFrameworks({
        ...context,
        error: updateError.message,
      });
    }
  } else {
    auditAction = "create";

    const { data: createdAssessment, error: insertError } = await supabase
      .from("framework_requirement_assessments")
      .insert({
        organization_id: profile.organizationId,
        framework_requirement_id: parsed.data.requirementId,
        status: parsed.data.status,
        justification,
        assessed_at: nowIso,
        assessed_by_profile_id: profile.id,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single<AssessmentRow>();

    if (insertError || !createdAssessment) {
      redirectToFrameworks({
        ...context,
        error: insertError?.message ?? "Could not save compliance assessment.",
      });
    }

    assessmentId = createdAssessment.id;
  }

  const { error: deleteEvidenceError } = await supabase
    .from("framework_requirement_assessment_evidence")
    .delete()
    .eq("assessment_id", assessmentId);

  if (deleteEvidenceError) {
    redirectToFrameworks({
      ...context,
      error: deleteEvidenceError.message,
    });
  }

  if (parsed.data.evidenceIds.length > 0) {
    const { error: insertEvidenceError } = await supabase
      .from("framework_requirement_assessment_evidence")
      .insert(
        parsed.data.evidenceIds.map((evidenceId) => ({
          assessment_id: assessmentId,
          evidence_id: evidenceId,
        })),
      );

    if (insertEvidenceError) {
      redirectToFrameworks({
        ...context,
        error: insertEvidenceError.message,
      });
    }
  }

  await recordAuditEvent({
    entityType: "framework_requirement_assessment",
    entityId: assessmentId,
    action: auditAction,
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      framework_requirement_id: parsed.data.requirementId,
      status: parsed.data.status,
      evidence_count: parsed.data.evidenceIds.length,
    },
  }).catch(() => undefined);

  redirectToFrameworks({
    ...context,
    success: "assessment_saved",
  });
}
