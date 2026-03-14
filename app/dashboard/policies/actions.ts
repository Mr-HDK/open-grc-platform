"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPolicyMutation,
  policyAttestationSchema,
  policyFormSchema,
  policyIdSchema,
} from "@/lib/validators/policy";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parsePolicyPayload(formData: FormData) {
  return policyFormSchema.safeParse({
    title: formData.get("title"),
    version: formData.get("version"),
    effectiveDate: formData.get("effectiveDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    content: formData.get("content"),
  });
}

type IdRow = { id: string };

type PolicyLookupRow = {
  id: string;
  title: string;
  status: string;
};

type AttestationLookupRow = {
  id: string;
};

async function validateOwnerProfile(ownerProfileId: string | null, organizationId: string) {
  if (!ownerProfileId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", ownerProfileId)
    .eq("organization_id", organizationId)
    .maybeSingle<IdRow>();

  return data ? null : "Selected owner does not exist.";
}

async function getPolicyForOrganization(policyId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("policies")
    .select("id, title, status")
    .eq("id", policyId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<PolicyLookupRow>();

  return data;
}

export async function createPolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parsePolicyPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/policies/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted policy fields are invalid.")}`,
    );
  }

  const ownerError = await validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId);

  if (ownerError) {
    redirect(`/dashboard/policies/new?error=${encodeMessage(ownerError)}`);
  }

  const mutation = {
    ...buildPolicyMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    status: "draft",
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("policies")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/policies/new?error=${encodeMessage(error?.message, "Could not create policy.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "policy",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      title: mutation.title,
      version: mutation.version,
      status: mutation.status,
      effective_date: mutation.effective_date,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${data.id}`);
}

export async function updatePolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const policyIdResult = policyIdSchema.safeParse(formData.get("policyId"));

  if (!policyIdResult.success) {
    redirect("/dashboard/policies?error=invalid_id");
  }

  const parsed = parsePolicyPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/policies/${policyIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted policy fields are invalid.")}`,
    );
  }

  const ownerError = await validateOwnerProfile(parsed.data.ownerProfileId, profile.organizationId);

  if (ownerError) {
    redirect(`/dashboard/policies/${policyIdResult.data}/edit?error=${encodeMessage(ownerError)}`);
  }

  const existingPolicy = await getPolicyForOrganization(policyIdResult.data, profile.organizationId);

  if (!existingPolicy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  const mutation = buildPolicyMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("policies")
    .update(mutation)
    .eq("id", policyIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/policies/${policyIdResult.data}/edit?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "policy",
    entityId: policyIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      title: mutation.title,
      version: mutation.version,
      effective_date: mutation.effective_date,
      status: existingPolicy.status,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policyIdResult.data}`);
}

export async function publishPolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const policyIdResult = policyIdSchema.safeParse(formData.get("policyId"));

  if (!policyIdResult.success) {
    redirect("/dashboard/policies?error=invalid_id");
  }

  const policy = await getPolicyForOrganization(policyIdResult.data, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const publishedAt = new Date().toISOString();

  const { error: archivePreviousError } = await supabase
    .from("policies")
    .update({
      status: "archived",
      updated_by: profile.id,
    })
    .eq("organization_id", profile.organizationId)
    .eq("title", policy.title)
    .eq("status", "active")
    .neq("id", policy.id)
    .is("deleted_at", null);

  if (archivePreviousError) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(archivePreviousError.message)}`);
  }

  const { error: publishError } = await supabase
    .from("policies")
    .update({
      status: "active",
      published_at: publishedAt,
      updated_by: profile.id,
    })
    .eq("id", policy.id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (publishError) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(publishError.message)}`);
  }

  await recordAuditEvent({
    entityType: "policy",
    entityId: policy.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: "active",
      published_at: publishedAt,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=published`);
}

export async function archivePolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const policyIdResult = policyIdSchema.safeParse(formData.get("policyId"));

  if (!policyIdResult.success) {
    redirect("/dashboard/policies?error=invalid_id");
  }

  const policy = await getPolicyForOrganization(policyIdResult.data, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("policies")
    .update({
      status: "archived",
      updated_by: profile.id,
    })
    .eq("id", policy.id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "policy",
    entityId: policy.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: "archived",
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=archived`);
}

export async function acknowledgePolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("viewer");
  const parsed = policyAttestationSchema.safeParse({
    policyId: formData.get("policyId"),
  });

  if (!parsed.success) {
    redirect("/dashboard/policies?error=invalid_policy_id");
  }

  const policy = await getPolicyForOrganization(parsed.data.policyId, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  if (policy.status !== "active") {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage("Only active policies can be acknowledged.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingAttestation } = await supabase
    .from("policy_attestations")
    .select("id")
    .eq("organization_id", profile.organizationId)
    .eq("policy_id", policy.id)
    .eq("profile_id", profile.id)
    .maybeSingle<AttestationLookupRow>();

  const acknowledgedAt = new Date().toISOString();
  const { error } = await supabase.from("policy_attestations").upsert(
    {
      organization_id: profile.organizationId,
      policy_id: policy.id,
      profile_id: profile.id,
      acknowledged_at: acknowledgedAt,
    },
    { onConflict: "organization_id,policy_id,profile_id" },
  );

  if (error) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "policy_attestation",
    entityId: existingAttestation?.id ?? `${policy.id}:${profile.id}`,
    action: existingAttestation ? "update" : "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      policy_id: policy.id,
      profile_id: profile.id,
      acknowledged_at: acknowledgedAt,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=acknowledged`);
}
