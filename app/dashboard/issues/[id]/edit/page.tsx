import { notFound } from "next/navigation";

import { updateIssueAction } from "@/app/dashboard/issues/actions";
import { IssueForm } from "@/components/issues/issue-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { getIssueFormOptions } from "@/lib/issues/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isIssueSeverity, isIssueStatus, isIssueType } from "@/lib/validators/issue";

type IssueRow = {
  id: string;
  title: string;
  description: string;
  issue_type: string;
  severity: string;
  status: string;
  owner_profile_id: string | null;
  due_date: string | null;
  root_cause: string | null;
  management_response: string | null;
  resolution_notes: string | null;
  source_finding_id: string | null;
  source_risk_acceptance_id: string | null;
  risk_id: string | null;
  control_id: string | null;
  action_plan_id: string | null;
  incident_id: string | null;
  policy_id: string | null;
  third_party_id: string | null;
  audit_engagement_id: string | null;
};

async function getIssue(issueId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("issues")
    .select(
      "id, title, description, issue_type, severity, status, owner_profile_id, due_date, root_cause, management_response, resolution_notes, source_finding_id, source_risk_acceptance_id, risk_id, control_id, action_plan_id, incident_id, policy_id, third_party_id, audit_engagement_id",
    )
    .eq("id", issueId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<IssueRow>();

  return data;
}

export default async function EditIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const { id } = await params;
  const query = await searchParams;
  const issue = await getIssue(id, profile.organizationId);

  if (!issue) {
    notFound();
  }

  const options = await getIssueFormOptions(profile.organizationId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit issue</h1>
        <p className="text-sm text-muted-foreground">
          Update status, ownership, remediation, and contextual links.
        </p>
      </div>

      <IssueForm
        mode="edit"
        action={updateIssueAction}
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
          issueId: issue.id,
          title: issue.title,
          description: issue.description,
          issueType: isIssueType(issue.issue_type) ? issue.issue_type : "control_failure",
          severity: isIssueSeverity(issue.severity) ? issue.severity : "medium",
          status: isIssueStatus(issue.status) ? issue.status : "open",
          ownerProfileId: issue.owner_profile_id,
          dueDate: issue.due_date,
          rootCause: issue.root_cause,
          managementResponse: issue.management_response,
          resolutionNotes: issue.resolution_notes,
          sourceFindingId: issue.source_finding_id,
          sourceRiskAcceptanceId: issue.source_risk_acceptance_id,
          riskId: issue.risk_id,
          controlId: issue.control_id,
          actionPlanId: issue.action_plan_id,
          incidentId: issue.incident_id,
          policyId: issue.policy_id,
          thirdPartyId: issue.third_party_id,
          auditEngagementId: issue.audit_engagement_id,
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
