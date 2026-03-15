import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import {
  auditableEntityStatusOptions,
  auditableEntityTypeOptions,
  type AuditableEntityStatus,
  type AuditableEntityType,
} from "@/lib/validators/auditable-entity";
import { cn } from "@/lib/utils/cn";

type OwnerOption = {
  id: string;
  label: string;
};

type ParentOption = {
  id: string;
  name: string;
  entityType: string;
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

type AssetOption = {
  id: string;
  name: string;
  assetType: string;
  criticality: string;
};

type ThirdPartyOption = {
  id: string;
  name: string;
  service: string;
  assessmentStatus: string;
};

type AuditableEntityFormDefaults = {
  auditableEntityId?: string;
  name?: string;
  entityType?: AuditableEntityType;
  status?: AuditableEntityStatus;
  ownerProfileId?: string | null;
  parentEntityId?: string | null;
  description?: string | null;
  selectedRiskIds?: string[];
  selectedControlIds?: string[];
  selectedAssetIds?: string[];
  selectedThirdPartyIds?: string[];
};

type AuditableEntityFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  owners: OwnerOption[];
  parentOptions: ParentOption[];
  riskOptions: RiskOption[];
  controlOptions: ControlOption[];
  assetOptions: AssetOption[];
  thirdPartyOptions: ThirdPartyOption[];
  defaults?: AuditableEntityFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function AuditableEntityForm({
  mode,
  action,
  owners,
  parentOptions,
  riskOptions,
  controlOptions,
  assetOptions,
  thirdPartyOptions,
  defaults,
  error,
}: AuditableEntityFormProps) {
  const selectedRiskIds = new Set(defaults?.selectedRiskIds ?? []);
  const selectedControlIds = new Set(defaults?.selectedControlIds ?? []);
  const selectedAssetIds = new Set(defaults?.selectedAssetIds ?? []);
  const selectedThirdPartyIds = new Set(defaults?.selectedThirdPartyIds ?? []);

  return (
    <form
      action={action}
      aria-describedby={error ? "auditable-entity-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.auditableEntityId ? (
        <input type="hidden" name="auditableEntityId" value={defaults.auditableEntityId} />
      ) : null}

      {error ? <FeedbackAlert id="auditable-entity-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <Input id="name" name="name" required maxLength={180} defaultValue={defaults?.name ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="entityType" className="text-sm font-medium">
            Type
          </label>
          <select
            id="entityType"
            name="entityType"
            defaultValue={defaults?.entityType ?? "process"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm capitalize"
          >
            {auditableEntityTypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
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
            {auditableEntityStatusOptions.map((option) => (
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
          <label htmlFor="parentEntityId" className="text-sm font-medium">
            Parent entity
          </label>
          <select
            id="parentEntityId"
            name="parentEntityId"
            defaultValue={defaults?.parentEntityId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">No parent</option>
            {parentOptions.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name} ({formatLabel(parent.entityType)})
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

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Linked assets</legend>

        {assetOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {assetOptions.map((asset) => (
              <label key={asset.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="assetIds"
                  value={asset.id}
                  defaultChecked={selectedAssetIds.has(asset.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{asset.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {asset.assetType} | {asset.criticality}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Linked third parties</legend>

        {thirdPartyOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No third parties available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {thirdPartyOptions.map((thirdParty) => (
              <label key={thirdParty.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="thirdPartyIds"
                  value={thirdParty.id}
                  defaultChecked={selectedThirdPartyIds.has(thirdParty.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{thirdParty.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {thirdParty.service} | {thirdParty.assessmentStatus}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create entity" : "Save changes"}
        </button>
        <Link href="/dashboard/auditable-entities" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
