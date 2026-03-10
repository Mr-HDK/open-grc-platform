import { notFound } from "next/navigation";

import { ControlReviewForm } from "@/components/control-reviews/control-review-form";

import { updateControlReviewAction } from "@/app/dashboard/control-reviews/actions";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isControlReviewStatus, type ControlReviewStatus } from "@/lib/validators/control-review";

type OptionRow = {
  id: string;
  code?: string;
  title?: string;
  email?: string;
  full_name?: string | null;
};

type ControlReviewRow = {
  id: string;
  control_id: string;
  status: ControlReviewStatus;
  target_date: string;
  reviewer_profile_id: string | null;
  notes: string | null;
};

async function getControlReview(reviewId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_reviews")
    .select("id, control_id, status, target_date, reviewer_profile_id, notes")
    .eq("id", reviewId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ControlReviewRow>();

  return data;
}

export default async function EditControlReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [{ data: review }, { data: controls }, { data: reviewers }] = await Promise.all([
    getControlReview(id, profile.organizationId),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<OptionRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OptionRow[]>(),
  ]);

  if (!review) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit control review</h1>
        <p className="text-sm text-muted-foreground">Update review status and notes.</p>
      </div>

      <ControlReviewForm
        mode="edit"
        action={updateControlReviewAction}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          label: `${control.code ?? "CTRL"} - ${control.title ?? control.id}`,
        }))}
        reviewerOptions={(reviewers ?? []).map((reviewer) => ({
          id: reviewer.id,
          label: reviewer.full_name ? `${reviewer.full_name} (${reviewer.email})` : (reviewer.email ?? reviewer.id),
        }))}
        defaults={{
          reviewId: review.id,
          controlId: review.control_id,
          status: isControlReviewStatus(review.status) ? review.status : "scheduled",
          targetDate: review.target_date,
          reviewerProfileId: review.reviewer_profile_id,
          notes: review.notes,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
