import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { assetCriticalityOptions, type AssetCriticality } from "@/lib/validators/asset";
import {
  thirdPartyAssessmentStatusOptions,
  thirdPartyInherentRiskOptions,
  thirdPartyOnboardingStatusOptions,
  thirdPartyTierOptions,
  type ThirdPartyAssessmentStatus,
  type ThirdPartyInherentRisk,
  type ThirdPartyOnboardingStatus,
  type ThirdPartyTier,
} from "@/lib/validators/third-party";
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

type ActionOption = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

type ThirdPartyFormDefaults = {
  thirdPartyId?: string;
  name?: string;
  service?: string;
  criticality?: AssetCriticality;
  tier?: ThirdPartyTier;
  inherentRisk?: ThirdPartyInherentRisk;
  onboardingStatus?: ThirdPartyOnboardingStatus;
  assessmentStatus?: ThirdPartyAssessmentStatus;
  assessmentScore?: number;
  nextReviewDate?: string | null;
  renewalDate?: string | null;
  reassessmentIntervalDays?: number;
  ownerProfileId?: string | null;
  contractOwnerProfileId?: string | null;
  notes?: string | null;
  selectedRiskIds?: string[];
  selectedControlIds?: string[];
  selectedActionIds?: string[];
};

type ThirdPartyFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  owners: OwnerOption[];
  riskOptions: RiskOption[];
  controlOptions: ControlOption[];
  actionOptions: ActionOption[];
  defaults?: ThirdPartyFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function ThirdPartyForm({
  mode,
  action,
  owners,
  riskOptions,
  controlOptions,
  actionOptions,
  defaults,
  error,
}: ThirdPartyFormProps) {
  const selectedRiskIds = new Set(defaults?.selectedRiskIds ?? []);
  const selectedControlIds = new Set(defaults?.selectedControlIds ?? []);
  const selectedActionIds = new Set(defaults?.selectedActionIds ?? []);

  return (
    <form
      action={action}
      aria-describedby={error ? "third-party-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.thirdPartyId ? (
        <input type="hidden" name="thirdPartyId" value={defaults.thirdPartyId} />
      ) : null}

      {error ? <FeedbackAlert id="third-party-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Vendor
          </label>
          <Input id="name" name="name" required maxLength={180} defaultValue={defaults?.name ?? ""} />
        </div>

        <div className="space-y-2">
          <label htmlFor="service" className="text-sm font-medium">
            Service
          </label>
          <Input
            id="service"
            name="service"
            required
            maxLength={180}
            defaultValue={defaults?.service ?? ""}
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
          <label htmlFor="tier" className="text-sm font-medium">
            Tier
          </label>
          <select
            id="tier"
            name="tier"
            defaultValue={defaults?.tier ?? "tier_2"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {thirdPartyTierOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="inherentRisk" className="text-sm font-medium">
            Inherent risk
          </label>
          <select
            id="inherentRisk"
            name="inherentRisk"
            defaultValue={defaults?.inherentRisk ?? "medium"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {thirdPartyInherentRiskOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="onboardingStatus" className="text-sm font-medium">
            Onboarding status
          </label>
          <select
            id="onboardingStatus"
            name="onboardingStatus"
            defaultValue={defaults?.onboardingStatus ?? "in_progress"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {thirdPartyOnboardingStatusOptions.map((option) => (
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
          <label htmlFor="contractOwnerProfileId" className="text-sm font-medium">
            Contract owner
          </label>
          <select
            id="contractOwnerProfileId"
            name="contractOwnerProfileId"
            defaultValue={defaults?.contractOwnerProfileId ?? ""}
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
          <label htmlFor="assessmentStatus" className="text-sm font-medium">
            Review status
          </label>
          <select
            id="assessmentStatus"
            name="assessmentStatus"
            defaultValue={defaults?.assessmentStatus ?? "monitoring"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {thirdPartyAssessmentStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="assessmentScore" className="text-sm font-medium">
            Review score (0-100)
          </label>
          <Input
            id="assessmentScore"
            name="assessmentScore"
            type="number"
            min={0}
            max={100}
            defaultValue={defaults?.assessmentScore ?? 50}
          />
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

        <div className="space-y-2">
          <label htmlFor="renewalDate" className="text-sm font-medium">
            Renewal date
          </label>
          <Input
            id="renewalDate"
            name="renewalDate"
            type="date"
            defaultValue={defaults?.renewalDate ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="reassessmentIntervalDays" className="text-sm font-medium">
            Reassessment interval (days)
          </label>
          <Input
            id="reassessmentIntervalDays"
            name="reassessmentIntervalDays"
            type="number"
            min={7}
            max={730}
            defaultValue={defaults?.reassessmentIntervalDays ?? 90}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            maxLength={4000}
            defaultValue={defaults?.notes ?? ""}
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
        <legend className="px-1 text-sm font-medium">Linked action plans</legend>

        {actionOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action plans available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {actionOptions.map((actionItem) => (
              <label key={actionItem.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="actionPlanIds"
                  value={actionItem.id}
                  defaultChecked={selectedActionIds.has(actionItem.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{actionItem.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {actionItem.status} | {actionItem.priority}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create third-party" : "Save changes"}
        </button>
        <Link href="/dashboard/third-parties" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
