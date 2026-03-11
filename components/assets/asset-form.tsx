import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import {
  assetCriticalityOptions,
  assetStatusOptions,
  type AssetCriticality,
  type AssetStatus,
} from "@/lib/validators/asset";
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

type ControlOption = {
  id: string;
  code: string;
  title: string;
  effectivenessStatus: string;
};

type AssetFormDefaults = {
  assetId?: string;
  name?: string;
  assetType?: string;
  criticality?: AssetCriticality;
  status?: AssetStatus;
  ownerProfileId?: string | null;
  description?: string | null;
  selectedRiskIds?: string[];
  selectedControlIds?: string[];
};

type AssetFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  owners: OwnerOption[];
  riskOptions: RiskOption[];
  controlOptions: ControlOption[];
  defaults?: AssetFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function AssetForm({
  mode,
  action,
  owners,
  riskOptions,
  controlOptions,
  defaults,
  error,
}: AssetFormProps) {
  const selectedRiskIds = new Set(defaults?.selectedRiskIds ?? []);
  const selectedControlIds = new Set(defaults?.selectedControlIds ?? []);

  return (
    <form
      action={action}
      aria-describedby={error ? "asset-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.assetId ? <input type="hidden" name="assetId" value={defaults.assetId} /> : null}

      {error ? <FeedbackAlert id="asset-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <Input id="name" name="name" required maxLength={160} defaultValue={defaults?.name ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="assetType" className="text-sm font-medium">
            Type
          </label>
          <Input
            id="assetType"
            name="assetType"
            required
            maxLength={80}
            defaultValue={defaults?.assetType ?? "Application"}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="criticality" className="text-sm font-medium">
            Criticality
          </label>
          <select
            id="criticality"
            name="criticality"
            defaultValue={defaults?.criticality ?? "medium"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {assetCriticalityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
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
            defaultValue={defaults?.status ?? "active"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {assetStatusOptions.map((option) => (
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

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={4000}
            defaultValue={defaults?.description ?? ""}
            className={cn(textareaClassName)}
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

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Linked controls</legend>

        {controlOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No controls available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {controlOptions.map((control) => (
              <label key={control.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="controlIds"
                  value={control.id}
                  defaultChecked={selectedControlIds.has(control.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">
                    {control.code} - {control.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {control.effectivenessStatus}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create asset" : "Save changes"}
        </button>
        <Link href="/dashboard/assets" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
