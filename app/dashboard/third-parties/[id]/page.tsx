import Link from "next/link";
import { notFound } from "next/navigation";

import {
  archiveThirdPartyAction,
  createThirdPartyDocumentRequestAction,
  createThirdPartyReviewAction,
  updateThirdPartyDocumentRequestAction,
} from "@/app/dashboard/third-parties/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { LinkedAuditableEntitiesSection } from "@/components/auditable-entities/linked-auditable-entities-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditableEntitiesForThirdParty } from "@/lib/auditable-entities/links";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  thirdPartyDocumentRequestStatusOptions,
  thirdPartyReviewResponseValueOptions,
} from "@/lib/validators/third-party";

type ThirdPartyDetail = {
  id: string;
  name: string;
  service: string;
  criticality: string;
  tier: string;
  inherent_risk: string;
  onboarding_status: string;
  assessment_status: string;
  assessment_score: number;
  next_review_date: string | null;
  renewal_date: string | null;
  reassessment_interval_days: number;
  last_reviewed_at: string | null;
  owner_profile_id: string | null;
  contract_owner_profile_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type LinkedRiskRow = {
  risks: {
    id: string;
    title: string;
    status: string;
    level: string;
    score: number;
    deleted_at: string | null;
  } | null;
};

type LinkedControlRow = {
  controls: {
    id: string;
    code: string;
    title: string;
    effectiveness_status: string;
    deleted_at: string | null;
  } | null;
};

type LinkedActionRow = {
  action_plans: {
    id: string;
    title: string;
    status: string;
    priority: string;
    deleted_at: string | null;
  } | null;
};

type ReviewRow = {
  id: string;
  review_date: string;
  assessment_status: string;
  assessment_score: number;
  questionnaire_score: number;
  conclusion: string;
  next_review_date: string | null;
  notes: string | null;
  reviewer_profile_id: string | null;
};

type ReviewQuestionRow = {
  id: string;
  question_key: string;
  prompt: string;
  weight: number;
};

type ReviewResponseRow = {
  id: string;
  third_party_review_id: string;
  response_value: string;
  response_notes: string | null;
  score: number;
  third_party_review_questions: {
    question_key: string;
    prompt: string;
  } | null;
};

type DocumentRequestRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  owner_profile_id: string | null;
  requested_by_profile_id: string | null;
  due_date: string;
  evidence_id: string | null;
  response_notes: string | null;
  created_at: string;
};

type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
};

type IssueRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  due_date: string | null;
  owner_profile_id: string | null;
};

function toLabel(value: string) {
  return value.replaceAll("_", " ");
}

function isPast(date: string | null) {
  if (!date) {
    return false;
  }
  return date < new Date().toISOString().slice(0, 10);
}

function formatProfile(profile: ProfileRow | undefined) {
  if (!profile) {
    return "-";
  }
  return profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email;
}

async function getThirdPartyById(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_parties")
    .select(
      "id, name, service, criticality, tier, inherent_risk, onboarding_status, assessment_status, assessment_score, next_review_date, renewal_date, reassessment_interval_days, last_reviewed_at, owner_profile_id, contract_owner_profile_id, notes, created_at, updated_at",
    )
    .eq("id", thirdPartyId)
    .is("deleted_at", null)
    .maybeSingle<ThirdPartyDetail>();

  return data;
}

async function getProfiles(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", organizationId)
    .order("email")
    .returns<ProfileRow[]>();

  return data ?? [];
}

async function getLinkedRisks(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_risks")
    .select("risks(id, title, status, level, score, deleted_at)")
    .eq("third_party_id", thirdPartyId)
    .returns<LinkedRiskRow[]>();

  return (data ?? [])
    .filter((row) => row.risks && !row.risks.deleted_at)
    .map((row) => ({
      id: row.risks!.id,
      title: row.risks!.title,
      status: row.risks!.status,
      level: row.risks!.level,
      score: row.risks!.score,
    }));
}

async function getLinkedControls(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_controls")
    .select("controls(id, code, title, effectiveness_status, deleted_at)")
    .eq("third_party_id", thirdPartyId)
    .returns<LinkedControlRow[]>();

  return (data ?? [])
    .filter((row) => row.controls && !row.controls.deleted_at)
    .map((row) => ({
      id: row.controls!.id,
      code: row.controls!.code,
      title: row.controls!.title,
      effectivenessStatus: row.controls!.effectiveness_status,
    }));
}

