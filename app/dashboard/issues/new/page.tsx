import { z } from "zod";

import { createIssueAction } from "@/app/dashboard/issues/actions";
import { IssueForm } from "@/components/issues/issue-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { getIssueFormOptions } from "@/lib/issues/options";
import { type IssueType } from "@/lib/validators/issue";

const uuidSchema = z.string().uuid();

function asUuid(value: string | undefined) {
  return uuidSchema.safeParse(value).success ? (value ?? "") : "";
}

function deriveIssueType(params: {
  findingId: string;
  riskAcceptanceId: string;
  incidentId: string;
  policyId: string;
  thirdPartyId: string;
  controlId: string;
}): IssueType {
  if (params.findingId) {
    return "audit_finding";
  }

  if (params.riskAcceptanceId) {
    return "risk_exception";
  }

  if (params.incidentId) {
    return "incident_follow_up";
  }

  if (params.policyId) {
    return "policy_exception";
  }

  if (params.thirdPartyId) {
    return "vendor_issue";
  }

  if (params.controlId) {
    return "control_failure";
  }

  return "control_failure";
}

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    findingId?: string;
    riskAcceptanceId?: string;
    riskId?: string;
    controlId?: string;
    actionPlanId?: string;
    incidentId?: string;
    policyId?: string;
    thirdPartyId?: string;
    auditEngagementId?: string;
  }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;

  const defaults = {
    findingId: asUuid(params.findingId),
    riskAcceptanceId: asUuid(params.riskAcceptanceId),
    riskId: asUuid(params.riskId),
    controlId: asUuid(params.controlId),
    actionPlanId: asUuid(params.actionPlanId),
    incidentId: asUuid(params.incidentId),
    policyId: asUuid(params.policyId),
    thirdPartyId: asUuid(params.thirdPartyId),
    auditEngagementId: asUuid(params.auditEngagementId),
  };

  const options = await getIssueFormOptions(profile.organizationId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New issue</h1>
        <p className="text-sm text-muted-foreground">
          Create a unified issue record for exceptions, findings, and remediation follow-up.
        </p>
      </div>

      <IssueForm
        mode="create"
        action={createIssueAction}
        ownerOptions={options.ownerOptions}
        findingOptions={options.findingOptions}
        riskAcceptanceOptions={options.riskAcceptanceOptions}
        riskOptions={options.riskOptions}
        controlOptions={options.controlOptions}
        actionPlanOptions={options.actionPlanOptions}
        incidentOptions={options.incidentOptions}
        policyOptions={options.policyOptions}
        thirdPartyOptions={options.thirdPartyOptions}
        auditEngagementOptions={options.auditEngagementOptions}
        defaults={{
          issueType: deriveIssueType({
            findingId: defaults.findingId,
            riskAcceptanceId: defaults.riskAcceptanceId,
            incidentId: defaults.incidentId,
            policyId: defaults.policyId,
            thirdPartyId: defaults.thirdPartyId,
            controlId: defaults.controlId,
          }),
          severity: "medium",
          status: "open",
          ownerProfileId: profile.id,
          sourceFindingId: defaults.findingId || null,
          sourceRiskAcceptanceId: defaults.riskAcceptanceId || null,
          riskId: defaults.riskId || null,
          controlId: defaults.controlId || null,
          actionPlanId: defaults.actionPlanId || null,
          incidentId: defaults.incidentId || null,
          policyId: defaults.policyId || null,
          thirdPartyId: defaults.thirdPartyId || null,
          auditEngagementId: defaults.auditEngagementId || null,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
