import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import {
  issueSeverityOptions,
  issueStatusOptions,
  issueTypeOptions,
  type IssueSeverity,
  type IssueStatus,
  type IssueType,
} from "@/lib/validators/issue";
import { cn } from "@/lib/utils/cn";

type Option = {
  id: string;
  label: string;
};

type IssueFormDefaults = {
  issueId?: string;
  title?: string;
  description?: string;
  issueType?: IssueType;
  severity?: IssueSeverity;
  status?: IssueStatus;
  ownerProfileId?: string | null;
  dueDate?: string | null;
  rootCause?: string | null;
  managementResponse?: string | null;
  resolutionNotes?: string | null;
  sourceFindingId?: string | null;
  sourceRiskAcceptanceId?: string | null;
  riskId?: string | null;
  controlId?: string | null;
  actionPlanId?: string | null;
  incidentId?: string | null;
  policyId?: string | null;
  thirdPartyId?: string | null;
  auditEngagementId?: string | null;
};

type IssueFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  ownerOptions: Option[];
  findingOptions: Option[];
  riskAcceptanceOptions: Option[];
  riskOptions: Option[];
  controlOptions: Option[];
  actionPlanOptions: Option[];
  incidentOptions: Option[];
  policyOptions: Option[];
  thirdPartyOptions: Option[];
  auditEngagementOptions: Option[];
  defaults?: IssueFormDefaults;
  error?: string | null;
};

const textAreaClassName =
  "min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

function formatIssueTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function IssueForm({
  mode,
  action,
  ownerOptions,
  findingOptions,
  riskAcceptanceOptions,
  riskOptions,
  controlOptions,
  actionPlanOptions,
  incidentOptions,
  policyOptions,
  thirdPartyOptions,
  auditEngagementOptions,
  defaults,
  error,
}: IssueFormProps) {
  return (
    <form
      action={action}
      aria-describedby={error ? "issue-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.issueId ? <input type="hidden" name="issueId" value={defaults.issueId} /> : null}

      {error ? <FeedbackAlert id="issue-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={180}
            defaultValue={defaults?.title ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
            maxLength={6000}
            defaultValue={defaults?.description ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="issueType" className="text-sm font-medium">
            Type
          </label>
          <select
            id="issueType"
            name="issueType"
            defaultValue={defaults?.issueType ?? "control_failure"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {issueTypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatIssueTypeLabel(option)}
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
            {issueSeverityOptions.map((option) => (
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
            defaultValue={defaults?.status ?? "open"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {issueStatusOptions.map((option) => (
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
            {ownerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="dueDate" className="text-sm font-medium">
            Due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaults?.dueDate ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="rootCause" className="text-sm font-medium">
            Root cause
          </label>
          <textarea
            id="rootCause"
            name="rootCause"
            maxLength={6000}
            defaultValue={defaults?.rootCause ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="managementResponse" className="text-sm font-medium">
            Management response
          </label>
          <textarea
            id="managementResponse"
            name="managementResponse"
            maxLength={6000}
            defaultValue={defaults?.managementResponse ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="resolutionNotes" className="text-sm font-medium">
            Resolution notes
          </label>
          <textarea
            id="resolutionNotes"
            name="resolutionNotes"
            maxLength={6000}
            defaultValue={defaults?.resolutionNotes ?? ""}
            className={cn(textAreaClassName)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sourceFindingId" className="text-sm font-medium">
            Source finding
          </label>
          <select
            id="sourceFindingId"
            name="sourceFindingId"
            defaultValue={defaults?.sourceFindingId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {findingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="sourceRiskAcceptanceId" className="text-sm font-medium">
            Source risk acceptance
          </label>
          <select
            id="sourceRiskAcceptanceId"
            name="sourceRiskAcceptanceId"
            defaultValue={defaults?.sourceRiskAcceptanceId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {riskAcceptanceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="riskId" className="text-sm font-medium">
            Risk
          </label>
          <select
            id="riskId"
            name="riskId"
            defaultValue={defaults?.riskId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {riskOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="controlId" className="text-sm font-medium">
            Control
          </label>
          <select
            id="controlId"
            name="controlId"
            defaultValue={defaults?.controlId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {controlOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="actionPlanId" className="text-sm font-medium">
            Action plan
          </label>
          <select
            id="actionPlanId"
            name="actionPlanId"
            defaultValue={defaults?.actionPlanId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {actionPlanOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="incidentId" className="text-sm font-medium">
            Incident
          </label>
          <select
            id="incidentId"
            name="incidentId"
            defaultValue={defaults?.incidentId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {incidentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="policyId" className="text-sm font-medium">
            Policy
          </label>
          <select
            id="policyId"
            name="policyId"
            defaultValue={defaults?.policyId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {policyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="thirdPartyId" className="text-sm font-medium">
            Third party
          </label>
          <select
            id="thirdPartyId"
            name="thirdPartyId"
            defaultValue={defaults?.thirdPartyId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {thirdPartyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="auditEngagementId" className="text-sm font-medium">
            Audit engagement
          </label>
          <select
            id="auditEngagementId"
            name="auditEngagementId"
            defaultValue={defaults?.auditEngagementId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">None</option>
            {auditEngagementOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create issue" : "Save changes"}
        </button>
        <Link href="/dashboard/issues" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
