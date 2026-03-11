import Link from "next/link";
import { notFound } from "next/navigation";

import {
  archiveThirdPartyAction,
  createThirdPartyReviewAction,
} from "@/app/dashboard/third-parties/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { thirdPartyAssessmentStatusOptions } from "@/lib/validators/third-party";

type ThirdPartyDetail = {
  id: string;
  name: string;
  service: string;
  criticality: string;
  assessment_status: string;
  assessment_score: number;
  next_review_date: string | null;
  last_reviewed_at: string | null;
  owner_profile_id: string | null;
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
  next_review_date: string | null;
  notes: string | null;
  reviewer_profile_id: string | null;
};

async function getThirdPartyById(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_parties")
    .select(
      "id, name, service, criticality, assessment_status, assessment_score, next_review_date, last_reviewed_at, owner_profile_id, notes, created_at, updated_at",
    )
    .eq("id", thirdPartyId)
    .is("deleted_at", null)
    .maybeSingle<ThirdPartyDetail>();

  return data;
}

async function getOwner(ownerId: string | null) {
  if (!ownerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ownerId)
    .maybeSingle<ProfileRow>();

  return data;
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
    .select("id, review_date, assessment_status, assessment_score, next_review_date, notes, reviewer_profile_id")
    .eq("third_party_id", thirdPartyId)
    .order("review_date", { ascending: false })
    .returns<ReviewRow[]>();

  return data ?? [];
}

function isOverdue(nextReviewDate: string | null) {
  if (!nextReviewDate) {
    return false;
  }

  return nextReviewDate < new Date().toISOString().slice(0, 10);
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

  const [owner, linkedRisks, linkedControls, linkedActions, reviews, reviewers, auditEntries] = await Promise.all([
    getOwner(thirdParty.owner_profile_id),
    getLinkedRisks(thirdParty.id),
    getLinkedControls(thirdParty.id),
    getLinkedActions(thirdParty.id),
    getReviews(thirdParty.id),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("organization_id", profile.organizationId)
        .order("email")
        .returns<ProfileRow[]>(),
    ),
    getAuditEntries("third_party", thirdParty.id),
  ]);
  const reviewerById = new Map(
    ((reviewers.data ?? []) as ProfileRow[]).map((reviewer) => [
      reviewer.id,
      reviewer.full_name ? `${reviewer.full_name} (${reviewer.email})` : reviewer.email,
    ]),
  );

  const isNextReviewOverdue = isOverdue(thirdParty.next_review_date);

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
      {query.success === "review_created" ? (
        <FeedbackAlert variant="success" message="Review logged successfully." />
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Notes</p>
        <p className="mt-2 whitespace-pre-line text-sm">{thirdParty.notes ?? "-"}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Criticality</p>
          <p className="mt-1 text-sm font-medium">{thirdParty.criticality}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Assessment</p>
          <p className="mt-1 text-sm font-medium">
            {thirdParty.assessment_status} / {thirdParty.assessment_score}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next review</p>
          <p className={`mt-1 text-sm font-medium ${isNextReviewOverdue ? "text-rose-600" : ""}`}>
            {thirdParty.next_review_date ?? "-"}
            {isNextReviewOverdue ? " (overdue)" : ""}
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
                <Link
                  href={`/dashboard/controls/${control.id}`}
                  className="text-sm font-medium hover:underline"
                >
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
                <Link
                  href={`/dashboard/actions/${actionItem.id}`}
                  className="text-sm font-medium hover:underline"
                >
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

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Periodic reviews</h2>
        </div>

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
                  {(reviewers.data ?? []).map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.full_name ? `${reviewer.full_name} (${reviewer.email})` : reviewer.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="assessmentStatus" className="text-sm font-medium">
                  Assessment status
                </label>
                <select
                  id="assessmentStatus"
                  name="assessmentStatus"
                  defaultValue={thirdParty.assessment_status}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {thirdPartyAssessmentStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="assessmentScore" className="text-sm font-medium">
                  Assessment score
                </label>
                <input
                  id="assessmentScore"
                  name="assessmentScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={thirdParty.assessment_score}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="nextReviewDate" className="text-sm font-medium">
                  Next review date
                </label>
                <InputDate id="nextReviewDate" name="nextReviewDate" defaultValue={thirdParty.next_review_date ?? ""} />
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

            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
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
                  {review.review_date} - {review.assessment_status} / {review.assessment_score}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  reviewer{" "}
                  {review.reviewer_profile_id
                    ? reviewerById.get(review.reviewer_profile_id) ?? "Unknown"
                    : "Unknown"}
                  {review.next_review_date ? ` | next review ${review.next_review_date}` : ""}
                </p>
                {review.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{review.notes}</p>
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
