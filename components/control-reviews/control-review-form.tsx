import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import {
  controlReviewStatusOptions,
  type ControlReviewStatus,
} from "@/lib/validators/control-review";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type ControlReviewDefaults = {
  reviewId?: string;
  controlId?: string;
  status?: ControlReviewStatus;
  targetDate?: string;
  reviewerProfileId?: string | null;
  notes?: string | null;
};

type ControlReviewFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  controlOptions: Option[];
  reviewerOptions: Option[];
  defaults?: ControlReviewDefaults;
  error?: string | null;
};

const textAreaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function ControlReviewForm({
  mode,
  action,
  controlOptions,
  reviewerOptions,
  defaults,
  error,
}: ControlReviewFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "control-review-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.reviewId ? (
        <input type="hidden" name="reviewId" value={defaults.reviewId} />
      ) : null}

      {error ? <FeedbackAlert id="control-review-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="controlId" className="text-sm font-medium">
            Control
          </label>
          <select
            id="controlId"
            name="controlId"
            required
            defaultValue={defaults?.controlId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Select control
            </option>
            {controlOptions.map((control) => (
              <option key={control.id} value={control.id}>
                {control.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "scheduled"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {controlReviewStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="targetDate" className="text-sm font-medium">
            Target date
          </label>
          <Input
            id="targetDate"
            name="targetDate"
            type="date"
            required
            defaultValue={defaults?.targetDate ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="reviewerProfileId" className="text-sm font-medium">
            Reviewer
          </label>
          <select
            id="reviewerProfileId"
            name="reviewerProfileId"
            defaultValue={defaults?.reviewerProfileId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {reviewerOptions.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            maxLength={2000}
            defaultValue={defaults?.notes ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create review" : "Save changes"}
        </button>
        <Link href="/dashboard/control-reviews" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