async function getLinkedActions(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_actions")
    .select("action_plans(id, title, status, priority, deleted_at)")
    .eq("third_party_id", thirdPartyId)
    .returns<LinkedActionRow[]>();

  return (data ?? [])
    .filter((row) => row.action_plans && !row.action_plans.deleted_at)
    .map((row) => ({
      id: row.action_plans!.id,
      title: row.action_plans!.title,
      status: row.action_plans!.status,
      priority: row.action_plans!.priority,
    }));
}

async function getReviews(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_reviews")
    .select(
      "id, review_date, assessment_status, assessment_score, questionnaire_score, conclusion, next_review_date, notes, reviewer_profile_id",
    )
    .eq("third_party_id", thirdPartyId)
    .order("review_date", { ascending: false })
    .returns<ReviewRow[]>();

  return data ?? [];
}

async function getReviewResponses(reviewIds: string[]) {
  if (reviewIds.length === 0) {
    return [] as ReviewResponseRow[];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_review_responses")
    .select(
      "id, third_party_review_id, response_value, response_notes, score, third_party_review_questions(question_key, prompt)",
    )
    .in("third_party_review_id", reviewIds)
    .order("created_at", { ascending: true })
    .returns<ReviewResponseRow[]>();

  return data ?? [];
}

async function getReviewQuestions(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_review_questions")
    .select("id, question_key, prompt, weight")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("question_key")
    .returns<ReviewQuestionRow[]>();

  return data ?? [];
}

async function getDocumentRequests(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_party_document_requests")
    .select(
      "id, title, description, status, owner_profile_id, requested_by_profile_id, due_date, evidence_id, response_notes, created_at",
    )
    .eq("third_party_id", thirdPartyId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .returns<DocumentRequestRow[]>();

  return data ?? [];
}

async function getEvidenceOptions(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(80)
    .returns<EvidenceRow[]>();

  return data ?? [];
}

async function getOpenIssues(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("issues")
    .select("id, title, status, severity, due_date, owner_profile_id")
    .eq("third_party_id", thirdPartyId)
    .is("deleted_at", null)
    .in("status", ["open", "in_progress", "blocked"])
    .order("due_date", { ascending: true })
    .returns<IssueRow[]>();

  return data ?? [];
}

export default async function ThirdPartyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);
  const { id } = await params;
  const query = await searchParams;

  const thirdParty = await getThirdPartyById(id);
  if (!thirdParty) {
    notFound();
  }

  const [
    profiles,
    linkedRisks,
    linkedControls,
    linkedActions,
    linkedAuditableEntities,
    reviews,
    reviewQuestions,
    documentRequests,
    evidenceOptions,
    openIssues,
    auditEntries,
  ] = await Promise.all([
    getProfiles(profile.organizationId),
    getLinkedRisks(thirdParty.id),
    getLinkedControls(thirdParty.id),
    getLinkedActions(thirdParty.id),
    getAuditableEntitiesForThirdParty(thirdParty.id),
    getReviews(thirdParty.id),
    getReviewQuestions(profile.organizationId),
    getDocumentRequests(thirdParty.id),
    getEvidenceOptions(profile.organizationId),
    getOpenIssues(thirdParty.id),
    getAuditEntries("third_party", thirdParty.id),
  ]);

  const reviewResponses = await getReviewResponses(reviews.map((review) => review.id));
  const responsesByReviewId = new Map<string, ReviewResponseRow[]>();
  for (const response of reviewResponses) {
    const bucket = responsesByReviewId.get(response.third_party_review_id) ?? [];
    bucket.push(response);
    responsesByReviewId.set(response.third_party_review_id, bucket);
  }

  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const ownerLabel = formatProfile(
    thirdParty.owner_profile_id ? profileById.get(thirdParty.owner_profile_id) : undefined,
  );
  const contractOwnerLabel = formatProfile(
    thirdParty.contract_owner_profile_id ? profileById.get(thirdParty.contract_owner_profile_id) : undefined,
  );

  const successMessageByCode: Record<string, string> = {
    review_created: "Review logged successfully.",
    document_request_created: "Document request created.",
    document_request_updated: "Document request updated.",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{thirdParty.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{thirdParty.service}</p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/third-parties/${thirdParty.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}
            {canArchive ? (
              <form action={archiveThirdPartyAction}>
                <input type="hidden" name="thirdPartyId" value={thirdParty.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}
      {query.success ? <FeedbackAlert variant="success" message={successMessageByCode[query.success] ?? "Saved."} /> : null}

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Criticality</p>
          <p className="mt-1 text-sm font-medium">{thirdParty.criticality}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tier</p>
          <p className="mt-1 text-sm font-medium">{toLabel(thirdParty.tier)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Inherent risk</p>
          <p className="mt-1 text-sm font-medium">{toLabel(thirdParty.inherent_risk)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
          <p className="mt-1 text-sm font-medium">{toLabel(thirdParty.onboarding_status)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current review posture</p>
          <p className="mt-1 text-sm font-medium">
            {toLabel(thirdParty.assessment_status)} / {thirdParty.assessment_score}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reassessment cadence</p>
          <p className="mt-1 text-sm font-medium">{thirdParty.reassessment_interval_days} days</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">{ownerLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Contract owner</p>
          <p className="mt-1 text-sm font-medium">{contractOwnerLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Renewal date</p>
          <p className={`mt-1 text-sm font-medium ${isPast(thirdParty.renewal_date) ? "text-rose-600" : ""}`}>
            {thirdParty.renewal_date ?? "-"}
            {isPast(thirdParty.renewal_date) ? " (overdue)" : ""}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next review</p>
          <p className={`mt-1 text-sm font-medium ${isPast(thirdParty.next_review_date) ? "text-rose-600" : ""}`}>
            {thirdParty.next_review_date ?? "-"}
            {isPast(thirdParty.next_review_date) ? " (overdue)" : ""}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last reviewed</p>
          <p className="mt-1 text-sm font-medium">
            {thirdParty.last_reviewed_at ? new Date(thirdParty.last_reviewed_at).toLocaleDateString() : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(thirdParty.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Notes</p>
        <p className="mt-2 whitespace-pre-line text-sm">{thirdParty.notes ?? "-"}</p>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked risks</h2>
        {linkedRisks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No risks linked to this vendor.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedRisks.map((risk) => (
              <li key={risk.id} className="rounded-lg border p-3">
                <Link href={`/dashboard/risks/${risk.id}`} className="text-sm font-medium hover:underline">
                  {risk.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {risk.status} / {risk.level} / score {risk.score}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked controls</h2>
        {linkedControls.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No controls linked to this vendor.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedControls.map((control) => (
              <li key={control.id} className="rounded-lg border p-3">
                <Link href={`/dashboard/controls/${control.id}`} className="text-sm font-medium hover:underline">
                  {control.code} - {control.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  effectiveness {control.effectivenessStatus}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked action plans</h2>
        {linkedActions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No action plans linked to this vendor.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedActions.map((actionItem) => (
              <li key={actionItem.id} className="rounded-lg border p-3">
                <Link href={`/dashboard/actions/${actionItem.id}`} className="text-sm font-medium hover:underline">
                  {actionItem.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {actionItem.status} | {actionItem.priority}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LinkedAuditableEntitiesSection
        title="Linked auditable entities"
        items={linkedAuditableEntities}
        emptyMessage="No auditable entities linked to this third party."
        canCreate={canEdit}
        createHref={`/dashboard/auditable-entities/new?thirdPartyId=${thirdParty.id}`}
      />

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Open issues</h2>
        {openIssues.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No open issues linked to this vendor.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {openIssues.map((issue) => (
              <li key={issue.id} className="rounded-lg border p-3">
                <Link href={`/dashboard/issues/${issue.id}`} className="text-sm font-medium hover:underline">
                  {issue.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {toLabel(issue.status)} | {toLabel(issue.severity)}
                  {issue.due_date ? ` | due ${issue.due_date}` : ""}
                  {issue.owner_profile_id
                    ? ` | owner ${formatProfile(profileById.get(issue.owner_profile_id))}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Periodic reviews</h2>

        {canEdit ? (
          <form action={createThirdPartyReviewAction} className="mt-4 space-y-4 rounded-lg border p-4">
            <input type="hidden" name="thirdPartyId" value={thirdParty.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="reviewDate" className="text-sm font-medium">
                  Review date
                </label>
                <InputDate id="reviewDate" name="reviewDate" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>

              <div className="space-y-2">
                <label htmlFor="reviewerProfileId" className="text-sm font-medium">
                  Reviewer
                </label>
                <select
                  id="reviewerProfileId"
                  name="reviewerProfileId"
                  defaultValue={profile.id}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {profiles.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {formatProfile(reviewer)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="nextReviewDate" className="text-sm font-medium">
                  Next review date (optional)
                </label>
                <InputDate id="nextReviewDate" name="nextReviewDate" defaultValue={thirdParty.next_review_date ?? ""} />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-calculate from reassessment cadence.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Review notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  maxLength={4000}
                  className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Questionnaire</legend>
              {reviewQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active questionnaire configured. Add seed questions before logging a review.
                </p>
              ) : (
                <div className="space-y-3">
                  {reviewQuestions.map((question) => (
                    <div key={question.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium">{question.prompt}</p>
                        <p className="text-xs text-muted-foreground">
                          key {question.question_key} | weight {question.weight}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <select
                          name={`response_${question.id}`}
                          defaultValue="yes"
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        >
                          {thirdPartyReviewResponseValueOptions.map((option) => (
                            <option key={option} value={option}>
                              {toLabel(option)}
                            </option>
                          ))}
                        </select>
                        <input
                          name={`responseNotes_${question.id}`}
                          maxLength={4000}
                          placeholder="Optional response note"
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>

            <button
              type="submit"
              disabled={reviewQuestions.length === 0}
              className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Log review
            </button>
          </form>
        ) : null}

        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No periodic reviews logged yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {review.review_date} | {toLabel(review.conclusion)} | questionnaire {review.questionnaire_score}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  status {toLabel(review.assessment_status)} | score {review.assessment_score}
                  {review.reviewer_profile_id
                    ? ` | reviewer ${formatProfile(profileById.get(review.reviewer_profile_id))}`
                    : ""}
                  {review.next_review_date ? ` | next review ${review.next_review_date}` : ""}
                </p>
                {review.notes ? (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{review.notes}</p>
                ) : null}
                {(responsesByReviewId.get(review.id) ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(responsesByReviewId.get(review.id) ?? []).map((response) => (
                      <li key={response.id}>
                        {(response.third_party_review_questions?.prompt ?? "Question")} - {toLabel(response.response_value)} (score {response.score})
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Document requests</h2>

        {canEdit ? (
          <form action={createThirdPartyDocumentRequestAction} className="mt-4 space-y-4 rounded-lg border p-4">
            <input type="hidden" name="thirdPartyId" value={thirdParty.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  maxLength={180}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dueDate" className="text-sm font-medium">
                  Due date
                </label>
                <InputDate id="dueDate" name="dueDate" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ownerProfileId" className="text-sm font-medium">
                  Owner
                </label>
                <select
                  id="ownerProfileId"
                  name="ownerProfileId"
                  defaultValue={thirdParty.owner_profile_id ?? ""}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {profiles.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {formatProfile(owner)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="evidenceId" className="text-sm font-medium">
                  Evidence (optional)
                </label>
                <select
                  id="evidenceId"
                  name="evidenceId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">None</option>
                  {evidenceOptions.map((evidence) => (
                    <option key={evidence.id} value={evidence.id}>
                      {evidence.title} ({evidence.file_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  maxLength={4000}
                  className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="responseNotes" className="text-sm font-medium">
                  Request notes
                </label>
                <textarea
                  id="responseNotes"
                  name="responseNotes"
                  maxLength={4000}
                  className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
            >
              Add document request
            </button>
          </form>
        ) : null}

        {documentRequests.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No document requests logged yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {documentRequests.map((requestItem) => (
              <li key={requestItem.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{requestItem.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  status {toLabel(requestItem.status)} | due {requestItem.due_date}
                  {requestItem.owner_profile_id
                    ? ` | owner ${formatProfile(profileById.get(requestItem.owner_profile_id))}`
                    : ""}
                </p>
                {requestItem.description ? (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{requestItem.description}</p>
                ) : null}
                {requestItem.response_notes ? (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                    notes: {requestItem.response_notes}
                  </p>
                ) : null}

                {canEdit ? (
                  <form action={updateThirdPartyDocumentRequestAction} className="mt-3 grid gap-3 rounded-md border p-3 md:grid-cols-4">
                    <input type="hidden" name="documentRequestId" value={requestItem.id} />
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Status</label>
                      <select
                        name="status"
                        defaultValue={requestItem.status}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                      >
                        {thirdPartyDocumentRequestStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {toLabel(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Due date</label>
                      <input
                        name="dueDate"
                        type="date"
                        defaultValue={requestItem.due_date}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Owner</label>
                      <select
                        name="ownerProfileId"
                        defaultValue={requestItem.owner_profile_id ?? ""}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {profiles.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {formatProfile(owner)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Evidence</label>
                      <select
                        name="evidenceId"
                        defaultValue={requestItem.evidence_id ?? ""}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                      >
                        <option value="">None</option>
                        {evidenceOptions.map((evidence) => (
                          <option key={evidence.id} value={evidence.id}>
                            {evidence.title} ({evidence.file_name})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-4">
                      <label className="text-xs font-medium">Notes</label>
                      <textarea
                        name="responseNotes"
                        defaultValue={requestItem.response_notes ?? ""}
                        maxLength={4000}
                        className="min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white"
                      >
                        Update request
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}

function InputDate({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="date"
      defaultValue={defaultValue}
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
    />
  );
}
