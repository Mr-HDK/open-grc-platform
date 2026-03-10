"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildControlTestMutation,
  controlTestFormSchema,
  controlTestIdSchema,
} from "@/lib/validators/control-test";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseControlTestPayload(formData: FormData) {
  return controlTestFormSchema.safeParse({
    controlId: formData.get("controlId"),
    testPeriodStart: formData.get("testPeriodStart"),
    testPeriodEnd: formData.get("testPeriodEnd"),
    testerProfileId: formData.get("testerProfileId"),
    result: formData.get("result"),
    notes: formData.get("notes"),
    findingId: formData.get("findingId"),
  });
}

type IdRow = { id: string };

type ControlRow = { id: string; code: string; title: string };

type FindingRefRow = {
  id: string;
  control_id: string;
  status: "open" | "in_progress" | "closed";
};

type ControlTestRow = {
  id: string;
};

async function validateControlTestReferences(
  input: {
    controlId: string;
    testerProfileId: string;
    findingId: string | null;
  },
  organizationId: string,
) {
  const supabase = await createSupabaseServerClient();

  const { data: control } = await supabase
    .from("controls")
    .select("id, code, title")
    .eq("id", input.controlId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlRow>();

  if (!control) {
    return { error: "Selected control does not exist or is archived.", control: null };
  }

  const { data: tester } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", input.testerProfileId)
    .eq("organization_id", organizationId)
    .maybeSingle<IdRow>();

  if (!tester) {
    return { error: "Selected tester does not exist.", control: null };
  }

  if (!input.findingId) {
    return { error: null, control };
  }

  const { data: finding } = await supabase
    .from("findings")
    .select("id, control_id, status")
    .eq("id", input.findingId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<FindingRefRow>();

  if (!finding) {
    return { error: "Selected finding does not exist.", control: null };
  }

  if (finding.control_id !== input.controlId) {
    return { error: "Retest finding must target the same control.", control: null };
  }

  return { error: null, control };
}

function buildAutoFindingDueDate(daysFromNow: number) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export async function createControlTestAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseControlTestPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/control-tests/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted control test fields are invalid.")}`,
    );
  }

  const reference = await validateControlTestReferences(parsed.data, profile.organizationId);
  if (reference.error || !reference.control) {
    redirect(`/dashboard/control-tests/new?error=${encodeMessage(reference.error)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildControlTestMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("control_tests")
    .insert(mutation)
    .select("id")
    .single<ControlTestRow>();

  if (error || !data) {
    redirect(
      `/dashboard/control-tests/new?error=${encodeMessage(error?.message, "Could not create control test.")}`,
    );
  }

  let linkedFindingId: string | null = null;

  if (parsed.data.findingId) {
    linkedFindingId = parsed.data.findingId;
    const closesFinding = parsed.data.result === "passed";

    const { error: findingUpdateError } = await supabase
      .from("findings")
      .update({
        status: closesFinding ? "closed" : "in_progress",
        closed_at: closesFinding ? new Date().toISOString() : null,
        resolved_by_control_test_id: closesFinding ? data.id : null,
        updated_by: profile.id,
      })
      .eq("id", parsed.data.findingId)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null);

    if (findingUpdateError) {
      redirect(
        `/dashboard/control-tests/${data.id}?error=${encodeMessage(findingUpdateError.message, "Control test was created but finding update failed.")}`,
      );
    }

    await recordAuditEvent({
      entityType: "finding",
      entityId: parsed.data.findingId,
      action: "update",
      actorProfileId: profile.id,
      organizationId: profile.organizationId,
      summary: {
        status: closesFinding ? "closed" : "in_progress",
        resolved_by_control_test_id: closesFinding ? data.id : null,
      },
    }).catch(() => undefined);
  } else if (parsed.data.result === "failed") {
    const { data: finding, error: findingInsertError } = await supabase
      .from("findings")
      .insert({
        organization_id: profile.organizationId,
        control_id: parsed.data.controlId,
        source_control_test_id: data.id,
        title: `Failed control test - ${reference.control.code}`,
        description:
          parsed.data.notes?.trim() || `Control test failed for ${reference.control.title}.`,
        status: "open",
        severity: "medium",
        remediation_plan: parsed.data.notes?.trim() || null,
        due_date: buildAutoFindingDueDate(30),
        owner_profile_id: parsed.data.testerProfileId,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (findingInsertError) {
      redirect(
        `/dashboard/control-tests/${data.id}?error=${encodeMessage(findingInsertError.message, "Control test was created but automatic finding creation failed.")}`,
      );
    }

    if (finding?.id) {
      linkedFindingId = finding.id;

      await recordAuditEvent({
        entityType: "finding",
        entityId: finding.id,
        action: "create",
        actorProfileId: profile.id,
        organizationId: profile.organizationId,
        summary: {
          source_control_test_id: data.id,
          status: "open",
          severity: "medium",
        },
      }).catch(() => undefined);
    }
  }

  await recordAuditEvent({
    entityType: "control_test",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      control_id: mutation.control_id,
      result: mutation.result,
      tester_profile_id: mutation.tester_profile_id,
      finding_id: linkedFindingId,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/control-tests/${data.id}`);
}

export async function updateControlTestAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const controlTestIdResult = controlTestIdSchema.safeParse(formData.get("controlTestId"));

  if (!controlTestIdResult.success) {
    redirect("/dashboard/control-tests?error=invalid_id");
  }

  const parsed = parseControlTestPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/control-tests/${controlTestIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted control test fields are invalid.")}`,
    );
  }

  if (parsed.data.findingId) {
    redirect(
      `/dashboard/control-tests/${controlTestIdResult.data}/edit?error=${encodeMessage("Retest links cannot be changed during edit.")}`,
    );
  }

  const reference = await validateControlTestReferences(parsed.data, profile.organizationId);
  if (reference.error) {
    redirect(
      `/dashboard/control-tests/${controlTestIdResult.data}/edit?error=${encodeMessage(reference.error)}`,
    );
  }

  const mutation = buildControlTestMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("control_tests")
    .update(mutation)
    .eq("id", controlTestIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/control-tests/${controlTestIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "control_test",
    entityId: controlTestIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      result: mutation.result,
      tester_profile_id: mutation.tester_profile_id,
      test_period_start: mutation.test_period_start,
      test_period_end: mutation.test_period_end,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/control-tests/${controlTestIdResult.data}`);
}

export async function archiveControlTestAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const controlTestIdResult = controlTestIdSchema.safeParse(formData.get("controlTestId"));

  if (!controlTestIdResult.success) {
    redirect("/dashboard/control-tests?error=invalid_id");
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("control_tests")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", controlTestIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/control-tests/${controlTestIdResult.data}?error=${encodeMessage(error.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "control_test",
    entityId: controlTestIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/control-tests");
}
