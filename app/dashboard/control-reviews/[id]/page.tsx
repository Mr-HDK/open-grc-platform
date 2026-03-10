import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveControlReviewAction } from "@/app/dashboard/control-reviews/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { buttonVariants } from "@/components/ui/button";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ControlReviewDetail = {
  id: string;
  status: string;
  target_date: string;
  completed_at: string | null;
  notes: string | null;
  control_id: string;
  reviewer_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

type ControlRow = { id: string; code: string; title: string };

type ReviewerRow = { id: string; email: string; full_name: string | null };

async function getControlReviewById(reviewId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_reviews")
    .select(
      "id, status, target_date, completed_at, notes, control_id, reviewer_profile_id, created_at, updated_at",
    )
    .eq("id", reviewId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlReviewDetail>();

  return data;
}

async function getControl(controlId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select("id, code, title")
    .eq("id", controlId)
    .eq("organization_id", organizationId)
    .maybeSingle<ControlRow>();

  return data;
}

async function getReviewer(reviewerId: string | null, organizationId: string) {
  if (!reviewerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", reviewerId)
    .eq("organization_id", organizationId)
    .maybeSingle<ReviewerRow>();

  return data;
}

export default async function ControlReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;
  const review = await getControlReviewById(id, profile.organizationId);

  if (!review) {
    notFound();
  }

  const [control, reviewer, auditEntries] = await Promise.all([
    getControl(review.control_id, profile.organizationId),
    getReviewer(review.reviewer_profile_id, profile.organizationId),
    getAuditEntries("control_review", review.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control review</h1>
          <p className="mt-2 text-sm text-muted-foreground capitalize">{review.status}</p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/control-reviews/${review.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveControlReviewAction}>
                <input type="hidden" name="reviewId" value={review.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Control</p>
        <p className="mt-1 text-sm font-medium">
          {control ? `${control.code} - ${control.title}` : "Unknown control"}
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium capitalize">{review.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Target date</p>
          <p className="mt-1 text-sm font-medium">{review.target_date}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
          <p className="mt-1 text-sm font-medium">
            {review.completed_at ? new Date(review.completed_at).toLocaleString() : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reviewer</p>
          <p className="mt-1 text-sm font-medium">
            {reviewer
              ? reviewer.full_name
                ? `${reviewer.full_name} (${reviewer.email})`
                : reviewer.email
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(review.updated_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(review.created_at).toLocaleString()}</p>
        </div>
      </div>

      {review.notes ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="mt-2 whitespace-pre-line text-sm">{review.notes}</p>
        </div>
      ) : null}

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
