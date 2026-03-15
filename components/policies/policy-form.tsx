import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type OwnerOption = {
  id: string;
  label: string;
};

type PolicyFormDefaults = {
  policyId?: string;
  title?: string;
  version?: string;
  effectiveDate?: string;
  nextReviewDate?: string;
  ownerProfileId?: string | null;
  content?: string | null;
};

type PolicyFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  ownerOptions: OwnerOption[];
  defaults?: PolicyFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[180px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function PolicyForm({ mode, action, ownerOptions, defaults, error }: PolicyFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "policy-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.policyId ? <input type="hidden" name="policyId" value={defaults.policyId} /> : null}

      {error ? <FeedbackAlert id="policy-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input id="title" name="title" required maxLength={180} defaultValue={defaults?.title ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="version" className="text-sm font-medium">
            Version
          </label>
          <Input id="version" name="version" required maxLength={40} defaultValue={defaults?.version ?? "1.0"} />
        </div>

        <div className="space-y-2">
          <label htmlFor="effectiveDate" className="text-sm font-medium">
            Effective date
          </label>
          <Input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            required
            defaultValue={defaults?.effectiveDate ?? new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="nextReviewDate" className="text-sm font-medium">
            Next review date
          </label>
          <Input
            id="nextReviewDate"
            name="nextReviewDate"
            type="date"
            required
            defaultValue={defaults?.nextReviewDate ?? new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="ownerProfileId" className="text-sm font-medium">
            Owner
          </label>
          <select
            id="ownerProfileId"
            name="ownerProfileId"
            defaultValue={defaults?.ownerProfileId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="content" className="text-sm font-medium">
            Content
          </label>
          <textarea
            id="content"
            name="content"
            maxLength={12000}
            defaultValue={defaults?.content ?? ""}
            className={cn(textareaClassName)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create policy" : "Save changes"}
        </button>
        <Link href="/dashboard/policies" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
