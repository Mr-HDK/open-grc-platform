import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import {
  auditPlanCycleOptions,
  auditPlanStatusOptions,
  type AuditPlanCycle,
  type AuditPlanStatus,
} from "@/lib/validators/audit";
import { cn } from "@/lib/utils/cn";

type OwnerOption = {
  id: string;
  label: string;
};

type AuditPlanFormDefaults = {
  auditPlanId?: string;
  title?: string;
  planYear?: number;
  cycle?: AuditPlanCycle;
  status?: AuditPlanStatus;
  ownerProfileId?: string | null;
  summary?: string | null;
};

type AuditPlanFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  owners: OwnerOption[];
  defaults?: AuditPlanFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

function formatCycleLabel(value: string) {
  return value === "semiannual" ? "Semiannual" : "Annual";
}

export function AuditPlanForm({ mode, action, owners, defaults, error }: AuditPlanFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "audit-plan-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.auditPlanId ? <input type="hidden" name="auditPlanId" value={defaults.auditPlanId} /> : null}

      {error ? <FeedbackAlert id="audit-plan-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Plan title
          </label>
          <Input id="title" name="title" required maxLength={180} defaultValue={defaults?.title ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="planYear" className="text-sm font-medium">
            Plan year
          </label>
          <Input
            id="planYear"
            name="planYear"
            type="number"
            min={2000}
            max={2100}
            required
            defaultValue={defaults?.planYear ?? new Date().getFullYear()}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="cycle" className="text-sm font-medium">
            Cycle
          </label>
          <select
            id="cycle"
            name="cycle"
            defaultValue={defaults?.cycle ?? "annual"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {auditPlanCycleOptions.map((option) => (
              <option key={option} value={option}>
                {formatCycleLabel(option)}
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
            defaultValue={defaults?.status ?? "draft"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {auditPlanStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="ownerProfileId" className="text-sm font-medium">
            Plan owner
          </label>
          <select
            id="ownerProfileId"
            name="ownerProfileId"
            defaultValue={defaults?.ownerProfileId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="summary" className="text-sm font-medium">
            Summary
          </label>
          <textarea
            id="summary"
            name="summary"
            maxLength={4000}
            defaultValue={defaults?.summary ?? ""}
            className={cn(textareaClassName)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create plan" : "Save changes"}
        </button>
        <Link href="/dashboard/audits" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
