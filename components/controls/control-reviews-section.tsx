import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type ControlReviewItem = {
  id: string;
  status: string;
  targetDate: string;
  completedAt: string | null;
};

type ControlReviewsSectionProps = {
  reviews: ControlReviewItem[];
  controlId: string;
  canEdit: boolean;
};

export function ControlReviewsSection({
  reviews,
  controlId,
  canEdit,
}: ControlReviewsSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Control reviews</h2>
        {canEdit ? (
          <Link
            href={`/dashboard/control-reviews/new?controlId=${controlId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Schedule review
          </Link>
        ) : null}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No reviews scheduled yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border p-3">
              <Link
                href={`/dashboard/control-reviews/${review.id}`}
                className="text-sm font-medium hover:underline"
              >
                {review.status} review
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                target {review.targetDate} |{" "}
                {review.completedAt
                  ? `completed ${new Date(review.completedAt).toLocaleDateString()}`
                  : "pending"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
