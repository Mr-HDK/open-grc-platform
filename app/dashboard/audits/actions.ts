"use server";

import { redirect } from "next/navigation";
import { type ZodType } from "zod";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { toUserErrorMessage } from "@/lib/forms/error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditEngagementActionLinkIdsSchema,
  auditEngagementFindingLinkIdsSchema,
  auditEngagementFormSchema,
  auditEngagementIdSchema,
  auditPlanFormSchema,
  auditPlanIdSchema,
  auditPlanItemFormSchema,
  auditWorkpaperFormSchema,
  buildAuditEngagementMutation,
  buildAuditPlanItemMutation,
  buildAuditPlanMutation,
  buildAuditWorkpaperMutation,
} from "@/lib/validators/audit";

function encodeMessage(message: string | null | undefined, fallback = "Request could not be completed.") {
  return encodeURIComponent(toUserErrorMessage(message, fallback));
}

function parseAuditPlanPayload(formData: FormData) {
  return auditPlanFormSchema.safeParse({
    title: formData.get("title"),
    planYear: formData.get("planYear"),
    cycle: formData.get("cycle"),
    status: formData.get("status"),
    ownerProfileId: formData.get("ownerProfileId"),
    summary: formData.get("summary"),
  });
}

function parseAuditPlanItemPayload(formData: FormData) {
  return auditPlanItemFormSchema.safeParse({
    auditPlanId: formData.get("auditPlanId"),
    topic: formData.get("topic"),
    auditableEntityId: formData.get("auditableEntityId"),
    riskId: formData.get("riskId"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

function parseAuditEngagementPayload(formData: FormData) {
  return auditEngagementFormSchema.safeParse({
    title: formData.get("title"),
    auditPlanItemId: formData.get("auditPlanItemId"),
    leadAuditorProfileId: formData.get("leadAuditorProfileId"),
    status: formData.get("status"),
    plannedStartDate: formData.get("plannedStartDate"),
    plannedEndDate: formData.get("plannedEndDate"),
    actualStartDate: formData.get("actualStartDate"),
    actualEndDate: formData.get("actualEndDate"),
    scope: formData.get("scope"),
    objectives: formData.get("objectives"),
    summary: formData.get("summary"),
  });
}

function parseAuditWorkpaperPayload(formData: FormData) {
  return auditWorkpaperFormSchema.safeParse({
    auditEngagementId: formData.get("auditEngagementId"),
    title: formData.get("title"),
    procedure: formData.get("procedure"),
    conclusion: formData.get("conclusion"),
    reviewerProfileId: formData.get("reviewerProfileId"),
    evidenceId: formData.get("evidenceId"),
  });
}

function parseLinkIds(formData: FormData, fieldName: string, schema: ZodType<string[]>) {
  return schema.safeParse(
    Array.from(new Set(formData.getAll(fieldName).map((value) => String(value)))),
  );
}

async function replaceLinks(input: {
  table: string;
  ownerColumn: string;
  ownerId: string;
  linkedColumn: string;
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

type IdRow = {
  id: string;
};

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

async function validateAuditPlan(planId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_plans")
    .select("id")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Audit plan was not found.";
}

async function validateAuditPlanItem(planItemId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_plan_items")
    .select("id")
    .eq("id", planItemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Audit plan item was not found.";
}

async function validateAuditEngagement(engagementId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_engagements")
    .select("id")
    .eq("id", engagementId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Audit engagement was not found.";
}

async function validateAuditableEntity(entityId: string | null, organizationId: string) {
  if (!entityId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select("id")
    .eq("id", entityId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Selected auditable entity does not exist.";
}

async function validateRisk(riskId: string | null, organizationId: string) {
  if (!riskId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select("id")
    .eq("id", riskId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IdRow>();

  return data ? null : "Selected risk does not exist.";
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
  table: "findings" | "action_plans";
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

export async function createAuditPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parseAuditPlanPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/audits/plans/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted audit plan fields are invalid.")}`,
    );
  }

  const ownerError = await validateProfile(
    parsed.data.ownerProfileId,
    profile.organizationId,
    "Selected plan owner does not exist.",
  );

  if (ownerError) {
    redirect(`/dashboard/audits/plans/new?error=${encodeMessage(ownerError)}`);
  }

  const mutation = {
    ...buildAuditPlanMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_plans")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/audits/plans/new?error=${encodeMessage(error?.message, "Could not create audit plan.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "audit_plan",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      title: mutation.title,
      plan_year: mutation.plan_year,
      cycle: mutation.cycle,
      status: mutation.status,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/audits/plans/${data.id}`);
}

export async function updateAuditPlanAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const auditPlanIdResult = auditPlanIdSchema.safeParse(formData.get("auditPlanId"));

  if (!auditPlanIdResult.success) {
    redirect("/dashboard/audits?error=invalid_id");
  }

  const parsed = parseAuditPlanPayload(formData);

  if (!parsed.success) {
    redirect(
      `/dashboard/audits/plans/${auditPlanIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted audit plan fields are invalid.")}`,
    );
  }

  const [existingError, ownerError] = await Promise.all([
    validateAuditPlan(auditPlanIdResult.data, profile.organizationId),
    validateProfile(
      parsed.data.ownerProfileId,
      profile.organizationId,
      "Selected plan owner does not exist.",
    ),
  ]);

  if (existingError) {
    redirect(`/dashboard/audits?error=${encodeMessage(existingError)}`);
  }

  if (ownerError) {
    redirect(
      `/dashboard/audits/plans/${auditPlanIdResult.data}/edit?error=${encodeMessage(ownerError)}`,
    );
  }

  const mutation = buildAuditPlanMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("audit_plans")
    .update(mutation)
    .eq("id", auditPlanIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/audits/plans/${auditPlanIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  await recordAuditEvent({
    entityType: "audit_plan",
    entityId: auditPlanIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      plan_year: mutation.plan_year,
      cycle: mutation.cycle,
      status: mutation.status,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/audits/plans/${auditPlanIdResult.data}`);
}

export async function createAuditPlanItemAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parseAuditPlanItemPayload(formData);

  if (!parsed.success) {
    const planId = auditPlanIdSchema.safeParse(formData.get("auditPlanId"));
    const path = planId.success ? `/dashboard/audits/plans/${planId.data}` : "/dashboard/audits";
    redirect(
      `${path}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted audit plan item fields are invalid.")}`,
    );
  }

  const [planError, entityError, riskError] = await Promise.all([
    validateAuditPlan(parsed.data.auditPlanId, profile.organizationId),
    validateAuditableEntity(parsed.data.auditableEntityId, profile.organizationId),
    validateRisk(parsed.data.riskId, profile.organizationId),
  ]);

  if (planError) {
    redirect(`/dashboard/audits?error=${encodeMessage(planError)}`);
  }

  if (entityError) {
    redirect(`/dashboard/audits/plans/${parsed.data.auditPlanId}?error=${encodeMessage(entityError)}`);
  }

  if (riskError) {
    redirect(`/dashboard/audits/plans/${parsed.data.auditPlanId}?error=${encodeMessage(riskError)}`);
  }

  const mutation = {
    ...buildAuditPlanItemMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_plan_items")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/audits/plans/${parsed.data.auditPlanId}?error=${encodeMessage(error?.message, "Could not create audit plan item.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "audit_plan_item",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      audit_plan_id: mutation.audit_plan_id,
      topic: mutation.topic,
      status: mutation.status,
      auditable_entity_id: mutation.auditable_entity_id,
      risk_id: mutation.risk_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/audits/plans/${parsed.data.auditPlanId}`);
}

export async function createAuditEngagementAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const parsed = parseAuditEngagementPayload(formData);
  const findingLinks = parseLinkIds(formData, "findingIds", auditEngagementFindingLinkIdsSchema);
  const actionLinks = parseLinkIds(formData, "actionPlanIds", auditEngagementActionLinkIdsSchema);

  if (!parsed.success) {
    redirect(
      `/dashboard/audits/engagements/new?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted engagement fields are invalid.")}`,
    );
  }

  if (!findingLinks.success) {
    redirect(
      `/dashboard/audits/engagements/new?error=${encodeMessage(findingLinks.error.issues[0]?.message, "Linked finding values are invalid.")}`,
    );
  }

  if (!actionLinks.success) {
    redirect(
      `/dashboard/audits/engagements/new?error=${encodeMessage(actionLinks.error.issues[0]?.message, "Linked action values are invalid.")}`,
    );
  }

  const [planItemError, leadError, findingsError, actionsError] = await Promise.all([
    validateAuditPlanItem(parsed.data.auditPlanItemId, profile.organizationId),
    validateProfile(
      parsed.data.leadAuditorProfileId,
      profile.organizationId,
      "Selected lead auditor does not exist.",
    ),
    validateActiveRows({
      table: "findings",
      ids: findingLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked findings no longer exist or are archived.",
    }),
    validateActiveRows({
      table: "action_plans",
      ids: actionLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked action plans no longer exist or are archived.",
    }),
  ]);

  if (planItemError) {
    redirect(`/dashboard/audits?error=${encodeMessage(planItemError)}`);
  }

  if (leadError) {
    redirect(`/dashboard/audits/engagements/new?error=${encodeMessage(leadError)}`);
  }

  if (findingsError) {
    redirect(`/dashboard/audits/engagements/new?error=${encodeMessage(findingsError)}`);
  }

  if (actionsError) {
    redirect(`/dashboard/audits/engagements/new?error=${encodeMessage(actionsError)}`);
  }

  const mutation = {
    ...buildAuditEngagementMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_engagements")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/audits/engagements/new?error=${encodeMessage(error?.message, "Could not create audit engagement.")}`,
    );
  }

  const [findingLinkError, actionLinkError] = await Promise.all([
    replaceLinks({
      table: "audit_engagement_findings",
      ownerColumn: "audit_engagement_id",
      ownerId: data.id,
      linkedColumn: "finding_id",
      linkedIds: findingLinks.data,
    }),
    replaceLinks({
      table: "audit_engagement_action_plans",
      ownerColumn: "audit_engagement_id",
      ownerId: data.id,
      linkedColumn: "action_plan_id",
      linkedIds: actionLinks.data,
    }),
  ]);

  if (findingLinkError) {
    redirect(`/dashboard/audits/engagements/${data.id}?error=${encodeMessage(findingLinkError)}`);
  }

  if (actionLinkError) {
    redirect(`/dashboard/audits/engagements/${data.id}?error=${encodeMessage(actionLinkError)}`);
  }

  await recordAuditEvent({
    entityType: "audit_engagement",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      audit_plan_item_id: mutation.audit_plan_item_id,
      status: mutation.status,
      planned_start_date: mutation.planned_start_date,
      planned_end_date: mutation.planned_end_date,
      linked_findings: findingLinks.data.length,
      linked_actions: actionLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/audits/engagements/${data.id}`);
}

export async function updateAuditEngagementAction(formData: FormData) {
  const profile = await requireSessionProfile("manager");
  const auditEngagementIdResult = auditEngagementIdSchema.safeParse(formData.get("auditEngagementId"));

  if (!auditEngagementIdResult.success) {
    redirect("/dashboard/audits?error=invalid_id");
  }

  const parsed = parseAuditEngagementPayload(formData);
  const findingLinks = parseLinkIds(formData, "findingIds", auditEngagementFindingLinkIdsSchema);
  const actionLinks = parseLinkIds(formData, "actionPlanIds", auditEngagementActionLinkIdsSchema);

  if (!parsed.success) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted engagement fields are invalid.")}`,
    );
  }

  if (!findingLinks.success) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(findingLinks.error.issues[0]?.message, "Linked finding values are invalid.")}`,
    );
  }

  if (!actionLinks.success) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(actionLinks.error.issues[0]?.message, "Linked action values are invalid.")}`,
    );
  }

  const [engagementError, planItemError, leadError, findingsError, actionsError] = await Promise.all([
    validateAuditEngagement(auditEngagementIdResult.data, profile.organizationId),
    validateAuditPlanItem(parsed.data.auditPlanItemId, profile.organizationId),
    validateProfile(
      parsed.data.leadAuditorProfileId,
      profile.organizationId,
      "Selected lead auditor does not exist.",
    ),
    validateActiveRows({
      table: "findings",
      ids: findingLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked findings no longer exist or are archived.",
    }),
    validateActiveRows({
      table: "action_plans",
      ids: actionLinks.data,
      organizationId: profile.organizationId,
      errorMessage: "One or more linked action plans no longer exist or are archived.",
    }),
  ]);

  if (engagementError) {
    redirect(`/dashboard/audits?error=${encodeMessage(engagementError)}`);
  }

  if (planItemError) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(planItemError)}`,
    );
  }

  if (leadError) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(leadError)}`,
    );
  }

  if (findingsError) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(findingsError)}`,
    );
  }

  if (actionsError) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(actionsError)}`,
    );
  }

  const mutation = buildAuditEngagementMutation(parsed.data, profile.id);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("audit_engagements")
    .update(mutation)
    .eq("id", auditEngagementIdResult.data)
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}/edit?error=${encodeMessage(error.message)}`,
    );
  }

  const [findingLinkError, actionLinkError] = await Promise.all([
    replaceLinks({
      table: "audit_engagement_findings",
      ownerColumn: "audit_engagement_id",
      ownerId: auditEngagementIdResult.data,
      linkedColumn: "finding_id",
      linkedIds: findingLinks.data,
    }),
    replaceLinks({
      table: "audit_engagement_action_plans",
      ownerColumn: "audit_engagement_id",
      ownerId: auditEngagementIdResult.data,
      linkedColumn: "action_plan_id",
      linkedIds: actionLinks.data,
    }),
  ]);

  if (findingLinkError) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}?error=${encodeMessage(findingLinkError)}`,
    );
  }

  if (actionLinkError) {
    redirect(
      `/dashboard/audits/engagements/${auditEngagementIdResult.data}?error=${encodeMessage(actionLinkError)}`,
    );
  }

  await recordAuditEvent({
    entityType: "audit_engagement",
    entityId: auditEngagementIdResult.data,
    action: "update",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      status: mutation.status,
      planned_start_date: mutation.planned_start_date,
      planned_end_date: mutation.planned_end_date,
      actual_start_date: mutation.actual_start_date,
      actual_end_date: mutation.actual_end_date,
      linked_findings: findingLinks.data.length,
      linked_actions: actionLinks.data.length,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/audits/engagements/${auditEngagementIdResult.data}`);
}

export async function createAuditWorkpaperAction(formData: FormData) {
  const profile = await requireSessionProfile("contributor");
  const parsed = parseAuditWorkpaperPayload(formData);

  if (!parsed.success) {
    const engagementId = auditEngagementIdSchema.safeParse(formData.get("auditEngagementId"));
    const path = engagementId.success ? `/dashboard/audits/engagements/${engagementId.data}` : "/dashboard/audits";
    redirect(
      `${path}?error=${encodeMessage(parsed.error.issues[0]?.message, "Submitted workpaper fields are invalid.")}`,
    );
  }

  const [engagementError, reviewerError, evidenceError] = await Promise.all([
    validateAuditEngagement(parsed.data.auditEngagementId, profile.organizationId),
    validateProfile(
      parsed.data.reviewerProfileId,
      profile.organizationId,
      "Selected reviewer does not exist.",
    ),
    validateEvidence(parsed.data.evidenceId, profile.organizationId),
  ]);

  if (engagementError) {
    redirect(`/dashboard/audits?error=${encodeMessage(engagementError)}`);
  }

  if (reviewerError) {
    redirect(`/dashboard/audits/engagements/${parsed.data.auditEngagementId}?error=${encodeMessage(reviewerError)}`);
  }

  if (evidenceError) {
    redirect(`/dashboard/audits/engagements/${parsed.data.auditEngagementId}?error=${encodeMessage(evidenceError)}`);
  }

  const mutation = {
    ...buildAuditWorkpaperMutation(parsed.data, profile.id),
    organization_id: profile.organizationId,
    created_by: profile.id,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_workpapers")
    .insert(mutation)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirect(
      `/dashboard/audits/engagements/${parsed.data.auditEngagementId}?error=${encodeMessage(error?.message, "Could not create workpaper.")}`,
    );
  }

  await recordAuditEvent({
    entityType: "audit_workpaper",
    entityId: data.id,
    action: "create",
    actorProfileId: profile.id,
    organizationId: profile.organizationId,
    summary: {
      audit_engagement_id: mutation.audit_engagement_id,
      title: mutation.title,
      evidence_id: mutation.evidence_id,
    },
  }).catch(() => undefined);

  redirect(`/dashboard/audits/engagements/${parsed.data.auditEngagementId}`);
}
