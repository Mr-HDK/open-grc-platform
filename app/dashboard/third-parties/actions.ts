"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildThirdPartyDocumentRequestMutation,
  buildThirdPartyMutation,
  buildThirdPartyReviewMutation,
  thirdPartyActionLinkIdsSchema,
  thirdPartyControlLinkIdsSchema,
  thirdPartyDocumentRequestFormSchema,
  thirdPartyDocumentRequestIdSchema,
  thirdPartyDocumentRequestUpdateSchema,
  thirdPartyFormSchema,
  thirdPartyIdSchema,
  thirdPartyReviewFormSchema,
  thirdPartyReviewResponseSchema,
  thirdPartyRiskLinkIdsSchema,
  type ThirdPartyAssessmentStatus,
  type ThirdPartyReviewConclusion,
  type ThirdPartyReviewResponseValue,
} from "@/lib/validators/third-party";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseThirdPartyPayload(formData: FormData) {
  return thirdPartyFormSchema.safeParse({
    name: formData.get("name"),
    service: formData.get("service"),
    criticality: formData.get("criticality"),
    tier: formData.get("tier"),
    inherentRisk: formData.get("inherentRisk"),
    onboardingStatus: formData.get("onboardingStatus"),
    assessmentStatus: formData.get("assessmentStatus"),
    assessmentScore: formData.get("assessmentScore"),
    nextReviewDate: formData.get("nextReviewDate"),
    renewalDate: formData.get("renewalDate"),
    reassessmentIntervalDays: formData.get("reassessmentIntervalDays"),
    ownerProfileId: formData.get("ownerProfileId"),
    contractOwnerProfileId: formData.get("contractOwnerProfileId"),
    notes: formData.get("notes"),
  });
}

function parseRiskLinks(formData: FormData) {
  return thirdPartyRiskLinkIdsSchema.safeParse(
    Array.from(new Set(formData.getAll("riskIds").map((value) => String(value)))),
  );
}

function parseControlLinks(formData: FormData) {
  return thirdPartyControlLinkIdsSchema.safeParse(
    Array.from(new Set(formData.getAll("controlIds").map((value) => String(value)))),
  );
}

function parseActionLinks(formData: FormData) {
  return thirdPartyActionLinkIdsSchema.safeParse(
    Array.from(new Set(formData.getAll("actionPlanIds").map((value) => String(value)))),
  );
}

function parseReviewPayload(formData: FormData) {
  return thirdPartyReviewFormSchema.safeParse({
    thirdPartyId: formData.get("thirdPartyId"),
    reviewDate: formData.get("reviewDate"),
    reviewerProfileId: formData.get("reviewerProfileId"),
    nextReviewDate: formData.get("nextReviewDate"),
    notes: formData.get("notes"),
  });
}

