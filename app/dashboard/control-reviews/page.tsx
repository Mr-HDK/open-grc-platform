import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  controlReviewStatusOptions,
  isControlReviewStatus,
  type ControlReviewStatus,
} from "@/lib/validators/control-review";
import { cn } from "@/lib/utils/cn";

type ControlReviewRow = {
  id: string;
  status: ControlReviewStatus;
  target_date: string;
  completed_at: string | null;
  updated_at: string;
  controls: {
    id: string;
    code: string;
    title: string;
  } | null;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
};

type ControlRow = { id: string; code: string; title: string };

export default async function ControlReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; controlId?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  const status = isControlReviewStatus(params.status) ? params.status : "";
  const controlId = params.controlId?.trim() ?? "";

  let query = supabase
    .from("control_reviews")
    .select("id, status, target_date, completed_at, updated_at, controls(id, code, title), profiles(email, full_name)")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("target_date", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  if (controlId) {
    query = query.eq("control_id", controlId);
  }

  const [{ data: reviews, error }, { data: controls }] = await Promise.all([
    query.returns<ControlReviewRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control reviews</h1>
          <p className="text-sm text-muted-foreground">
            Track scheduled control reviews and their completion status.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/control-reviews/new" className={buttonVariants()}>
            New review
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {controlReviewStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="controlId"
          aria-label="Filter by control"
          defaultValue={controlId}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All controls</option>
          {(controls ?? []).map((control) => (
            <option key={control.id} value={control.id}>
              {control.code} - {control.title}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Control review results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Control
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Target date
              </th>
              <th scope="col" className="px-4 py-3">
                Completed
              </th>
              <th scope="col" className="px-4 py-3">
                Reviewer
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(reviews ?? []).map((review) => (
              <tr key={review.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/control-reviews/${review.id}`}
                    className="font-medium hover:underline"
                  >
                    {review.controls ? `${review.controls.code} - ${review.controls.title}` : "Unknown control"}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{review.status}</td>
                <td className="px-4 py-3 text-muted-foreground">{review.target_date}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {review.completed_at ? new Date(review.completed_at).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {review.profiles
                    ? review.profiles.full_name
                      ? `${review.profiles.full_name} (${review.profiles.email})`
                      : review.profiles.email
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(review.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (reviews?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No control reviews found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
