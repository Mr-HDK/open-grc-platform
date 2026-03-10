import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { incidentStatusOptions, type IncidentStatus } from "@/lib/validators/incident";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type IncidentFormDefaults = {
  incidentId?: string;
  title?: string;
  description?: string;
  status?: IncidentStatus;
  occurredDate?: string | null;
  riskId?: string | null;
  actionPlanId?: string | null;
  ownerProfileId?: string | null;
};

type IncidentFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  riskOptions: Option[];
  actionOptions: Option[];
  ownerOptions: Option[];
  defaults?: IncidentFormDefaults;
  error?: string | null;
};

const inputClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function IncidentForm({
  mode,
  action,
  riskOptions,
  actionOptions,
  ownerOptions,
  defaults,
  error,
}: IncidentFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "incident-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.incidentId ? <input type="hidden" name="incidentId" value={defaults.incidentId} /> : null}

      {error ? <FeedbackAlert id="incident-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input id="title" name="title" required maxLength={140} defaultValue={defaults?.title ?? ""} />
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
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "open"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {incidentStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="occurredDate" className="text-sm font-medium">
            Occurred on
          </label>
          <Input
            id="occurredDate"
            name="occurredDate"
            type="date"
            defaultValue={defaults?.occurredDate ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="riskId" className="text-sm font-medium">
            Related risk
          </label>
          <select
            id="riskId"
            name="riskId"
            defaultValue={defaults?.riskId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {riskOptions.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="actionPlanId" className="text-sm font-medium">
            Related action plan
          </label>
          <select
            id="actionPlanId"
            name="actionPlanId"
            defaultValue={defaults?.actionPlanId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {actionOptions.map((actionPlan) => (
              <option key={actionPlan.id} value={actionPlan.id}>
                {actionPlan.label}
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
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create incident" : "Save changes"}
        </button>
        <Link href="/dashboard/incidents" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