function parseDocumentRequestPayload(formData: FormData) {
  return thirdPartyDocumentRequestFormSchema.safeParse({
    thirdPartyId: formData.get("thirdPartyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    evidenceId: formData.get("evidenceId"),
    responseNotes: formData.get("responseNotes"),
  });
}

function parseDocumentRequestUpdatePayload(formData: FormData) {
  return thirdPartyDocumentRequestUpdateSchema.safeParse({
    documentRequestId: formData.get("documentRequestId"),
    status: formData.get("status"),
    dueDate: formData.get("dueDate"),
    ownerProfileId: formData.get("ownerProfileId"),
    evidenceId: formData.get("evidenceId"),
    responseNotes: formData.get("responseNotes"),
  });
}

type IdRow = {
  id: string;
};

type ThirdPartyReferenceRow = {
  id: string;
  reassessment_interval_days: number;
};

type ReviewQuestionRow = {
  id: string;
  question_key: string;
  prompt: string;
  weight: number;
};

type ReviewResponseInsertResult = {
  id: string;
  question_id: string;
  response_value: ThirdPartyReviewResponseValue;
  score: number;
};

type DocumentRequestReferenceRow = {
  id: string;
  third_party_id: string;
};

const responseScores: Record<ThirdPartyReviewResponseValue, number> = {
  yes: 100,
  partial: 50,
  no: 0,
  not_applicable: 100,
};

function mapScoreToConclusion(score: number): ThirdPartyReviewConclusion {
  if (score >= 80) {
    return "low_risk";
  }
  if (score >= 60) {
    return "moderate_risk";
  }
  if (score >= 40) {
    return "high_risk";
  }
  return "critical_risk";
}

function mapConclusionToAssessmentStatus(conclusion: ThirdPartyReviewConclusion): ThirdPartyAssessmentStatus {
  switch (conclusion) {
    case "low_risk":
      return "acceptable";
    case "moderate_risk":
      return "monitoring";
    case "high_risk":
      return "elevated";
    case "critical_risk":
      return "critical";
  }
}

function calculateWeightedQuestionnaireScore(input: {
  questions: ReviewQuestionRow[];
  responses: {
    questionId: string;
    responseValue: ThirdPartyReviewResponseValue;
  }[];
}) {
  const responseByQuestionId = new Map(
    input.responses.map((response) => [response.questionId, response.responseValue]),
  );

  let totalWeight = 0;
  let weightedTotal = 0;

  for (const question of input.questions) {
    const responseValue = responseByQuestionId.get(question.id);
    const responseScore = responseValue ? responseScores[responseValue] : 0;

    totalWeight += question.weight;
    weightedTotal += responseScore * question.weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return Math.round(weightedTotal / totalWeight);
}

function addDaysToIsoDate(date: string, days: number) {
  const draft = new Date(`${date}T00:00:00.000Z`);
  draft.setUTCDate(draft.getUTCDate() + days);
  return draft.toISOString().slice(0, 10);
}

async function replaceLinks(input: {
  table: "third_party_risks" | "third_party_controls" | "third_party_actions";
  ownerColumn: "third_party_id";
  ownerId: string;
  linkedColumn: "risk_id" | "control_id" | "action_plan_id";
  linkedIds: string[];
}) {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from(input.table)
    .delete()
    .eq(input.ownerColumn, input.ownerId);

  if (deleteError) {
    return deleteError.message;
  }

  if (input.linkedIds.length === 0) {
    return null;
  }

  const rows = input.linkedIds.map((linkedId) => ({
    [input.ownerColumn]: input.ownerId,
    [input.linkedColumn]: linkedId,
  }));

  const { error: insertError } = await supabase.from(input.table).insert(rows);
  return insertError ? insertError.message : null;
}

async function validateProfile(profileId: string | null, organizationId: string, message: string) {
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

  return data ? null : message;
}

async function validateEvidence(evidenceId: string | null, organizationId: string) {
  if (!evidenceId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id")
    .eq("id", evidenceId)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Selected evidence does not exist.";
}

async function validateActiveRows(input: {
  table: "risks" | "controls" | "action_plans";
  ids: string[];
  organizationId: string;
  errorMessage: string;
}) {
  if (input.ids.length === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from(input.table)
    .select("id")
    .in("id", input.ids)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .returns<IdRow[]>();

  return (data ?? []).length === input.ids.length ? null : input.errorMessage;
}

async function getThirdPartyReference(thirdPartyId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_parties")
    .select("id, reassessment_interval_days")
    .eq("id", thirdPartyId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ThirdPartyReferenceRow>();

  return data;
}

async function getDocumentRequestReference(documentRequestId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_document_requests")
    .select("id, third_party_id")
    .eq("id", documentRequestId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<DocumentRequestReferenceRow>();

  return data;
}

async function getActiveReviewQuestions(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_review_questions")
    .select("id, question_key, prompt, weight")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("question_key", { ascending: true })
    .returns<ReviewQuestionRow[]>();

  return data ?? [];
}

function parseReviewResponses(formData: FormData, questions: ReviewQuestionRow[]) {
  if (questions.length === 0) {
    return {
      success: false as const,
      message: "No active questionnaire is configured. Seed or create review questions first.",
    };
  }

  const parsedResponses = [];

  for (const question of questions) {
    const parsed = thirdPartyReviewResponseSchema.safeParse({
      questionId: question.id,
      responseValue: formData.get(`response_${question.id}`),
      responseNotes: formData.get(`responseNotes_${question.id}`),
    });

    if (!parsed.success) {
      return {
        success: false as const,
        message: `Question \"${question.prompt}\" has an invalid or missing response.`,
      };
    }

    parsedResponses.push(parsed.data);
  }

  return {
    success: true as const,
    data: parsedResponses,
  };
}

export async function createThirdPartyAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseThirdPartyPayload(formData);
  const riskLinks = parseRiskLinks(formData);
  const controlLinks = parseControlLinks(formData);
  const actionLinks = parseActionLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted third-party fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  if (!actionLinks.success) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(actionLinks.error.issues[0]?.message, "Linked action values are invalid.")}`,
    );
  }

  const [ownerError, contractOwnerError, riskError, controlError, actionError] = await Promise.all([
    validateProfile(parsed.data.ownerProfileId, profile.organizationId, "Selected owner does not exist."),
    validateProfile(
      parsed.data.contractOwnerProfileId,
      profile.organizationId,
      "Selected contract owner does not exist.",
    ),
    validateActiveRows({
      table: "risks",
      ids: riskLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked risks no longer exist or are archived.",
    }),
    validateActiveRows({
      table: "controls",
      ids: controlLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked controls no longer exist or are archived.",
    }),
    validateActiveRows({
      table: "action_plans",
      ids: actionLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked action plans no longer exist or are archived.",
    }),
  ]);

  if (ownerError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(ownerError)}`);
  }

  if (contractOwnerError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(contractOwnerError)}`);
  }

  if (riskError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(riskError)}`);
  }

  if (controlError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(controlError)}`);
  }

  if (actionError) {
    redirect(`/dashboard/third-parties/new?error=${encodeMessage(actionError)}`);
  }

  const mutation = {
    ...buildThirdPartyMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("third_parties")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/third-parties/new?error=${encodeMessage(error?.message, "Could not create third-party record.")}`,
    );
  }

  const [riskLinkError, controlLinkError, actionLinkError] = await Promise.all([
    replaceLinks({
      table: "third_party_risks",
      ownerColumn: "third_party_id",
      ownerId: data.id,
      linkedColumn: "risk_id",
      linkedIds: riskLinks.data,
    }),
    replaceLinks({
      table: "third_party_controls",
      ownerColumn: "third_party_id",
      ownerId: data.id,
      linkedColumn: "control_id",
      linkedIds: controlLinks.data,
    }),
    replaceLinks({
      table: "third_party_actions",
      ownerColumn: "third_party_id",
      ownerId: data.id,
      linkedColumn: "action_plan_id",
      linkedIds: actionLinks.data,
    }),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/third-parties/${data.id}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(`/dashboard/third-parties/${data.id}?error=${encodeMessage(controlLinkError)}`);
  }

  if (actionLinkError) {
    redirect(`/dashboard/third-parties/${data.id}?error=${encodeMessage(actionLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "third_party",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      name: mutation.name,
      service: mutation.service,
      criticality: mutation.criticality,
      tier: mutation.tier,
      inherent_risk: mutation.inherent_risk,
      onboarding_status: mutation.onboarding_status,
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
      linked_actions: actionLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${data.id}`);
}

export async function updateThirdPartyAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));

  if (!thirdPartyIdResult.success) {
    redirect("/dashboard/third-parties?error=invalid_id");
  }

  const parsed = parseThirdPartyPayload(formData);
  const riskLinks = parseRiskLinks(formData);
  const controlLinks = parseControlLinks(formData);
  const actionLinks = parseActionLinks(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted third-party fields are invalid.")}`,
    );
  }

  if (!riskLinks.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(riskLinks.error.issues[0]?.message, "Linked risk values are invalid.")}`,
    );
  }

  if (!controlLinks.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(controlLinks.error.issues[0]?.message, "Linked control values are invalid.")}`,
    );
  }

  if (!actionLinks.success) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(actionLinks.error.issues[0]?.message, "Linked action values are invalid.")}`,
    );
  }

  const [existingThirdParty, ownerError, contractOwnerError, riskError, controlError, actionError] =
    await Promise.all([
      getThirdPartyReference(thirdPartyIdResult.data, profile.organizationId),
      validateProfile(parsed.data.ownerProfileId, profile.organizationId, "Selected owner does not exist."),
      validateProfile(
        parsed.data.contractOwnerProfileId,
        profile.organizationId,
        "Selected contract owner does not exist.",
      ),
      validateActiveRows({
        table: "risks",
        ids: riskLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked risks no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "controls",
        ids: controlLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked controls no longer exist or are archived.",
      }),
      validateActiveRows({
        table: "action_plans",
        ids: actionLinks.data,
        organizationId: profile.organizationId,
        errorMessage: "One or more linked action plans no longer exist or are archived.",
      }),
    ]);

  if (!existingThirdParty) {
    redirect(`/dashboard/third-parties?error=${encodeMessage("Third-party record was not found.")}`);
  }

  if (ownerError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(ownerError)}`);
  }

  if (contractOwnerError) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(contractOwnerError)}`,
    );
  }

  if (riskError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(riskError)}`);
  }

  if (controlError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(controlError)}`);
  }

  if (actionError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(actionError)}`);
  }

  const mutation = buildThirdPartyMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("third_parties")
    .update(mutation)
    .eq("id", thirdPartyIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const [riskLinkError, controlLinkError, actionLinkError] = await Promise.all([
    replaceLinks({
      table: "third_party_risks",
      ownerColumn: "third_party_id",
      ownerId: thirdPartyIdResult.data,
      linkedColumn: "risk_id",
      linkedIds: riskLinks.data,
    }),
    replaceLinks({
      table: "third_party_controls",
      ownerColumn: "third_party_id",
      ownerId: thirdPartyIdResult.data,
      linkedColumn: "control_id",
      linkedIds: controlLinks.data,
    }),
    replaceLinks({
      table: "third_party_actions",
      ownerColumn: "third_party_id",
      ownerId: thirdPartyIdResult.data,
      linkedColumn: "action_plan_id",
      linkedIds: actionLinks.data,
    }),
  ]);

  if (riskLinkError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(riskLinkError)}`);
  }

  if (controlLinkError) {
    redirect(
      `/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(controlLinkError)}`,
    );
  }

  if (actionLinkError) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(actionLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "third_party",
    entityId: thirdPartyIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      service: mutation.service,
      criticality: mutation.criticality,
      tier: mutation.tier,
      inherent_risk: mutation.inherent_risk,
      onboarding_status: mutation.onboarding_status,
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
      renewal_date: mutation.renewal_date,
      reassessment_interval_days: mutation.reassessment_interval_days,
      linked_risks: riskLinks.data.length,
      linked_controls: controlLinks.data.length,
      linked_actions: actionLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}`);
}

