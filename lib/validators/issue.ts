import { z } from "zod";

export const issueTypeOptions = [
  "audit_finding",
  "control_failure",
  "policy_exception",
  "vendor_issue",
  "risk_exception",
  "incident_follow_up",
] as const;

export const issueSeverityOptions = ["low", "medium", "high", "critical"] as const;
export const issueStatusOptions = ["open", "in_progress", "blocked", "resolved", "closed"] as const;

export type IssueType = (typeof issueTypeOptions)[number];
export type IssueSeverity = (typeof issueSeverityOptions)[number];
export type IssueStatus = (typeof issueStatusOptions)[number];

const optionalUuidField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Identifier must be a valid UUID.",
  });

const optionalDateField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must use YYYY-MM-DD format.",
  });

const optionalTextField = (maxLength: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || value.length <= maxLength, {
      message: `${label} must be under ${maxLength} characters.`,
    });

export const issueFormSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(10).max(6000),
    issueType: z.enum(issueTypeOptions),
    severity: z.enum(issueSeverityOptions),
    status: z.enum(issueStatusOptions),
    ownerProfileId: optionalUuidField,
    dueDate: optionalDateField,
    rootCause: optionalTextField(6000, "Root cause"),
    managementResponse: optionalTextField(6000, "Management response"),
    resolutionNotes: optionalTextField(6000, "Resolution notes"),
    sourceFindingId: optionalUuidField,
    sourceRiskAcceptanceId: optionalUuidField,
    riskId: optionalUuidField,
    controlId: optionalUuidField,
    actionPlanId: optionalUuidField,
    incidentId: optionalUuidField,
    policyId: optionalUuidField,
    thirdPartyId: optionalUuidField,
    auditEngagementId: optionalUuidField,
  })
  .refine(
    (value) =>
      !["resolved", "closed"].includes(value.status) ||
      (value.resolutionNotes !== null && value.resolutionNotes.length >= 3),
    {
      message: "Resolution notes are required when status is resolved or closed.",
      path: ["resolutionNotes"],
    },
  );

export const issueIdSchema = z.string().uuid();

export function isIssueType(value: string | null | undefined): value is IssueType {
  return Boolean(value && issueTypeOptions.includes(value as IssueType));
}

export function isIssueSeverity(value: string | null | undefined): value is IssueSeverity {
  return Boolean(value && issueSeverityOptions.includes(value as IssueSeverity));
}

export function isIssueStatus(value: string | null | undefined): value is IssueStatus {
  return Boolean(value && issueStatusOptions.includes(value as IssueStatus));
}

export type IssueFormInput = z.infer<typeof issueFormSchema>;

export function buildIssueMutation(payload: IssueFormInput, actorProfileId: string) {
  return {
    title: payload.title,
    description: payload.description,
    issue_type: payload.issueType,
    severity: payload.severity,
    status: payload.status,
    owner_profile_id: payload.ownerProfileId,
    due_date: payload.dueDate,
    root_cause: payload.rootCause,
    management_response: payload.managementResponse,
    resolution_notes: payload.resolutionNotes,
    source_finding_id: payload.sourceFindingId,
    source_risk_acceptance_id: payload.sourceRiskAcceptanceId,
    risk_id: payload.riskId,
    control_id: payload.controlId,
    action_plan_id: payload.actionPlanId,
    incident_id: payload.incidentId,
    policy_id: payload.policyId,
    third_party_id: payload.thirdPartyId,
    audit_engagement_id: payload.auditEngagementId,
    updated_by: actorProfileId,
  };
}
