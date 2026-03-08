import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  controlEffectivenessOptions,
  controlReviewFrequencyOptions,
  type ControlEffectivenessStatus,
  type ControlReviewFrequency,
} from "@/lib/validators/control";
import { cn } from "@/lib/utils/cn";

type OwnerOption = {
  id: string;
  label: string;
};

type RiskOption = {
  id: string;
  title: string;
  status: string;
  score: number;
};

type ControlFormDefaults = {
  controlId?: string;
  code?: string;
  title?: string;
  description?: string;
  controlType?: string;
  reviewFrequency?: ControlReviewFrequency;
  effectivenessStatus?: ControlEffectivenessStatus;
  ownerProfileId?: string | null;
  nextReviewDate?: string | null;
  selectedRiskIds?: string[];
};

type ControlFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  owners: OwnerOption[];
  riskOptions: RiskOption[];
  defaults?: ControlFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function ControlForm({
  mode,
  action,
  owners,
  riskOptions,
  defaults,
  error,
}: ControlFormProps) {
  const selectedRiskIds = new Set(defaults?.selectedRiskIds ?? []);

  return (
    <form action={action} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      {defaults?.controlId ? (
        <input type="hidden" name="controlId" value={defaults.controlId} />
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium">
            Code
          </label>
          <Input id="code" name="code" required maxLength={40} defaultValue={defaults?.code ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="controlType" className="text-sm font-medium">
            Control type
          </label>
          <Input
            id="controlType"
            name="controlType"
            required
            maxLength={50}
            defaultValue={defaults?.controlType ?? "Preventive"}
          />
        </div>

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
          <label htmlFor="reviewFrequency" className="text-sm font-medium">
            Review frequency
          </label>
          <select
            id="reviewFrequency"
            name="reviewFrequency"
            defaultValue={defaults?.reviewFrequency ?? "quarterly"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {controlReviewFrequencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="effectivenessStatus" className="text-sm font-medium">
            Effectiveness
          </label>
          <select
            id="effectivenessStatus"
            name="effectivenessStatus"
            defaultValue={defaults?.effectivenessStatus ?? "not_tested"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {controlEffectivenessOptions.map((option) => (
              <option key={option} value={option}>
                {option}
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
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="nextReviewDate" className="text-sm font-medium">
            Next review date
          </label>
          <Input
            id="nextReviewDate"
            name="nextReviewDate"
            type="date"
            defaultValue={defaults?.nextReviewDate ?? ""}
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Linked risks</legend>

        {riskOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No risks available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {riskOptions.map((risk) => (
              <label key={risk.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="riskIds"
                  value={risk.id}
                  defaultChecked={selectedRiskIds.has(risk.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{risk.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {risk.status} | score {risk.score}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create control" : "Save changes"}
        </button>
        <Link href="/dashboard/controls" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
