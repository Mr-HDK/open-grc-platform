"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildControlAttestationMutation,
  buildControlEvidenceRequestMutation,
  controlAttestationFormSchema,
  controlAttestationUpdateSchema,
  controlEvidenceRequestFormSchema,
  controlEvidenceRequestUpdateSchema,
} from "@/lib/validators/control-assurance";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseControlAttestationPayload(formData: FormData) {
  return controlAttestationFormSchema.safeParse({
    controlId: formData.get("controlId"),
    cycleName: formData.get("cycleName"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
  });
}

function parseControlAttestationUpdatePayload(formData: FormData) {
  return controlAttestationUpdateSchema.safeParse({
    attestationId: formData.get("attestationId"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    attestedEffectivenessStatus: formData.get("attestedEffectivenessStatus"),
    ownerComment: formData.get("ownerComment"),
    reviewComment: formData.get("reviewComment"),
  });
}

function parseControlEvidenceRequestPayload(formData: FormData) {
  return controlEvidenceRequestFormSchema.safeParse({
    controlId: formData.get("controlId"),
    controlAttestationId: formData.get("controlAttestationId"),
    title: formData.get("title"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    evidenceId: formData.get("evidenceId"),
    responseNotes: formData.get("responseNotes"),
    reviewComment: formData.get("reviewComment"),
  });
}

function parseControlEvidenceRequestUpdatePayload(formData: FormData) {
  return controlEvidenceRequestUpdateSchema.safeParse({
    evidenceRequestId: formData.get("evidenceRequestId"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    evidenceId: formData.get("evidenceId"),
    responseNotes: formData.get("responseNotes"),
    reviewComment: formData.get("reviewComment"),
  });
}

type IdRow = { id: string };

type ControlReferenceRow = {
  id: string;
  code: string;
  title: string;
  owner_profile_id: string | null;
};

type AttestationReferenceRow = {
  id: string;
  control_id: string;
  cycle_name: string;
  due_date: string;
  status: "pending" | "submitted" | "reviewed";
  owner_profile_id: string | null;
  attested_at: string | null;
  reviewed_at: string | null;
};

type EvidenceRequestReferenceRow = {
  id: string;
  control_id: string;
  title: string;
  owner_profile_id: string | null;
  status: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  due_date: string;
};

type EvidenceReferenceRow = {
  id: string;
  control_id: string | null;
};

async function getControlReference(controlId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select("id, code, title, owner_profile_id")
    .eq("id", controlId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlReferenceRow>();

  return data;
}

async function validateProfile(profileId: string | null, organizationId: string) {
  if (!profileId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .maybeSingle<IdRow>();

  return data ? null : "Selected owner does not exist.";
}

async function getAttestationReference(attestationId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_attestations")
    .select("id, control_id, cycle_name, due_date, status, owner_profile_id, attested_at, reviewed_at")
    .eq("id", attestationId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<AttestationReferenceRow>();

  return data;
}

async function validateAttestationForControl(
  attestationId: string | null,
  controlId: string,
  organizationId: string,
) {
  if (!attestationId) {
    return { error: null, attestation: null };
  }

  const attestation = await getAttestationReference(attestationId, organizationId);

  if (!attestation) {
    return { error: "Selected attestation does not exist.", attestation: null };
  }

  if (attestation.control_id !== controlId) {
    return {
      error: "Evidence requests must target an attestation for the same control.",
      attestation: null,
    };
  }

  return { error: null, attestation };
}

async function getEvidenceRequestReference(evidenceRequestId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_evidence_requests")
    .select("id, control_id, title, owner_profile_id, status, due_date")
    .eq("id", evidenceRequestId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<EvidenceRequestReferenceRow>();

  return data;
}

async function getEvidenceReference(evidenceId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, control_id")
    .eq("id", evidenceId)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .maybeSingle<EvidenceReferenceRow>();

  return data;
}

async function ensureEvidenceMatchesControl(
  evidenceId: string | null,
  controlId: string,
  organizationId: string,
) {
  if (!evidenceId) {
    return null;
  }

  const evidence = await getEvidenceReference(evidenceId, organizationId);

  if (!evidence) {
    return "Selected evidence does not exist.";
  }

  if (evidence.control_id && evidence.control_id !== controlId) {
    return "Selected evidence is linked to a different control.";
  }

  if (!evidence.control_id) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("evidence")
      .update({ control_id: controlId })
      .eq("id", evidenceId)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    if (error) {
      return error.message;
    }
  }

  return null;
}

export async function createControlAttestationAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseControlAttestationPayload(formData);

  if (!parsed.success) {
    const controlId = typeof formData.get("controlId") === "string" ? String(formData.get("controlId")) : "";
    redirect(
      `/dashboard/controls/${controlId}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted attestation fields are invalid.")}`,
    );
  }

  const control = await getControlReference(parsed.data.controlId, profile.organizationId);

  if (!control) {
    redirect(`/dashboard/controls?error=${encodeMessage("Control not found.")}`);
  }

  const ownerProfileId = parsed.data.ownerProfileId ?? control.owner_profile_id ?? profile.id;
  const ownerError = await validateProfile(ownerProfileId, profile.organizationId);

  if (ownerError) {
    redirect(`/dashboard/controls/${control.id}?error=${encodeMessage(ownerError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildControlAttestationMutation(parsed.data, ownerProfileId, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("control_attestations")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/controls/${control.id}?error=${encodeMessage(error?.message, "Could not create attestation cycle.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "control_attestation",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      control_id: control.id,
      cycle_name: mutation.cycle_name,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
      status: mutation.status,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/controls/${control.id}?success=attestation_created`);
}

export async function updateControlAttestationAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseControlAttestationUpdatePayload(formData);

  if (!parsed.success) {
    redirect(`/dashboard/controls?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const existing = await getAttestationReference(parsed.data.attestationId, profile.organizationId);

  if (!existing) {
    redirect(`/dashboard/controls?error=${encodeMessage("Attestation not found.")}`);
  }

  const ownerProfileId = parsed.data.ownerProfileId ?? existing.owner_profile_id;
  const ownerError = await validateProfile(ownerProfileId, profile.organizationId);

  if (ownerError) {
    redirect(`/dashboard/controls/${existing.control_id}?error=${encodeMessage(ownerError)}`);
  }

  const now = new Date().toISOString();
  const submitted = parsed.data.status !== "pending";
  const reviewed = parsed.data.status === "reviewed";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("control_attestations")
    .update({
      status: parsed.data.status,
      due_date: parsed.data.dueDate,
      owner_profile_id: ownerProfileId,
      attested_effectiveness_status: submitted ? parsed.data.attestedEffectivenessStatus : null,
      owner_comment: submitted ? parsed.data.ownerComment : null,
      attested_at: submitted ? existing.attested_at ?? now : null,
      reviewer_profile_id: reviewed ? profile.id : null,
      review_comment: reviewed ? parsed.data.reviewComment : null,
      reviewed_at: reviewed ? existing.reviewed_at ?? now : null,
      updated_by: profile.id,
    })
    .eq("id", existing.id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/controls/${existing.control_id}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "control_attestation",
    entityId: existing.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      control_id: existing.control_id,
      status: parsed.data.status,
      due_date: parsed.data.dueDate,
      attested_effectiveness_status: submitted ? parsed.data.attestedEffectivenessStatus : null,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/controls/${existing.control_id}?success=attestation_updated`);
}

export async function createControlEvidenceRequestAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseControlEvidenceRequestPayload(formData);

  if (!parsed.success) {
    const controlId = typeof formData.get("controlId") === "string" ? String(formData.get("controlId")) : "";
    redirect(
      `/dashboard/controls/${controlId}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted evidence request fields are invalid.")}`,
    );
  }

  const control = await getControlReference(parsed.data.controlId, profile.organizationId);

  if (!control) {
    redirect(`/dashboard/controls?error=${encodeMessage("Control not found.")}`);
  }

  const ownerProfileId = parsed.data.ownerProfileId ?? control.owner_profile_id ?? null;
  const [ownerError, attestationValidation, evidenceError] = await Promise.all([
    validateProfile(ownerProfileId, profile.organizationId),
    validateAttestationForControl(parsed.data.controlAttestationId, control.id, profile.organizationId),
    ensureEvidenceMatchesControl(parsed.data.evidenceId, control.id, profile.organizationId),
  ]);

  if (ownerError) {
    redirect(`/dashboard/controls/${control.id}?error=${encodeMessage(ownerError)}`);
  }

  if (attestationValidation.error) {
    redirect(`/dashboard/controls/${control.id}?error=${encodeMessage(attestationValidation.error)}`);
  }

  if (evidenceError) {
    redirect(`/dashboard/controls/${control.id}?error=${encodeMessage(evidenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildControlEvidenceRequestMutation(parsed.data, ownerProfileId, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("control_evidence_requests")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/controls/${control.id}?error=${encodeMessage(error?.message, "Could not create evidence request.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "control_evidence_request",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      control_id: control.id,
      control_attestation_id: mutation.control_attestation_id,
      title: mutation.title,
      due_date: mutation.due_date,
      status: mutation.status,
      evidence_id: mutation.evidence_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/controls/${control.id}?success=evidence_request_created`);
}

export async function updateControlEvidenceRequestAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseControlEvidenceRequestUpdatePayload(formData);

  if (!parsed.success) {
    redirect(`/dashboard/controls?error=${encodeMessage(parsed.error.issues[0]?.message)}`);
  }

  const existing = await getEvidenceRequestReference(parsed.data.evidenceRequestId, profile.organizationId);

  if (!existing) {
    redirect(`/dashboard/controls?error=${encodeMessage("Evidence request not found.")}`);
  }

  const ownerProfileId = parsed.data.ownerProfileId ?? existing.owner_profile_id;
  const [ownerError, evidenceError] = await Promise.all([
    validateProfile(ownerProfileId, profile.organizationId),
    ensureEvidenceMatchesControl(parsed.data.evidenceId, existing.control_id, profile.organizationId),
  ]);

  if (ownerError) {
    redirect(`/dashboard/controls/${existing.control_id}?error=${encodeMessage(ownerError)}`);
  }

  if (evidenceError) {
    redirect(`/dashboard/controls/${existing.control_id}?error=${encodeMessage(evidenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("control_evidence_requests")
    .update({
      status: parsed.data.status,
      due_date: parsed.data.dueDate,
      owner_profile_id: ownerProfileId,
      evidence_id: parsed.data.evidenceId,
      response_notes: parsed.data.responseNotes,
      review_comment: parsed.data.reviewComment,
      updated_by: profile.id,
    })
    .eq("id", existing.id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/controls/${existing.control_id}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "control_evidence_request",
    entityId: existing.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      control_id: existing.control_id,
      title: existing.title,
      status: parsed.data.status,
      due_date: parsed.data.dueDate,
      evidence_id: parsed.data.evidenceId,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/controls/${existing.control_id}?success=evidence_request_updated`);
}
