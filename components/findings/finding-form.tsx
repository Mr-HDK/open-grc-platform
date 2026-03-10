import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import {
  findingSeverityOptions,
  findingStatusOptions,
  type FindingSeverity,
  type FindingStatus,
} from "@/lib/validators/finding";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type FindingFormDefaults = {
  findingId?: string;
  controlId?: string;
  sourceControlTestId?: string | null;
  title?: string;
  description?: string;
  status?: FindingStatus;
  severity?: FindingSeverity;
  rootCause?: string | null;
  remediationPlan?: string | null;
  dueDate?: string | null;
  ownerProfileId?: string | null;
};

type FindingFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  controlOptions: Option[];
  sourceControlTestOptions: Option[];
  ownerOptions: Option[];
  defaults?: FindingFormDefaults;
  error?: string | null;
};

const textAreaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function FindingForm({
  mode,
  action,
  controlOptions,
  sourceControlTestOptions,
  ownerOptions,
  defaults,
  error,
}: FindingFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "finding-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.findingId ? <input type="hidden" name="findingId" value={defaults.findingId} /> : null}

      {error ? <FeedbackAlert id="finding-form-error" message={error} /> : null}

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

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="sourceControlTestId" className="text-sm font-medium">
            Source control test
          </label>
          <select
            id="sourceControlTestId"
            name="sourceControlTestId"
            defaultValue={defaults?.sourceControlTestId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {sourceControlTestOptions.map((test) => (
              <option key={test.id} value={test.id}>
                {test.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input id="title" name="title" required maxLength={180} defaultValue={defaults?.title ?? ""} />
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
            className={cn(textAreaClassName)}
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
            {findingStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="severity" className="text-sm font-medium">
            Severity
          </label>
          <select
            id="severity"
            name="severity"
            defaultValue={defaults?.severity ?? "medium"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {findingSeverityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
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
          <label htmlFor="dueDate" className="text-sm font-medium">
            Due date
          </label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={defaults?.dueDate ?? ""} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="rootCause" className="text-sm font-medium">
            Root cause
          </label>
          <textarea
            id="rootCause"
            name="rootCause"
            maxLength={4000}
            defaultValue={defaults?.rootCause ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="remediationPlan" className="text-sm font-medium">
            Remediation plan
          </label>
          <textarea
            id="remediationPlan"
            name="remediationPlan"
            maxLength={4000}
            defaultValue={defaults?.remediationPlan ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create finding" : "Save changes"}
        </button>
        <Link href="/dashboard/findings" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
