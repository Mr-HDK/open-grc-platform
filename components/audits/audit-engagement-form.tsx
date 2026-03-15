import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import {
  auditEngagementStatusOptions,
  type AuditEngagementStatus,
} from "@/lib/validators/audit";
import { cn } from "@/lib/utils/cn";

type PlanItemOption = {
  id: string;
  label: string;
};

type ProfileOption = {
  id: string;
  label: string;
};

type FindingOption = {
  id: string;
  title: string;
  severity: string;
  status: string;
};

type ActionOption = {
  id: string;
  title: string;
  priority: string;
  status: string;
};

type AuditEngagementFormDefaults = {
  auditEngagementId?: string;
  title?: string;
  auditPlanItemId?: string;
  leadAuditorProfileId?: string;
  status?: AuditEngagementStatus;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  scope?: string;
  objectives?: string;
  summary?: string | null;
  selectedFindingIds?: string[];
  selectedActionPlanIds?: string[];
};

type AuditEngagementFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  planItems: PlanItemOption[];
  auditors: ProfileOption[];
  findingOptions: FindingOption[];
  actionOptions: ActionOption[];
  defaults?: AuditEngagementFormDefaults;
  error?: string | null;
};

const textareaClassName =
  "min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function AuditEngagementForm({
  mode,
  action,
  planItems,
  auditors,
  findingOptions,
  actionOptions,
  defaults,
  error,
}: AuditEngagementFormProps) {
  const selectedFindingIds = new Set(defaults?.selectedFindingIds ?? []);
  const selectedActionPlanIds = new Set(defaults?.selectedActionPlanIds ?? []);

  return (
    <form
      action={action}
      aria-describedby={error ? "audit-engagement-form-error" : undefined}
      className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      {defaults?.auditEngagementId ? (
        <input type="hidden" name="auditEngagementId" value={defaults.auditEngagementId} />
      ) : null}

      {error ? <FeedbackAlert id="audit-engagement-form-error" message={error} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Engagement title
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
          <label htmlFor="auditPlanItemId" className="text-sm font-medium">
            Plan item
          </label>
          <select
            id="auditPlanItemId"
            name="auditPlanItemId"
            required
            defaultValue={defaults?.auditPlanItemId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Select a plan item</option>
            {planItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="leadAuditorProfileId" className="text-sm font-medium">
            Lead auditor
          </label>
          <select
            id="leadAuditorProfileId"
            name="leadAuditorProfileId"
            required
            defaultValue={defaults?.leadAuditorProfileId ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Select a lead auditor</option>
            {auditors.map((auditor) => (
              <option key={auditor.id} value={auditor.id}>
                {auditor.label}
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
            defaultValue={defaults?.status ?? "planned"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {auditEngagementStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="plannedStartDate" className="text-sm font-medium">
            Planned start
          </label>
          <input
            id="plannedStartDate"
            name="plannedStartDate"
            type="date"
            required
            defaultValue={defaults?.plannedStartDate ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="plannedEndDate" className="text-sm font-medium">
            Planned end
          </label>
          <input
            id="plannedEndDate"
            name="plannedEndDate"
            type="date"
            required
            defaultValue={defaults?.plannedEndDate ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="actualStartDate" className="text-sm font-medium">
            Actual start
          </label>
          <input
            id="actualStartDate"
            name="actualStartDate"
            type="date"
            defaultValue={defaults?.actualStartDate ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="actualEndDate" className="text-sm font-medium">
            Actual end
          </label>
          <input
            id="actualEndDate"
            name="actualEndDate"
            type="date"
            defaultValue={defaults?.actualEndDate ?? ""}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="scope" className="text-sm font-medium">
            Scope
          </label>
          <textarea
            id="scope"
            name="scope"
            required
            maxLength={6000}
            defaultValue={defaults?.scope ?? ""}
            className={cn(textareaClassName)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="objectives" className="text-sm font-medium">
            Objectives
          </label>
          <textarea
            id="objectives"
            name="objectives"
            required
            maxLength={6000}
            defaultValue={defaults?.objectives ?? ""}
            className={cn(textareaClassName)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="summary" className="text-sm font-medium">
            Summary
          </label>
          <textarea
            id="summary"
            name="summary"
            maxLength={4000}
            defaultValue={defaults?.summary ?? ""}
            className={cn(textareaClassName)}
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Linked findings</legend>

        {findingOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {findingOptions.map((finding) => (
              <label key={finding.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="findingIds"
                  value={finding.id}
                  defaultChecked={selectedFindingIds.has(finding.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{finding.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {finding.severity} | {finding.status}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Linked remediation actions</legend>

        {actionOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action plans available yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {actionOptions.map((actionPlan) => (
              <label key={actionPlan.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  name="actionPlanIds"
                  value={actionPlan.id}
                  defaultChecked={selectedActionPlanIds.has(actionPlan.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{actionPlan.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {actionPlan.priority} | {actionPlan.status}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonVariants()}>
          {mode === "create" ? "Create engagement" : "Save changes"}
        </button>
        <Link href="/dashboard/audits" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
