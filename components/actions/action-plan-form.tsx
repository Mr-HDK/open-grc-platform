import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actionPriorityOptions,
  actionStatusOptions,
  type ActionPriority,
  type ActionStatus,
} from "@/lib/validators/action-plan";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type ActionPlanFormDefaults = {
  actionPlanId?: string;
  title?: string;
  description?: string;
  riskId?: string | null;
  controlId?: string | null;
  ownerProfileId?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  targetDate?: string;
};

type ActionPlanFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  riskOptions: Option[];
  controlOptions: Option[];
  ownerOptions: Option[];
  defaults?: ActionPlanFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function ActionPlanForm({
  mode,
  action,
  riskOptions,
  controlOptions,
  ownerOptions,
  defaults,
  error,
}: ActionPlanFormProps) {
  return (
    <form action={action} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      {defaults?.actionPlanId ? (
        <input type="hidden" name="actionPlanId" value={defaults.actionPlanId} />
      ) : null}

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
          <Input
            id="title"
            name="title"
            required
            maxLength={180}
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
            className={cn(textareaClassName)}
          />
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
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "open"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {actionStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="priority" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={defaults?.priority ?? "medium"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {actionPriorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        An action plan must be linked to at least one risk or one control.
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create action plan" : "Save changes"}
        </button>
        <Link href="/dashboard/actions" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