export async function archiveThirdPartyAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));

  if (!thirdPartyIdResult.success) {
    redirect("/dashboard/third-parties?error=invalid_id");
  }

  const existing = await getThirdPartyReference(thirdPartyIdResult.data, profile.organizationId);
  if (!existing) {
    redirect(`/dashboard/third-parties?error=${encodeMessage("Third-party record was not found.")}`);
  }

  const deletedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("third_parties")
    .update({
      deleted_at: deletedAt,
      updated_by: profile.id,
    })
    .eq("id", thirdPartyIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/third-parties/${thirdPartyIdResult.data}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "third_party",
    entityId: thirdPartyIdResult.data,
    action: "soft_delete",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: { deleted_at: deletedAt },
  }).catch(() => undefined);

  redirect("/dashboard/third-parties");
}

export async function createThirdPartyReviewAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseReviewPayload(formData);

  if (!parsed.success) {
    const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));
    const path = thirdPartyIdResult.success
      ? `/dashboard/third-parties/${thirdPartyIdResult.data}`
      : "/dashboard/third-parties";
    redirect(
      `${path}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted review fields are invalid.")}`,
    );
  }

  const thirdParty = await getThirdPartyReference(parsed.data.thirdPartyId, profile.organizationId);
  if (!thirdParty) {
    redirect(`/dashboard/third-parties?error=${encodeMessage("Third-party record was not found.")}`);
  }

  const reviewerProfileId = parsed.data.reviewerProfileId ?? profile.id;
  const reviewerError = await validateProfile(
    reviewerProfileId,
    profile.organizationId,
    "Selected reviewer does not exist.",
  );

  if (reviewerError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(reviewerError)}`);
  }

  const questions = await getActiveReviewQuestions(profile.organizationId);
  const parsedResponses = parseReviewResponses(formData, questions);
  if (!parsedResponses.success) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(parsedResponses.message)}`);
  }

  const questionnaireScore = calculateWeightedQuestionnaireScore({
    questions,
    responses: parsedResponses.data.map((response) => ({
      questionId: response.questionId,
      responseValue: response.responseValue,
    })),
  });
  const conclusion = mapScoreToConclusion(questionnaireScore);
  const assessmentStatus = mapConclusionToAssessmentStatus(conclusion);
  const nextReviewDate =
    parsed.data.nextReviewDate ?? addDaysToIsoDate(parsed.data.reviewDate, thirdParty.reassessment_interval_days);

  const mutation = buildThirdPartyReviewMutation(
    {
      ...parsed.data,
      reviewerProfileId,
      nextReviewDate,
    },
    profile.id,
    {
      questionnaireScore,
      conclusion,
      assessmentStatus,
    },
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("third_party_reviews")
    .insert({
      ...mutation,
      organization_id: profile.organizationId,
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(error?.message, "Could not create review.")}`,
    );
  }

  const responseRows = parsedResponses.data.map((response) => ({
    organization_id: profile.organizationId,
    third_party_review_id: data.id,
    question_id: response.questionId,
    response_value: response.responseValue,
    response_notes: response.responseNotes,
    score: responseScores[response.responseValue],
    created_by: profile.id,
    updated_by: profile.id,
  }));

  const { data: insertedResponses, error: responseError } = await supabase
    .from("third_party_review_responses")
    .insert(responseRows)
    .select("id, question_id, response_value, score")
    .returns<ReviewResponseInsertResult[]>();

  if (responseError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(responseError.message)}`);
  }

  const reviewTimestamp = `${mutation.review_date}T00:00:00.000Z`;
  const { error: syncError } = await supabase
    .from("third_parties")
    .update({
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
      last_reviewed_at: reviewTimestamp,
      updated_by: profile.id,
    })
    .eq("id", mutation.third_party_id)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (syncError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(syncError.message)}`);
  }

  await recordAuditEvent({
    entityType: "third_party_review",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      third_party_id: mutation.third_party_id,
      review_date: mutation.review_date,
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      questionnaire_score: mutation.questionnaire_score,
      conclusion: mutation.conclusion,
      next_review_date: mutation.next_review_date,
      response_count: responseRows.length,
    },
  }).catch(() => undefined);

  await recordAuditEvent({
    entityType: "third_party",
    entityId: mutation.third_party_id,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      assessment_status: mutation.assessment_status,
      assessment_score: mutation.assessment_score,
      next_review_date: mutation.next_review_date,
      last_reviewed_at: reviewTimestamp,
    },
  }).catch(() => undefined);

  await Promise.all(
    (insertedResponses ?? []).map((response) =>
      recordAuditEvent({
        entityType: "third_party_review_response",
        entityId: response.id,
        action: "create",
        actorProfileId: profile.id,
        organizationId: profile.organizationId,
        summary: {
          third_party_review_id: data.id,
          question_id: response.question_id,
          response_value: response.response_value,
          score: response.score,
        },
      }).catch(() => undefined),
    ),
  );

  redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?success=review_created`);
}

export async function createThirdPartyDocumentRequestAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseDocumentRequestPayload(formData);

  if (!parsed.success) {
    const thirdPartyIdResult = thirdPartyIdSchema.safeParse(formData.get("thirdPartyId"));
    const path = thirdPartyIdResult.success
      ? `/dashboard/third-parties/${thirdPartyIdResult.data}`
      : "/dashboard/third-parties";
    redirect(
      `${path}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted document request fields are invalid.")}`,
    );
  }

  const [thirdParty, ownerError, evidenceError] = await Promise.all([
    getThirdPartyReference(parsed.data.thirdPartyId, profile.organizationId),
    validateProfile(
      parsed.data.ownerProfileId,
      profile.organizationId,
      "Selected document owner does not exist.",
    ),
    validateEvidence(parsed.data.evidenceId, profile.organizationId),
  ]);

  if (!thirdParty) {
    redirect(`/dashboard/third-parties?error=${encodeMessage("Third-party record was not found.")}`);
  }

  if (ownerError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(ownerError)}`);
  }

  if (evidenceError) {
    redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(evidenceError)}`);
  }

  const mutation = {
    ...buildThirdPartyDocumentRequestMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    third_party_id: parsed.data.thirdPartyId,
    title: parsed.data.title,
    description: parsed.data.description,
    status: "requested" as const,
    requested_by_profile_id: profile.id,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("third_party_document_requests")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/third-parties/${parsed.data.thirdPartyId}?error=${encodeMessage(error?.message, "Could not create document request.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "third_party_document_request",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      third_party_id: parsed.data.thirdPartyId,
      title: mutation.title,
      status: mutation.status,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
      evidence_id: mutation.evidence_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${parsed.data.thirdPartyId}?success=document_request_created`);
}

export async function updateThirdPartyDocumentRequestAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseDocumentRequestUpdatePayload(formData);

  if (!parsed.success) {
    const documentRequestIdResult = thirdPartyDocumentRequestIdSchema.safeParse(
      formData.get("documentRequestId"),
    );
    if (!documentRequestIdResult.success) {
      redirect("/dashboard/third-parties?error=invalid_id");
    }

    const documentRequest = await getDocumentRequestReference(
      documentRequestIdResult.data,
      profile.organizationId,
    );
    const path = documentRequest
      ? `/dashboard/third-parties/${documentRequest.third_party_id}`
      : "/dashboard/third-parties";

    redirect(
      `${path}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted document request update is invalid.")}`,
    );
  }

  const documentRequest = await getDocumentRequestReference(parsed.data.documentRequestId, profile.organizationId);

  if (!documentRequest) {
    redirect(`/dashboard/third-parties?error=${encodeMessage("Document request was not found.")}`);
  }

  const [ownerError, evidenceError] = await Promise.all([
    validateProfile(
      parsed.data.ownerProfileId,
      profile.organizationId,
      "Selected document owner does not exist.",
    ),
    validateEvidence(parsed.data.evidenceId, profile.organizationId),
  ]);

  if (ownerError) {
    redirect(`/dashboard/third-parties/${documentRequest.third_party_id}?error=${encodeMessage(ownerError)}`);
  }

  if (evidenceError) {
    redirect(`/dashboard/third-parties/${documentRequest.third_party_id}?error=${encodeMessage(evidenceError)}`);
  }

  const mutation = {
    ...buildThirdPartyDocumentRequestMutation(parsed.data, profile.id),
    status: parsed.data.status,
  };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("third_party_document_requests")
    .update(mutation)
    .eq("id", parsed.data.documentRequestId)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/third-parties/${documentRequest.third_party_id}?error=${encodeMessage(error.message)}`);
  }

  await recordAuditEvent({
    entityType: "third_party_document_request",
    entityId: parsed.data.documentRequestId,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      due_date: mutation.due_date,
      owner_profile_id: mutation.owner_profile_id,
      evidence_id: mutation.evidence_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/third-parties/${documentRequest.third_party_id}?success=document_request_updated`);
}
