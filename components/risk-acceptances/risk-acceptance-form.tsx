import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type RiskAcceptanceFormDefaults = {
  riskAcceptanceId?: string;
  riskId?: string;
  controlId?: string | null;
  actionPlanId?: string | null;
  approvedByProfileId?: string;
  justification?: string;
  expirationDate?: string;
};

type RiskAcceptanceFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  riskOptions: Option[];
  controlOptions: Option[];
  actionPlanOptions: Option[];
  approverOptions: Option[];
  defaults?: RiskAcceptanceFormDefaults;
  error?: string | null;
};

const textAreaClassName =
  "min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function RiskAcceptanceForm({
  mode,
  action,
  riskOptions,
  controlOptions,
  actionPlanOptions,
  approverOptions,
  defaults,
  error,
}: RiskAcceptanceFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "risk-acceptance-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.riskAcceptanceId ? (
        <input type="hidden" name="riskAcceptanceId" value={defaults.riskAcceptanceId} />
      ) : null}

      {error ? <FeedbackAlert id="risk-acceptance-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="riskId" className="text-sm font-medium">
            Risk
          </label>
          <select
            id="riskId"
            name="riskId"
            required
            defaultValue={defaults?.riskId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Select risk
            </option>
            {riskOptions.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="controlId" className="text-sm font-medium">
            Related control (optional)
          </label>
          <select
            id="controlId"
            name="controlId"
            defaultValue={defaults?.controlId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {controlOptions.map((control) => (
              <option key={control.id} value={control.id}>
                {control.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="actionPlanId" className="text-sm font-medium">
            Related action plan (optional)
          </label>
          <select
            id="actionPlanId"
            name="actionPlanId"
            defaultValue={defaults?.actionPlanId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {actionPlanOptions.map((actionPlan) => (
              <option key={actionPlan.id} value={actionPlan.id}>
                {actionPlan.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="approvedByProfileId" className="text-sm font-medium">
            Approver
          </label>
          <select
            id="approvedByProfileId"
            name="approvedByProfileId"
            required
            defaultValue={defaults?.approvedByProfileId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Select approver
            </option>
            {approverOptions.map((approver) => (
              <option key={approver.id} value={approver.id}>
                {approver.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="expirationDate" className="text-sm font-medium">
            Expiration date
          </label>
          <Input
            id="expirationDate"
            name="expirationDate"
            type="date"
            required
            defaultValue={defaults?.expirationDate ?? ""}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="justification" className="text-sm font-medium">
            Justification
          </label>
          <textarea
            id="justification"
            name="justification"
            required
            maxLength={5000}
            defaultValue={defaults?.justification ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create acceptance" : "Save changes"}
        </button>
        <Link href="/dashboard/risk-acceptances" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
