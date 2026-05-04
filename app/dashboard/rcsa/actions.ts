"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { hasRole, type Role } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildRcsaCampaignMutation,
  rcsaCampaignFormSchema,
  rcsaResponseActionSchema,
  rcsaResponsesFormSchema,
  rcsaReviewFormSchema,
  type RcsaResponseValue,
  type RcsaResult,
} from "@/lib/validators/rcsa";

function encodeMessage(
  message: string | null | undefined,
  fallback = "Request could not be completed.",
) {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function dateOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function responseScore(value: RcsaResponseValue) {
  const scores: Record<RcsaResponseValue, number> = {
    strong: 100,
    adequate: 75,
    weak: 45,
    critical: 10,
  };

  return scores[value];
}

function deriveResult(score: number): RcsaResult {
  if (score >= 75) {
    return "satisfactory";
  }

  if (score >= 50) {
    return "needs_attention";
  }

  return "critical";
}

function parseResponses(formData: FormData) {
  const questionIds = formData.getAll("questionId").map(String);
  const responses = questionIds.map((questionId) => ({
    questionId,
    responseValue: formData.get(`responseValue:${questionId}`),
    notes: formData.get(`notes:${questionId}`),
    evidenceAvailable: formData.get(`evidenceAvailable:${questionId}`) === "on",
    actionRequired: formData.get(`actionRequired:${questionId}`) === "on",
    suggestedAction: formData.get(`suggestedAction:${questionId}`),
  }));

  return rcsaResponsesFormSchema.safeParse({
    campaignId: formData.get("campaignId"),
    intent: formData.get("intent"),
    responses,
  });
}

type IdRow = { id: string };

type CampaignRow = {
  id: string;
  title: string;
  organization_id: string;
  owner_profile_id: string | null;
  risk_id: string | null;
  control_id: string | null;
  status: string;
};

type ResponseDetailRow = {
  id: string;
  campaign_id: string;
  response_value: RcsaResponseValue;
  response_score: number;
  notes: string | null;
  suggested_action: string | null;
  issue_id: string | null;
  action_plan_id: string | null;
  rcsa_campaigns: CampaignRow | null;
  rcsa_questions: {
    prompt: string;
    category: string;
  } | null;
};

async function ensureReference(input: {
  table: string;
  id: string | null;
  organizationId: string;
  message: string;
  deletedColumn?: string | null;
}) {
  if (!input.id) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from(input.table)
    .select("id")
    .eq("id", input.id)
    .eq("organization_id", input.organizationId);

  if (input.deletedColumn !== null) {
    query = query.is(input.deletedColumn ?? "deleted_at", null);
  }

  const { data } = await query.maybeSingle<IdRow>();
  return data ? null : input.message;
}

async function getCampaign(campaignId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rcsa_campaigns")
    .select(
      "id, title, organization_id, owner_profile_id, risk_id, control_id, status",
    )
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<CampaignRow>();

  return data ?? null;
}

function canWorkCampaign(
  campaign: CampaignRow,
  profile: { id: string; role: Role },
) {
  return (
    hasRole("manager", profile.role) || campaign.owner_profile_id === profile.id
  );
}

export async function createRcsaCampaignAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = rcsaCampaignFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    ownerProfileId: formData.get("ownerProfileId"),
    auditableEntityId: formData.get("auditableEntityId"),
    riskId: formData.get("riskId"),
    controlId: formData.get("controlId"),
    periodStartDate: formData.get("periodStartDate"),
    periodEndDate: formData.get("periodEndDate"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    redirect(
      `/dashboard/rcsa/new?error=${encodeMessage(parsed.error.issues[0]?.message)}`,
    );
  }

  const referenceChecks = await Promise.all([
    ensureReference({
      table: "profiles",
      id: parsed.data.ownerProfileId,
      organizationId: profile.organizationId,
      message: "Selected owner does not exist.",
      deletedColumn: null,
    }),
    ensureReference({
      table: "auditable_entities",
      id: parsed.data.auditableEntityId,
      organizationId: profile.organizationId,
      message: "Selected auditable entity does not exist.",
    }),
    ensureReference({
      table: "risks",
      id: parsed.data.riskId,
      organizationId: profile.organizationId,
      message: "Selected risk does not exist.",
    }),
    ensureReference({
      table: "controls",
      id: parsed.data.controlId,
      organizationId: profile.organizationId,
      message: "Selected control does not exist.",
    }),
  ]);

  const referenceError = referenceChecks.find(Boolean);
  if (referenceError) {
    redirect(`/dashboard/rcsa/new?error=${encodeMessage(referenceError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const mutation = {
    ...buildRcsaCampaignMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("rcsa_campaigns")
    .insert(mutation)
    .select("id")
    .single<IdRow>();

  if (error || !data) {
    redirect(
      `/dashboard/rcsa/new?error=${encodeMessage(error?.message, "Could not create RCSA campaign.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "rcsa_campaign",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      owner_profile_id: mutation.owner_profile_id,
      auditable_entity_id: mutation.auditable_entity_id,
      risk_id: mutation.risk_id,
      control_id: mutation.control_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/rcsa/${data.id}`);
}

export async function saveRcsaResponsesAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseResponses(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/rcsa?error=${encodeMessage(parsed.error.issues[0]?.message)}`,
    );
  }

  const campaign = await getCampaign(
    parsed.data.campaignId,
    profile.organizationId,
  );
  if (!campaign || !canWorkCampaign(campaign, profile)) {
    redirect(
      `/dashboard/rcsa?error=${encodeMessage("RCSA campaign was not found or is not assigned to you.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const questionIds = parsed.data.responses.map(
    (response) => response.questionId,
  );
  const { data: questions } = await supabase
    .from("rcsa_questions")
    .select("id, weight")
    .in("id", questionIds)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .returns<Array<{ id: string; weight: number }>>();

  if ((questions ?? []).length !== questionIds.length) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage("One or more RCSA questions are invalid.")}`,
    );
  }

  const weightByQuestionId = new Map(
    (questions ?? []).map((question) => [question.id, question.weight]),
  );
  const rows = parsed.data.responses.map((response) => ({
    organization_id: profile.organizationId,
    campaign_id: campaign.id,
    question_id: response.questionId,
    response_value: response.responseValue,
    response_score: responseScore(response.responseValue),
    notes: response.notes,
    evidence_available: response.evidenceAvailable,
    action_required: response.actionRequired,
    suggested_action: response.suggestedAction,
    created_by: profile.id,
    updated_by: profile.id,
  }));

  const { error: upsertError } = await supabase
    .from("rcsa_responses")
    .upsert(rows, { onConflict: "campaign_id,question_id" });

  if (upsertError) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage(upsertError.message)}`,
    );
  }

  const weightedTotal = parsed.data.responses.reduce((total, response) => {
    return (
      total +
      (weightByQuestionId.get(response.questionId) ?? 0) *
        responseScore(response.responseValue)
    );
  }, 0);
  const weightTotal = parsed.data.responses.reduce(
    (total, response) =>
      total + (weightByQuestionId.get(response.questionId) ?? 0),
    0,
  );
  const score = weightTotal > 0 ? Math.round(weightedTotal / weightTotal) : 0;
  const result = deriveResult(score);
  const nextStatus =
    parsed.data.intent === "submit" ? "submitted" : "in_progress";

  const { error: campaignError } = await supabase
    .from("rcsa_campaigns")
    .update({
      score,
      result,
      status: nextStatus,
      updated_by: profile.id,
    })
    .eq("id", campaign.id)
    .eq("organization_id", profile.organizationId);

  if (campaignError) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage(campaignError.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "rcsa_campaign",
    entityId: campaign.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { score, result, status: nextStatus },
  }).catch(() => undefined);

  redirect(
    `/dashboard/rcsa/${campaign.id}?success=${parsed.data.intent === "submit" ? "responses_submitted" : "responses_saved"}`,
  );
}

export async function reviewRcsaCampaignAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = rcsaReviewFormSchema.safeParse({
    campaignId: formData.get("campaignId"),
    status: formData.get("status"),
    managerReviewNotes: formData.get("managerReviewNotes"),
  });

  if (!parsed.success) {
    redirect(
      `/dashboard/rcsa?error=${encodeMessage(parsed.error.issues[0]?.message)}`,
    );
  }

  const campaign = await getCampaign(
    parsed.data.campaignId,
    profile.organizationId,
  );
  if (!campaign) {
    redirect(
      `/dashboard/rcsa?error=${encodeMessage("RCSA campaign was not found.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("rcsa_campaigns")
    .update({
      status: parsed.data.status,
      manager_review_notes: parsed.data.managerReviewNotes,
      reviewed_by_profile_id: profile.id,
      reviewed_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", campaign.id)
    .eq("organization_id", profile.organizationId);

  if (error) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage(error.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "rcsa_campaign",
    entityId: campaign.id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { status: parsed.data.status, reviewed_by_profile_id: profile.id },
  }).catch(() => undefined);

  redirect(`/dashboard/rcsa/${campaign.id}?success=reviewed`);
}

async function getResponseForAction(
  responseId: string,
  campaignId: string,
  organizationId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rcsa_responses")
    .select(
      "id, campaign_id, response_value, response_score, notes, suggested_action, issue_id, action_plan_id, rcsa_campaigns(id, title, organization_id, owner_profile_id, risk_id, control_id, status), rcsa_questions(prompt, category)",
    )
    .eq("id", responseId)
    .eq("campaign_id", campaignId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ResponseDetailRow>();

  return data ?? null;
}

export async function createRcsaIssueAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = rcsaResponseActionSchema.safeParse({
    campaignId: formData.get("campaignId"),
    responseId: formData.get("responseId"),
  });

  if (!parsed.success) {
    redirect(
      `/dashboard/rcsa?error=${encodeMessage(parsed.error.issues[0]?.message)}`,
    );
  }

  const response = await getResponseForAction(
    parsed.data.responseId,
    parsed.data.campaignId,
    profile.organizationId,
  );
  const campaign = response?.rcsa_campaigns ?? null;

  if (!response || !campaign || !canWorkCampaign(campaign, profile)) {
    redirect(
      `/dashboard/rcsa/${parsed.data.campaignId}?error=${encodeMessage("RCSA response was not found.")}`,
    );
  }

  if (response.issue_id) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage("This RCSA response already has a linked issue.")}`,
    );
  }

  const severity = response.response_value === "critical" ? "critical" : "high";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("issues")
    .insert({
      organization_id: profile.organizationId,
      title: `RCSA issue - ${response.rcsa_questions?.category.replaceAll("_", " ") ?? "assessment gap"}`,
      description: `RCSA campaign "${campaign.title}" produced a ${response.response_value} response: ${response.rcsa_questions?.prompt ?? "Question unavailable."}`,
      issue_type: "control_failure",
      severity,
      status: "open",
      owner_profile_id: campaign.owner_profile_id ?? profile.id,
      due_date: dateOffset(14),
      root_cause: response.notes,
      management_response: response.suggested_action,
      resolution_notes: null,
      risk_id: campaign.risk_id,
      control_id: campaign.control_id,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<IdRow>();

  if (error || !data) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage(error?.message, "Could not create issue.")}`,
    );
  }

  await supabase
    .from("rcsa_responses")
    .update({ issue_id: data.id, updated_by: profile.id })
    .eq("id", response.id)
    .eq("organization_id", profile.organizationId);

  redirect(`/dashboard/rcsa/${campaign.id}?success=issue_created`);
}

export async function createRcsaActionPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = rcsaResponseActionSchema.safeParse({
    campaignId: formData.get("campaignId"),
    responseId: formData.get("responseId"),
  });

  if (!parsed.success) {
    redirect(
      `/dashboard/rcsa?error=${encodeMessage(parsed.error.issues[0]?.message)}`,
    );
  }

  const response = await getResponseForAction(
    parsed.data.responseId,
    parsed.data.campaignId,
    profile.organizationId,
  );
  const campaign = response?.rcsa_campaigns ?? null;

  if (!response || !campaign || !canWorkCampaign(campaign, profile)) {
    redirect(
      `/dashboard/rcsa/${parsed.data.campaignId}?error=${encodeMessage("RCSA response was not found.")}`,
    );
  }

  if (response.action_plan_id) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage("This RCSA response already has a linked action plan.")}`,
    );
  }

  const priority = response.response_value === "critical" ? "critical" : "high";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("action_plans")
    .insert({
      organization_id: profile.organizationId,
      title:
        response.suggested_action ?? `Remediate RCSA gap - ${campaign.title}`,
      description: `Follow-up action generated from RCSA campaign "${campaign.title}". ${response.rcsa_questions?.prompt ?? ""}`,
      risk_id: campaign.risk_id,
      control_id: campaign.control_id,
      owner_profile_id: campaign.owner_profile_id ?? profile.id,
      status: "open",
      priority,
      target_date: dateOffset(30),
      completed_at: null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<IdRow>();

  if (error || !data) {
    redirect(
      `/dashboard/rcsa/${campaign.id}?error=${encodeMessage(error?.message, "Could not create action plan.")}`,
    );
  }

  await supabase
    .from("rcsa_responses")
    .update({ action_plan_id: data.id, updated_by: profile.id })
    .eq("id", response.id)
    .eq("organization_id", profile.organizationId);

  redirect(`/dashboard/rcsa/${campaign.id}?success=action_created`);
}
