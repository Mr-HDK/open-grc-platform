import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = {
  id: string;
  label: string;
};

type EvidenceFormProps = {
  action: (formData: FormData) => Promise<void>;
  riskOptions: Option[];
  controlOptions: Option[];
  actionPlanOptions: Option[];
  defaults?: {
    riskId?: string | null;
    controlId?: string | null;
    actionPlanId?: string | null;
  };
  error?: string | null;
};

export function EvidenceForm({
  action,
  riskOptions,
  controlOptions,
  actionPlanOptions,
  defaults,
  error,
}: EvidenceFormProps) {
  return (
    <form action={action} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input id="title" name="title" required maxLength={180} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={5000}
            className="min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="file" className="text-sm font-medium">
            File
          </label>
          <Input id="file" name="file" type="file" required />
          <p className="text-xs text-muted-foreground">Max 25 MB.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="riskId" className="text-sm font-medium">
            Linked risk
          </label>
          <select
            id="riskId"
            name="riskId"
            defaultValue={defaults?.riskId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">No risk</option>
            {riskOptions.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="controlId" className="text-sm font-medium">
            Linked control
          </label>
          <select
            id="controlId"
            name="controlId"
            defaultValue={defaults?.controlId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">No control</option>
            {controlOptions.map((control) => (
              <option key={control.id} value={control.id}>
                {control.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="actionPlanId" className="text-sm font-medium">
            Linked action plan
          </label>
          <select
            id="actionPlanId"
            name="actionPlanId"
            defaultValue={defaults?.actionPlanId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">No action plan</option>
            {actionPlanOptions.map((actionPlan) => (
              <option key={actionPlan.id} value={actionPlan.id}>
                {actionPlan.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Evidence must be linked to at least one target (risk, control, or action plan).
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          Upload evidence
        </button>
        <Link href="/dashboard/evidence" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
