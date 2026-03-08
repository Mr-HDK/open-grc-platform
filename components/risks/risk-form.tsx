import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { riskStatusOptions, type RiskStatus } from "@/lib/scoring/risk";

type OwnerOption = {
  id: string;
  label: string;
};

type RiskFormDefaults = {
  riskId?: string;
  title?: string;
  description?: string;
  category?: string;
  ownerProfileId?: string | null;
  impact?: number;
  likelihood?: number;
  status?: RiskStatus;
  dueDate?: string | null;
};

type RiskFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  ownerOptions: OwnerOption[];
  defaults?: RiskFormDefaults;
  error?: string | null;
};

const inputClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function RiskForm({ mode, action, ownerOptions, defaults, error }: RiskFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "risk-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.riskId ? <input type="hidden" name="riskId" value={defaults.riskId} /> : null}

      {error ? <FeedbackAlert id="risk-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="title"
            name="title"
            required
            maxLength={140}
            defaultValue={defaults?.title ?? ""}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            required
            maxLength={5000}
            defaultValue={defaults?.description ?? ""}
            className={cn(inputClassName)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <Input
            id="category"
            name="category"
            required
            maxLength={80}
            defaultValue={defaults?.category ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "draft"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {riskStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
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

        <div className="space-y-2">
          <label htmlFor="impact" className="text-sm font-medium">
            Impact (1-5)
          </label>
          <Input
            id="impact"
            name="impact"
            type="number"
            min={1}
            max={5}
            required
            defaultValue={defaults?.impact ?? 3}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="likelihood" className="text-sm font-medium">
            Likelihood (1-5)
          </label>
          <Input
            id="likelihood"
            name="likelihood"
            type="number"
            min={1}
            max={5}
            required
            defaultValue={defaults?.likelihood ?? 3}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="dueDate" className="text-sm font-medium">
            Due date
          </label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaults?.dueDate ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create risk" : "Save changes"}
        </button>
        <Link href="/dashboard/risks" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
