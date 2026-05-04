import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createRcsaActionPlanAction,
  createRcsaIssueAction,
  reviewRcsaCampaignAction,
  saveRcsaResponsesAction,
} from "@/app/dashboard/rcsa/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  rcsaCampaignIdSchema,
  rcsaResponseValueOptions,
  type RcsaCampaignStatus,
  type RcsaQuestionCategory,
  type RcsaResponseValue,
  type RcsaResult,
} from "@/lib/validators/rcsa";
import { cn } from "@/lib/utils/cn";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type RcsaCampaignDetailRow = {
  id: string;
  title: string;
  description: string | null;
  status: RcsaCampaignStatus;
  owner_profile_id: string | null;
  auditable_entity_id: string | null;
  risk_id: string | null;
  control_id: string | null;
  period_start_date: string | null;
  period_end_date: string | null;
  due_date: string | null;
  score: number | null;
  result: RcsaResult | null;
  manager_review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  owner: ProfileRow | null;
  reviewer: ProfileRow | null;
  auditable_entities: { name: string } | null;
  risks: { title: string } | null;
  controls: { code: string; title: string } | null;
};

type RcsaQuestionRow = {
  id: string;
  category: RcsaQuestionCategory;
  prompt: string;
  weight: number;
};

type RcsaResponseRow = {
  id: string;
  campaign_id: string;
  question_id: string;
  response_value: RcsaResponseValue;
  response_score: number;
  notes: string | null;
  evidence_available: boolean;
  action_required: boolean;
  suggested_action: string | null;
  issue_id: string | null;
  action_plan_id: string | null;
  updated_at: string;
};

function formatProfile(profile: ProfileRow | null) {
  if (!profile) {
    return "-";
  }

  return profile.full_name
    ? `${profile.full_name} (${profile.email})`
    : profile.email;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatPeriod(campaign: RcsaCampaignDetailRow) {
  if (!campaign.period_start_date && !campaign.period_end_date) {
    return "-";
  }

  return `${campaign.period_start_date ?? "unspecified"} to ${campaign.period_end_date ?? "unspecified"}`;
}

function successMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    responses_saved: "RCSA responses were saved.",
    responses_submitted: "RCSA responses were submitted for manager review.",
    reviewed: "Manager review was saved.",
    issue_created: "Issue was created from the weak RCSA response.",
    action_created: "Action plan was created from the weak RCSA response.",
  };

  return code ? (messages[code] ?? null) : null;
}

function canGenerateFollowUp(response: RcsaResponseRow) {
  return (
    response.response_value === "weak" ||
    response.response_value === "critical" ||
    response.action_required
  );
}

