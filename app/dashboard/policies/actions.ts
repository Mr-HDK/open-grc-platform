"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPolicyMutation,
  policyAcknowledgeSchema,
  policyApprovalSchema,
  policyCampaignSchema,
  policyExceptionIdSchema,
  policyExceptionSchema,
  policyFormSchema,
  policyIdSchema,
  policyReviewSchema,
} from "@/lib/validators/policy";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parsePolicyPayload(formData: FormData) {
  return policyFormSchema.safeParse({
    title: formData.get("title"),
    version: formData.get("version"),
    effectiveDate: formData.get("effectiveDate"),
    nextReviewDate: formData.get("nextReviewDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    content: formData.get("content"),
  });
}

function parseCampaignPayload(formData: FormData) {
  return policyCampaignSchema.safeParse({
    policyId: formData.get("policyId"),
    name: formData.get("name"),
    dueDate: formData.get("dueDate"),
    audienceType: formData.get("audienceType"),
    audienceRole: formData.get("audienceRole"),
    audienceGroupId: formData.get("audienceGroupId"),
    targetProfileIds: formData
      .getAll("targetProfileIds")
      .map((value) => (typeof value === "string" ? value : ""))
      .filter((value) => value.length > 0),
  });
}

function parsePolicyExceptionPayload(formData: FormData) {
  return policyExceptionSchema.safeParse({
    policyId: formData.get("policyId"),
    profileId: formData.get("profileId"),
    justification: formData.get("justification"),
    expirationDate: formData.get("expirationDate"),
    approvedByProfileId: formData.get("approvedByProfileId"),
  });
}

type IdRow = { id: string };

type PolicyLookupRow = {
  id: string;
  title: string;
  status: string;
};

type ProfileLookupRow = {
  id: string;
  role: string;
  status: string | null;
};

type ExceptionLookupRow = {
  id: string;
  status: string;
};

type AttestationLookupRow = {
  id: string;
};

function isActiveProfile(status: string | null) {
  return status !== "deactivated" && status !== "invited";
}

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

async function resolveAudienceProfileIds(input: {
  audienceType: "role" | "profiles" | "group";
  audienceRole: "admin" | "manager" | "contributor" | "viewer" | "" | null;
  audienceGroupId: string | null;
  targetProfileIds: string[];
  organizationId: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (input.audienceType === "role" && input.audienceRole) {
    const { data } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("organization_id", input.organizationId)
      .eq("role", input.audienceRole)
      .returns<Pick<ProfileLookupRow, "id" | "status">[]>();

    return (data ?? []).filter((profile) => isActiveProfile(profile.status)).map((profile) => profile.id);
  }

  if (input.audienceType === "group" && input.audienceGroupId) {
    const { data: group } = await supabase
      .from("policy_audience_groups")
      .select("id")
      .eq("id", input.audienceGroupId)
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .maybeSingle<IdRow>();

    if (!group) {
      return null;
    }

    const { data: memberships } = await supabase
      .from("policy_audience_group_members")
      .select("profile_id")
      .eq("group_id", group.id)
      .returns<{ profile_id: string }[]>();

    const profileIds = Array.from(new Set((memberships ?? []).map((row) => row.profile_id)));

    if (profileIds.length === 0) {
      return [];
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("organization_id", input.organizationId)
      .in("id", profileIds)
      .returns<Pick<ProfileLookupRow, "id" | "status">[]>();

    return (profiles ?? []).filter((profile) => isActiveProfile(profile.status)).map((profile) => profile.id);
  }

  const explicitIds = Array.from(new Set(input.targetProfileIds));

  if (explicitIds.length === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("organization_id", input.organizationId)
    .in("id", explicitIds)
    .returns<Pick<ProfileLookupRow, "id" | "status">[]>();

  return (profiles ?? []).filter((profile) => isActiveProfile(profile.status)).map((profile) => profile.id);
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
      next_review_date: mutation.next_review_date,
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

  if (!["draft", "in_review"].includes(existingPolicy.status)) {
    redirect(
      `/dashboard/policies/${policyIdResult.data}/edit?error=${encodeMessage("Only draft or in-review policies can be edited.")}`,
    );
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
      next_review_date: mutation.next_review_date,
      status: existingPolicy.status,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policyIdResult.data}`);
}

export async function requestPolicyReviewAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = policyReviewSchema.safeParse({
    policyId: formData.get("policyId"),
  });

  if (!parsed.success) {
    redirect("/dashboard/policies?error=invalid_policy_id");
  }

  const policy = await getPolicyForOrganization(parsed.data.policyId, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  if (policy.status !== "draft") {
    redirect(
      `/dashboard/policies/${policy.id}?error=${encodeMessage("Only draft policies can be submitted for review.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("policies")
    .update({
      status: "in_review",
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
      status: "in_review",
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=in_review`);
}

export async function approvePolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = policyApprovalSchema.safeParse({
    policyId: formData.get("policyId"),
    decision: formData.get("decision"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    redirect("/dashboard/policies?error=invalid_approval_payload");
  }

  const policy = await getPolicyForOrganization(parsed.data.policyId, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  if (policy.status !== "in_review") {
    redirect(
      `/dashboard/policies/${policy.id}?error=${encodeMessage("Policy must be in review before approval decisions.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: approval, error: approvalError } = await supabase
    .from("policy_approvals")
    .upsert(
      {
        organization_id: profile.organizationId,
        policy_id: policy.id,
        approver_profile_id: profile.id,
        decision: parsed.data.decision,
        comment: parsed.data.comment,
      },
      { onConflict: "policy_id,approver_profile_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (approvalError || !approval) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(approvalError?.message, "Could not save approval decision.")}`);
  }

  if (parsed.data.decision === "rejected") {
    const { error: policyUpdateError } = await supabase
      .from("policies")
      .update({
        status: "draft",
        updated_by: profile.id,
      })
      .eq("id", policy.id)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null);

    if (policyUpdateError) {
      redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(policyUpdateError.message)}`);
    }

    await recordAuditEvent({
      entityType: "policy",
      entityId: policy.id,
      action: "update",
      actorProfileId: profile.id,
      organizationId: profile.organizationId,
      summary: {
        status: "draft",
      },
    }).catch(() => undefined);
  }

  await recordAuditEvent({
    entityType: "policy_approval",
    entityId: approval.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      policy_id: policy.id,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=${parsed.data.decision}`);
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

  if (policy.status !== "in_review") {
    redirect(
      `/dashboard/policies/${policy.id}?error=${encodeMessage("Policy must be in review before publishing.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { count: approvalCount, error: approvalCountError } = await supabase
    .from("policy_approvals")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", profile.organizationId)
    .eq("policy_id", policy.id)
    .eq("decision", "approved");

  if (approvalCountError) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(approvalCountError.message)}`);
  }

  if ((approvalCount ?? 0) < 1) {
    redirect(
      `/dashboard/policies/${policy.id}?error=${encodeMessage("At least one manager/admin approval is required before publishing.")}`,
    );
  }

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

export async function createPolicyCampaignAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parseCampaignPayload(formData);

  if (!parsed.success) {
    redirect(`/dashboard/policies?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted campaign fields are invalid.")}`);
  }

  const policy = await getPolicyForOrganization(parsed.data.policyId, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  if (policy.status !== "active") {
    redirect(
      `/dashboard/policies/${policy.id}?error=${encodeMessage("Attestation campaigns can be launched only for active policies.")}`,
    );
  }

  const targetProfileIds = await resolveAudienceProfileIds({
    audienceType: parsed.data.audienceType,
    audienceRole: parsed.data.audienceRole,
    audienceGroupId: parsed.data.audienceGroupId,
    targetProfileIds: parsed.data.targetProfileIds,
    organizationId: profile.organizationId,
  });

  if (targetProfileIds === null) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage("Selected audience group does not exist.")}`);
  }

  if (targetProfileIds.length === 0) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage("No active profiles match the selected audience.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("policy_attestation_campaigns")
    .insert({
      organization_id: profile.organizationId,
      policy_id: policy.id,
      name: parsed.data.name,
      due_date: parsed.data.dueDate,
      audience_type: parsed.data.audienceType,
      audience_role: parsed.data.audienceRole,
      audience_group_id: parsed.data.audienceGroupId,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (campaignError || !campaign) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(campaignError?.message, "Could not create attestation campaign.")}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultStatus = parsed.data.dueDate < today ? "overdue" : "pending";

  const { error: targetsError } = await supabase.from("policy_attestation_targets").insert(
    targetProfileIds.map((targetProfileId) => ({
      organization_id: profile.organizationId,
      policy_id: policy.id,
      campaign_id: campaign.id,
      profile_id: targetProfileId,
      due_date: parsed.data.dueDate,
      status: defaultStatus,
    })),
  );

  if (targetsError) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(targetsError.message, "Could not create campaign targets.")}`);
  }

  await recordAuditEvent({
    entityType: "policy_attestation_campaign",
    entityId: campaign.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      policy_id: policy.id,
      audience_type: parsed.data.audienceType,
      audience_size: targetProfileIds.length,
      due_date: parsed.data.dueDate,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=campaign_created`);
}

export async function acknowledgePolicyAction(formData: FormData) {
  const profile = await requireSessionProfile("viewer");
  const parsed = policyAcknowledgeSchema.safeParse({
    policyId: formData.get("policyId"),
    campaignId: formData.get("campaignId"),
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
  let targetQuery = supabase
    .from("policy_attestation_targets")
    .select("id")
    .eq("organization_id", profile.organizationId)
    .eq("policy_id", policy.id)
    .eq("profile_id", profile.id)
    .neq("status", "acknowledged");

  if (parsed.data.campaignId) {
    targetQuery = targetQuery.eq("campaign_id", parsed.data.campaignId);
  }

  const { data: targets } = await targetQuery.returns<IdRow[]>();

  if (!targets || targets.length === 0) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage("No pending attestation campaign found for your profile.")}`);
  }

  const acknowledgedAt = new Date().toISOString();
  const targetIds = targets.map((target) => target.id);

  const { error: targetUpdateError } = await supabase
    .from("policy_attestation_targets")
    .update({
      status: "acknowledged",
      acknowledged_at: acknowledgedAt,
    })
    .in("id", targetIds)
    .eq("organization_id", profile.organizationId);

  if (targetUpdateError) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(targetUpdateError.message)}`);
  }

  const { data: existingAttestation } = await supabase
    .from("policy_attestations")
    .select("id")
    .eq("organization_id", profile.organizationId)
    .eq("policy_id", policy.id)
    .eq("profile_id", profile.id)
    .maybeSingle<AttestationLookupRow>();

  const { error: attestationError } = await supabase.from("policy_attestations").upsert(
    {
      organization_id: profile.organizationId,
      policy_id: policy.id,
      profile_id: profile.id,
      acknowledged_at: acknowledgedAt,
    },
    { onConflict: "organization_id,policy_id,profile_id" },
  );

  if (attestationError) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(attestationError.message)}`);
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
      acknowledged_targets: targetIds.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=acknowledged`);
}

export async function createPolicyExceptionAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parsePolicyExceptionPayload(formData);

  if (!parsed.success) {
    redirect(`/dashboard/policies?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted exception fields are invalid.")}`);
  }

  const policy = await getPolicyForOrganization(parsed.data.policyId, profile.organizationId);

  if (!policy) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy not found.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: approver } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", parsed.data.approvedByProfileId)
    .eq("organization_id", profile.organizationId)
    .maybeSingle<ProfileLookupRow>();

  if (!approver || !["manager", "admin"].includes(approver.role)) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage("Approver must be a manager or admin profile.")}`);
  }

  if (parsed.data.profileId) {
    const { data: scopedProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.profileId)
      .eq("organization_id", profile.organizationId)
      .maybeSingle<IdRow>();

    if (!scopedProfile) {
      redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage("Selected waived profile does not exist.")}`);
    }
  }

  const { data: policyException, error } = await supabase
    .from("policy_exceptions")
    .insert({
      organization_id: profile.organizationId,
      policy_id: policy.id,
      profile_id: parsed.data.profileId,
      justification: parsed.data.justification,
      expiration_date: parsed.data.expirationDate,
      approved_by_profile_id: parsed.data.approvedByProfileId,
      status: "active",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !policyException) {
    redirect(`/dashboard/policies/${policy.id}?error=${encodeMessage(error?.message, "Could not create policy exception.")}`);
  }

  await recordAuditEvent({
    entityType: "policy_exception",
    entityId: policyException.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      policy_id: policy.id,
      profile_id: parsed.data.profileId,
      expiration_date: parsed.data.expirationDate,
      approved_by_profile_id: parsed.data.approvedByProfileId,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policy.id}?success=exception_created`);
}

export async function revokePolicyExceptionAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsedId = policyExceptionIdSchema.safeParse(formData.get("policyExceptionId"));

  if (!parsedId.success) {
    redirect("/dashboard/policies?error=invalid_exception_id");
  }

  const supabase = await createSupabaseServerClient();
  const { data: policyException } = await supabase
    .from("policy_exceptions")
    .select("id, policy_id, status")
    .eq("id", parsedId.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .maybeSingle<ExceptionLookupRow & { policy_id: string }>();

  if (!policyException) {
    redirect(`/dashboard/policies?error=${encodeMessage("Policy exception not found.")}`);
  }

  if (policyException.status === "revoked") {
    redirect(`/dashboard/policies/${policyException.policy_id}?success=exception_revoked`);
  }

  const revokedAt = new Date().toISOString();
  const { error } = await supabase
    .from("policy_exceptions")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_by_profile_id: profile.id,
      updated_by: profile.id,
    })
    .eq("id", policyException.id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/policies/${policyException.policy_id}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "policy_exception",
    entityId: policyException.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: "revoked",
      revoked_at: revokedAt,
      revoked_by_profile_id: profile.id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/policies/${policyException.policy_id}?success=exception_revoked`);
}