export default async function RcsaCampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canReview = hasRole("manager", profile.role);
  const { id } = await params;
  const query = await searchParams;
  const campaignId = rcsaCampaignIdSchema.safeParse(id);

  if (!campaignId.success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: campaign },
    { data: questions },
    { data: responses },
    auditEntries,
  ] = await Promise.all([
    supabase
      .from("rcsa_campaigns")
      .select(
        "id, title, description, status, owner_profile_id, auditable_entity_id, risk_id, control_id, period_start_date, period_end_date, due_date, score, result, manager_review_notes, reviewed_at, created_at, updated_at, owner:profiles!rcsa_campaigns_owner_profile_id_fkey(id, email, full_name), reviewer:profiles!rcsa_campaigns_reviewed_by_profile_id_fkey(id, email, full_name), auditable_entities(name), risks(title), controls(code, title)",
      )
      .eq("id", campaignId.data)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .maybeSingle<RcsaCampaignDetailRow>(),
    supabase
      .from("rcsa_questions")
      .select("id, category, prompt, weight")
      .eq("organization_id", profile.organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("question_key")
      .returns<RcsaQuestionRow[]>(),
    supabase
      .from("rcsa_responses")
      .select(
        "id, campaign_id, question_id, response_value, response_score, notes, evidence_available, action_required, suggested_action, issue_id, action_plan_id, updated_at",
      )
      .eq("campaign_id", campaignId.data)
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<RcsaResponseRow[]>(),
    getAuditEntries("rcsa_campaign", campaignId.data),
  ]);

  if (!campaign) {
    notFound();
  }

  const canRespond = canReview || campaign.owner_profile_id === profile.id;
  const responseByQuestionId = new Map(
    (responses ?? []).map((response) => [response.question_id, response]),
  );
  const success = successMessage(query.success);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            RCSA campaign
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {campaign.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {campaign.status} {campaign.result ? `| ${campaign.result}` : ""}
          </p>
        </div>

        <Link
          href="/dashboard/rcsa"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to RCSA
        </Link>
      </div>

      {query.error ? (
        <FeedbackAlert message={decodeURIComponent(query.error)} />
      ) : null}
      {success ? <FeedbackAlert variant="success" message={success} /> : null}

      <section className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Owner
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatProfile(campaign.owner)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Period
          </p>
          <p className="mt-1 text-sm font-medium">{formatPeriod(campaign)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Due date
          </p>
          <p className="mt-1 text-sm font-medium">{campaign.due_date ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Score
          </p>
          <p className="mt-1 text-sm font-medium">
            {campaign.score === null
              ? "Unscored"
              : `${campaign.score} (${campaign.result ?? "unscored"})`}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Auditable entity
          </p>
          <p className="mt-1 text-sm font-medium">
            {campaign.auditable_entities?.name ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Risk
          </p>
          <p className="mt-1 text-sm font-medium">
            {campaign.risks?.title ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Control
          </p>
          <p className="mt-1 text-sm font-medium">
            {campaign.controls
              ? `${campaign.controls.code} - ${campaign.controls.title}`
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Updated
          </p>
          <p className="mt-1 text-sm font-medium">
            {new Date(campaign.updated_at).toLocaleString()}
          </p>
        </div>
      </section>

      {campaign.description ? (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Description</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {campaign.description}
          </p>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Questionnaire
          </h2>
          <p className="text-sm text-muted-foreground">
            Fixed RCSA questions cover design adequacy, operating effectiveness,
            incidents, evidence, and actions.
          </p>
        </div>

        {(questions?.length ?? 0) === 0 ? (
          <FeedbackAlert message="No active RCSA questions are configured for this organization." />
        ) : null}

        {canRespond && (questions?.length ?? 0) > 0 ? (
          <form action={saveRcsaResponsesAction} className="space-y-4">
            <input type="hidden" name="campaignId" value={campaign.id} />
            {(questions ?? []).map((question) => {
              const response = responseByQuestionId.get(question.id);

              return (
                <fieldset
                  key={question.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <legend className="text-sm font-semibold">
                    {formatLabel(question.category)}{" "}
                    <span className="text-muted-foreground">
                      ({question.weight}%)
                    </span>
                  </legend>
                  <input type="hidden" name="questionId" value={question.id} />
                  <p className="text-sm text-muted-foreground">
                    {question.prompt}
                  </p>

                  <label className="space-y-2 text-sm font-medium">
                    <span>Response for {formatLabel(question.category)}</span>
                    <select
                      name={`responseValue:${question.id}`}
                      defaultValue={response?.response_value ?? "adequate"}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      {rcsaResponseValueOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium">
                    <span>Notes for {formatLabel(question.category)}</span>
                    <textarea
                      name={`notes:${question.id}`}
                      rows={3}
                      maxLength={3000}
                      defaultValue={response?.notes ?? ""}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Explain the basis for this response."
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`evidenceAvailable:${question.id}`}
                        defaultChecked={response?.evidence_available ?? false}
                      />
                      Evidence available
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`actionRequired:${question.id}`}
                        defaultChecked={response?.action_required ?? false}
                      />
                      Action required
                    </label>
                  </div>

                  <label className="space-y-2 text-sm font-medium">
                    <span>
                      Suggested action for {formatLabel(question.category)}
                    </span>
                    <input
                      name={`suggestedAction:${question.id}`}
                      defaultValue={response?.suggested_action ?? ""}
                      maxLength={1000}
                      className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                      placeholder="Optional remediation suggestion."
                    />
                  </label>
                </fieldset>
              );
            })}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                name="intent"
                value="save"
                className={buttonVariants({ variant: "outline" })}
              >
                Save responses
              </button>
              <button
                type="submit"
                name="intent"
                value="submit"
                className={buttonVariants()}
              >
                Submit responses
              </button>
            </div>
          </form>
        ) : null}

        {!canRespond ? (
          <p className="text-sm text-muted-foreground">
            You can view this RCSA, but only managers or the assigned owner can
            submit responses.
          </p>
        ) : null}
      </section>

      {(responses?.length ?? 0) > 0 ? (
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Response summary
            </h2>
            <p className="text-sm text-muted-foreground">
              Weak or action-required responses can generate a linked issue or
              action plan.
            </p>
          </div>

          <ul className="space-y-3">
            {(responses ?? []).map((response) => {
              const question = (questions ?? []).find(
                (item) => item.id === response.question_id,
              );
              const followUpAllowed =
                canRespond && canGenerateFollowUp(response);

              return (
                <li
                  key={response.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {question
                          ? formatLabel(question.category)
                          : "Unknown question"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {question?.prompt ?? "-"}
                      </p>
                    </div>
                    <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                      {response.response_value} | {response.response_score}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Evidence
                      </p>
                      <p className="mt-1">
                        {response.evidence_available
                          ? "Available"
                          : "Not available"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Action required
                      </p>
                      <p className="mt-1">
                        {response.action_required ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Updated
                      </p>
                      <p className="mt-1">
                        {new Date(response.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {response.notes ? (
                    <p className="text-sm text-muted-foreground">
                      {response.notes}
                    </p>
                  ) : null}
                  {response.suggested_action ? (
                    <p className="text-sm">
                      <span className="font-medium">Suggested action:</span>{" "}
                      {response.suggested_action}
                    </p>
                  ) : null}

                  {followUpAllowed ? (
                    <div className="flex flex-wrap gap-2">
                      {response.issue_id ? (
                        <Link
                          href={`/dashboard/issues/${response.issue_id}`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          View linked issue
                        </Link>
                      ) : (
                        <form action={createRcsaIssueAction}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input
                            type="hidden"
                            name="responseId"
                            value={response.id}
                          />
                          <button
                            type="submit"
                            className={buttonVariants({ variant: "outline" })}
                          >
                            Create issue
                          </button>
                        </form>
                      )}

                      {response.action_plan_id ? (
                        <Link
                          href={`/dashboard/actions/${response.action_plan_id}`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          View linked action
                        </Link>
                      ) : (
                        <form action={createRcsaActionPlanAction}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input
                            type="hidden"
                            name="responseId"
                            value={response.id}
                          />
                          <button
                            type="submit"
                            className={buttonVariants({ variant: "outline" })}
                          >
                            Create action plan
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canReview ? (
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Manager review
            </h2>
            <p className="text-sm text-muted-foreground">
              Mark submitted assessments as reviewed or closed with management
              notes.
            </p>
          </div>

          <form action={reviewRcsaCampaignAction} className="space-y-4">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Review status</span>
                <select
                  name="status"
                  defaultValue={
                    campaign.status === "closed" ? "closed" : "reviewed"
                  }
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="reviewed">reviewed</option>
                  <option value="closed">closed</option>
                </select>
              </label>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Reviewed by
                </p>
                <p className="mt-2 text-sm font-medium">
                  {campaign.reviewer
                    ? formatProfile(campaign.reviewer)
                    : "Not reviewed yet"}
                </p>
              </div>
            </div>
            <label className="space-y-2 text-sm font-medium">
              <span>Manager review notes</span>
              <textarea
                name="managerReviewNotes"
                rows={4}
                required
                minLength={3}
                maxLength={4000}
                defaultValue={campaign.manager_review_notes ?? ""}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Record the management review outcome and any follow-up expectations."
              />
            </label>
            <button
              type="submit"
              className={cn(buttonVariants(), "w-full md:w-auto")}
            >
              Save manager review
            </button>
          </form>
        </section>
      ) : null}

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
