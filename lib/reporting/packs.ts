import { type SessionProfile } from "@/lib/auth/profile";
import {
  deriveControlAssuranceHealth,
  isOpenEvidenceRequest,
  isPastDate,
  toLabel,
} from "@/lib/control-assurance/health";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  reportingExportTypeOptions,
  reportingFiltersSchema,
  reportingHorizonOptions,
  reportingPresetOptions as reportingPresetValueOptions,
  type ReportingExportType,
  type ReportingPreset,
  type ReportingStatusFocus,
} from "@/lib/validators/reporting";

export const reportPresetOptions = [
  {
    id: "management",
    label: "Management review",
    description: "Operational risk, issues, remediation pressure, and control execution.",
  },
  {
    id: "audit_committee",
    label: "Audit committee",
    description: "Oversight pack focused on high-exposure issues, control risk, vendors, and audits.",
  },
  {
    id: "compliance",
    label: "Compliance review",
    description: "Framework gaps, policy coverage, evidence pressure, and audit readiness.",
  },
] as const satisfies ReadonlyArray<{
  id: ReportingPreset;
  label: string;
  description: string;
}>;

export { reportingHorizonOptions };

export type ReportSectionId =
  | "top_risks"
  | "open_issues"
  | "overdue_actions"
  | "control_health"
  | "framework_summary"
  | "vendor_watchlist"
  | "policy_coverage"
  | "audit_state";

type SummaryCardId =
  | "open_risks"
  | "high_critical_risks"
  | "open_issues"
  | "critical_open_issues"
  | "overdue_actions"
  | "at_risk_controls"
  | "framework_gaps"
  | "critical_vendors"
  | "policy_attestation_missing"
  | "policy_attestation_overdue"
  | "active_audit_engagements"
  | "open_audit_plan_items";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string | null;
};

type SavedViewRow = {
  id: string;
  name: string;
  preset: ReportingPreset;
  owner_profile_id: string | null;
  horizon_days: number;
  issue_type: string | null;
  severity: string | null;
  status_focus: ReportingStatusFocus;
  created_by: string | null;
  created_at: string;
};

type RiskRow = {
  id: string;
  title: string;
  category: string;
  owner_profile_id: string | null;
  status: string;
  level: string;
  score: number;
  due_date: string | null;
  updated_at: string;
};

type IssueRow = {
  id: string;
  title: string;
  issue_type: string;
  severity: string;
  status: string;
  owner_profile_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type ActionRow = {
  id: string;
  title: string;
  owner_profile_id: string | null;
  status: string;
  priority: string;
  target_date: string;
  updated_at: string;
};

type ControlRow = {
  id: string;
  code: string;
  title: string;
  owner_profile_id: string | null;
  effectiveness_status: string;
  next_review_date: string | null;
  updated_at: string;
};

type FindingRow = {
  id: string;
  title: string;
  owner_profile_id: string | null;
  status: string;
  severity: string;
  due_date: string | null;
  control_id: string;
  updated_at: string;
};

type ControlTestRow = {
  id: string;
  control_id: string;
  result: string;
  updated_at: string;
};

type ControlAttestationRow = {
  id: string;
  control_id: string;
  status: "pending" | "submitted" | "reviewed";
  due_date: string;
};

type ControlEvidenceRequestRow = {
  id: string;
  control_id: string;
  status: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  due_date: string;
  evidence_id: string | null;
};

type FrameworkRow = {
  id: string;
  code: string;
  name: string;
  version: string;
};

type FrameworkRequirementRow = {
  id: string;
  framework_id: string;
};

type FrameworkAssessmentRow = {
  framework_requirement_id: string;
  status: "compliant" | "partial" | "gap" | "not_applicable";
};

type ThirdPartyRow = {
  id: string;
  name: string;
  service: string;
  criticality: string;
  tier: string;
  inherent_risk: string;
  assessment_status: string;
  assessment_score: number;
  owner_profile_id: string | null;
  next_review_date: string | null;
  renewal_date: string | null;
  updated_at: string;
};

type PolicyRow = {
  id: string;
  title: string;
  version: string;
  status: string;
  owner_profile_id: string | null;
  next_review_date: string | null;
  updated_at: string;
};

type PolicyCampaignRow = {
  id: string;
  policy_id: string;
  name: string;
  due_date: string;
  created_at: string;
};

type PolicyTargetRow = {
  id: string;
  policy_id: string;
  campaign_id: string;
  profile_id: string;
  status: "pending" | "acknowledged" | "overdue";
  due_date: string;
};

type AuditPlanRow = {
  id: string;
  title: string;
  plan_year: number;
  cycle: string;
  status: string;
  owner_profile_id: string | null;
  updated_at: string;
};

type AuditPlanItemRow = {
  id: string;
  audit_plan_id: string;
  topic: string;
  status: string;
};

type AuditEngagementRow = {
  id: string;
  audit_plan_item_id: string;
  title: string;
  lead_auditor_profile_id: string | null;
  status: string;
  planned_start_date: string;
  planned_end_date: string;
  updated_at: string;
};

export type ReportSummaryCard = {
  id: SummaryCardId;
  label: string;
  value: number;
  helper: string;
};

export type ReportListItem = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

export type FrameworkSummaryItem = {
  id: string;
  code: string;
  name: string;
  version: string;
  assessed: number;
  total: number;
  coverageRate: number;
  gapCount: number;
  gapRate: number;
};

export type PolicyCoverageItem = {
  id: string;
  title: string;
  version: string;
  latestCampaignName: string | null;
  campaignDueDate: string | null;
  acknowledged: number;
  pending: number;
  overdue: number;
  totalAudience: number;
  coverageRate: number;
  href: string;
};

export type ControlHealthItem = {
  id: string;
  code: string;
  title: string;
  ownerLabel: string;
  health: "healthy" | "at_risk";
  effectivenessStatus: string;
  latestTestResult: string | null;
  openFindings: number;
  overdueAttestations: number;
  overdueEvidenceRequests: number;
  nextReviewDate: string | null;
  href: string;
};

export type AuditStatusCard = {
  id: string;
  label: string;
  value: number;
  helper: string;
};

export type SavedReportView = {
  id: string;
  name: string;
  href: string;
  createdAt: string;
  createdByLabel: string;
  filterSummary: string;
};

export type ReportPack = {
  preset: ReportingPreset;
  title: string;
  description: string;
  generatedAt: string;
  horizonDays: number;
  ownerLabel: string | null;
  issueTypeLabel: string | null;
  severityLabel: string | null;
  statusFocusLabel: string;
  summaryCards: ReportSummaryCard[];
  sections: ReportSectionId[];
  topRisks: ReportListItem[];
  openIssues: ReportListItem[];
  overdueActions: ReportListItem[];
  controlHealth: ControlHealthItem[];
  frameworkSummary: FrameworkSummaryItem[];
  vendorWatchlist: ReportListItem[];
  policyCoverage: PolicyCoverageItem[];
  auditStatusCards: AuditStatusCard[];
  auditEngagements: ReportListItem[];
};

export type ReportingExportRow = Record<string, string | number | null>;

export type ReportingPackResult = {
  filters: {
    preset: ReportingPreset;
    ownerId: string;
    horizonDays: number;
    issueType: string;
    severity: string;
    statusFocus: ReportingStatusFocus;
    savedViewId: string;
  };
  ownerOptions: OwnerOption[];
  savedViews: SavedReportView[];
  pack: ReportPack;
  datasets: Record<Exclude<ReportingExportType, "report_pack">, ReportingExportRow[]>;
};

export type OwnerOption = {
  id: string;
  label: string;
};

const presetConfig: Record<
  ReportingPreset,
  {
    title: string;
    description: string;
    summaryCards: SummaryCardId[];
    sections: ReportSectionId[];
  }
> = {
  management: {
    title: "Management review pack",
    description: "Board-ready operational view across risk exposure, open issues, remediation, controls, and vendors.",
    summaryCards: [
      "open_risks",
      "open_issues",
      "overdue_actions",
      "at_risk_controls",
      "framework_gaps",
      "critical_vendors",
    ],
    sections: [
      "top_risks",
      "open_issues",
      "overdue_actions",
      "control_health",
      "vendor_watchlist",
      "audit_state",
    ],
  },
  audit_committee: {
    title: "Audit committee pack",
    description: "Oversight view for high-exposure issues, control risk, governance gaps, and audit execution.",
    summaryCards: [
      "high_critical_risks",
      "critical_open_issues",
      "overdue_actions",
      "at_risk_controls",
      "critical_vendors",
      "active_audit_engagements",
    ],
    sections: [
      "top_risks",
      "open_issues",
      "control_health",
      "framework_summary",
      "vendor_watchlist",
      "audit_state",
    ],
  },
  compliance: {
    title: "Compliance review pack",
    description: "Coverage and readiness pack across frameworks, policies, controls, vendors, and audit backlog.",
    summaryCards: [
      "framework_gaps",
      "policy_attestation_missing",
      "policy_attestation_overdue",
      "at_risk_controls",
      "critical_vendors",
      "open_audit_plan_items",
    ],
    sections: [
      "framework_summary",
      "policy_coverage",
      "control_health",
      "vendor_watchlist",
      "audit_state",
      "open_issues",
    ],
  },
};

const summaryCardMetadata: Record<SummaryCardId, { label: string; helper: string }> = {
  open_risks: {
    label: "Open risks",
    helper: "Risks still open, draft, or accepted.",
  },
  high_critical_risks: {
    label: "High / critical risks",
    helper: "Active risks in the top exposure bands.",
  },
  open_issues: {
    label: "Open issues",
    helper: "Issues still open, in progress, or blocked.",
  },
  critical_open_issues: {
    label: "High / critical issues",
    helper: "Open issues requiring escalation or committee attention.",
  },
  overdue_actions: {
    label: "Overdue actions",
    helper: "Action plans that have passed target date without closure.",
  },
  at_risk_controls: {
    label: "At-risk controls",
    helper: "Controls with open findings, overdue attestations, or weak testing posture.",
  },
  framework_gaps: {
    label: "Framework gaps",
    helper: "Requirement assessments currently marked as gaps.",
  },
  critical_vendors: {
    label: "Critical vendors",
    helper: "Vendors with criticality, posture, or timing concerns.",
  },
  policy_attestation_missing: {
    label: "Policies with missing attestations",
    helper: "Active policies whose latest campaign has incomplete coverage or no campaign.",
  },
  policy_attestation_overdue: {
    label: "Overdue policy attestations",
    helper: "Targets overdue in the latest policy campaigns.",
  },
  active_audit_engagements: {
    label: "Active audit engagements",
    helper: "Engagements currently planned, in fieldwork, or reporting.",
  },
  open_audit_plan_items: {
    label: "Open audit plan items",
    helper: "Planned or in-progress items in the audit plan backlog.",
  },
};

const riskLevelRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const vendorCriticalityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function valueOrFallback(value: string | null | undefined, fallback = "-") {
  return value && value.length > 0 ? value : fallback;
}

function ownerLabel(owner: OwnerRow) {
  return owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email;
}

function compareOptionalDate(left: string | null, right: string | null) {
  return (left ?? "9999-12-31").localeCompare(right ?? "9999-12-31");
}

function isoDateOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function isAttentionIssueStatus(status: string) {
  return ["open", "in_progress", "blocked"].includes(status);
}

function isResolvedIssueStatus(status: string) {
  return ["resolved", "closed"].includes(status);
}

function isActionOpen(status: string) {
  return !["done", "cancelled"].includes(status);
}

function isFindingOpen(status: string) {
  return status !== "closed";
}

function issueMatchesStatusFocus(row: IssueRow, statusFocus: ReportingStatusFocus, todayIso: string) {
  if (statusFocus === "all") {
    return true;
  }
  if (statusFocus === "attention_required") {
    return isAttentionIssueStatus(row.status);
  }
  if (statusFocus === "overdue") {
    return isAttentionIssueStatus(row.status) && isPastDate(row.due_date, todayIso);
  }
  return isResolvedIssueStatus(row.status);
}

function actionMatchesStatusFocus(row: ActionRow, statusFocus: ReportingStatusFocus, todayIso: string) {
  if (statusFocus === "all") {
    return true;
  }
  if (statusFocus === "attention_required") {
    return isActionOpen(row.status);
  }
  if (statusFocus === "overdue") {
    return isActionOpen(row.status) && row.target_date < todayIso;
  }
  return !isActionOpen(row.status);
}

function findingMatchesStatusFocus(row: FindingRow, statusFocus: ReportingStatusFocus, todayIso: string) {
  if (statusFocus === "all") {
    return true;
  }
  if (statusFocus === "attention_required") {
    return isFindingOpen(row.status);
  }
  if (statusFocus === "overdue") {
    return isFindingOpen(row.status) && isPastDate(row.due_date, todayIso);
  }
  return !isFindingOpen(row.status);
}

function riskMatchesStatusFocus(row: RiskRow, statusFocus: ReportingStatusFocus, todayIso: string) {
  const active = !["closed", "mitigated"].includes(row.status);

  if (statusFocus === "all") {
    return true;
  }
  if (statusFocus === "attention_required") {
    return active;
  }
  if (statusFocus === "overdue") {
    return active && isPastDate(row.due_date, todayIso);
  }
  return !active;
}

function vendorMatchesStatusFocus(
  row: ThirdPartyRow,
  statusFocus: ReportingStatusFocus,
  todayIso: string,
  horizonIso: string,
) {
  if (statusFocus === "all") {
    return true;
  }
  if (statusFocus === "attention_required") {
    return (
      ["monitoring", "elevated", "critical"].includes(row.assessment_status) ||
      row.criticality === "critical" ||
      (row.next_review_date !== null && row.next_review_date <= horizonIso)
    );
  }
  if (statusFocus === "overdue") {
    return isPastDate(row.next_review_date, todayIso) || isPastDate(row.renewal_date, todayIso);
  }
  return row.assessment_status === "acceptable";
}

function auditEngagementMatchesStatusFocus(
  row: AuditEngagementRow,
  statusFocus: ReportingStatusFocus,
  todayIso: string,
) {
  if (statusFocus === "all") {
    return true;
  }
  if (statusFocus === "attention_required") {
    return ["planned", "fieldwork", "reporting"].includes(row.status);
  }
  if (statusFocus === "overdue") {
    return ["planned", "fieldwork", "reporting"].includes(row.status) && row.planned_end_date < todayIso;
  }
  return ["completed", "cancelled"].includes(row.status);
}

function severityMatches(value: string, severity: string) {
  return severity.length === 0 || value === severity;
}

function issueTypeMatches(value: string, issueType: string) {
  return issueType.length === 0 || value === issueType;
}

type EffectiveFilters = {
  preset: ReportingPreset;
  ownerId: string;
  horizonDays: number;
  issueType: string;
  severity: string;
  statusFocus: ReportingStatusFocus;
  savedViewId: string;
};

function buildSavedViewFilters(view: SavedViewRow): EffectiveFilters {
  return {
    preset: view.preset,
    ownerId: view.owner_profile_id ?? "",
    horizonDays: view.horizon_days,
    issueType: view.issue_type ?? "",
    severity: view.severity ?? "",
    statusFocus: view.status_focus,
    savedViewId: view.id,
  };
}

async function getSavedViews(profile: SessionProfile) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reporting_saved_views")
    .select("id, name, preset, owner_profile_id, horizon_days, issue_type, severity, status_focus, created_by, created_at")
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<SavedViewRow[]>();

  return data ?? [];
}

function mapSavedViews(
  savedViews: SavedViewRow[],
  ownerById: Map<string, string>,
  activePresetIds: Set<string>,
) {
  return savedViews
    .filter((view) => activePresetIds.has(view.preset))
    .map<SavedReportView>((view) => {
      const summary = [
        reportPresetOptions.find((option) => option.id === view.preset)?.label ?? view.preset,
        `${view.horizon_days}d`,
        view.owner_profile_id ? ownerById.get(view.owner_profile_id) ?? "Unknown owner" : "All owners",
        view.issue_type ? `type ${toLabel(view.issue_type)}` : null,
        view.severity ? `severity ${view.severity}` : null,
        view.status_focus !== "all" ? toLabel(view.status_focus) : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        id: view.id,
        name: view.name,
        href: `/dashboard/reporting?view=${view.id}`,
        createdAt: view.created_at,
        createdByLabel: valueOrFallback(ownerById.get(view.created_by ?? ""), "Unknown user"),
        filterSummary: summary,
      };
    });
}

async function fetchReportingRows(profile: SessionProfile) {
  const supabase = await createSupabaseServerClient();

  const [
    ownersResult,
    risksResult,
    issuesResult,
    actionsResult,
    controlsResult,
    findingsResult,
    controlTestsResult,
    controlAttestationsResult,
    controlEvidenceRequestsResult,
    frameworksResult,
    requirementsResult,
    assessmentsResult,
    thirdPartiesResult,
    policiesResult,
    policyCampaignsResult,
    policyTargetsResult,
    auditPlansResult,
    auditPlanItemsResult,
    auditEngagementsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, status")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
    supabase
      .from("risks")
      .select("id, title, category, owner_profile_id, status, level, score, due_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<RiskRow[]>(),
    supabase
      .from("issues")
      .select("id, title, issue_type, severity, status, owner_profile_id, due_date, created_at, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<IssueRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title, owner_profile_id, status, priority, target_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ActionRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title, owner_profile_id, effectiveness_status, next_review_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlRow[]>(),
    supabase
      .from("findings")
      .select("id, title, owner_profile_id, status, severity, due_date, control_id, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<FindingRow[]>(),
    supabase
      .from("control_tests")
      .select("id, control_id, result, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<ControlTestRow[]>(),
    supabase
      .from("control_attestations")
      .select("id, control_id, status, due_date")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlAttestationRow[]>(),
    supabase
      .from("control_evidence_requests")
      .select("id, control_id, status, due_date, evidence_id")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ControlEvidenceRequestRow[]>(),
    supabase.from("frameworks").select("id, code, name, version").order("code").returns<FrameworkRow[]>(),
    supabase.from("framework_requirements").select("id, framework_id").returns<FrameworkRequirementRow[]>(),
    supabase
      .from("framework_requirement_assessments")
      .select("framework_requirement_id, status")
      .eq("organization_id", profile.organizationId)
      .returns<FrameworkAssessmentRow[]>(),
    supabase
      .from("third_parties")
      .select("id, name, service, criticality, tier, inherent_risk, assessment_status, assessment_score, owner_profile_id, next_review_date, renewal_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ThirdPartyRow[]>(),
    supabase
      .from("policies")
      .select("id, title, version, status, owner_profile_id, next_review_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<PolicyRow[]>(),
    supabase
      .from("policy_attestation_campaigns")
      .select("id, policy_id, name, due_date, created_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<PolicyCampaignRow[]>(),
    supabase
      .from("policy_attestation_targets")
      .select("id, policy_id, campaign_id, profile_id, status, due_date")
      .eq("organization_id", profile.organizationId)
      .returns<PolicyTargetRow[]>(),
    supabase
      .from("audit_plans")
      .select("id, title, plan_year, cycle, status, owner_profile_id, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<AuditPlanRow[]>(),
    supabase
      .from("audit_plan_items")
      .select("id, audit_plan_id, topic, status")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<AuditPlanItemRow[]>(),
    supabase
      .from("audit_engagements")
      .select("id, audit_plan_item_id, title, lead_auditor_profile_id, status, planned_start_date, planned_end_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<AuditEngagementRow[]>(),
  ]);

  return {
    owners: ownersResult.data ?? [],
    risks: risksResult.data ?? [],
    issues: issuesResult.data ?? [],
    actions: actionsResult.data ?? [],
    controls: controlsResult.data ?? [],
    findings: findingsResult.data ?? [],
    controlTests: controlTestsResult.data ?? [],
    controlAttestations: controlAttestationsResult.data ?? [],
    controlEvidenceRequests: controlEvidenceRequestsResult.data ?? [],
    frameworks: frameworksResult.data ?? [],
    requirements: requirementsResult.data ?? [],
    assessments: assessmentsResult.data ?? [],
    thirdParties: thirdPartiesResult.data ?? [],
    policies: policiesResult.data ?? [],
    policyCampaigns: policyCampaignsResult.data ?? [],
    policyTargets: policyTargetsResult.data ?? [],
    auditPlans: auditPlansResult.data ?? [],
    auditPlanItems: auditPlanItemsResult.data ?? [],
    auditEngagements: auditEngagementsResult.data ?? [],
  };
}

export async function getReportingPack(
  profile: SessionProfile,
  rawFilters: {
    preset?: string;
    owner?: string;
    horizon?: string;
    issueType?: string;
    severity?: string;
    statusFocus?: string;
    status?: string;
    view?: string;
  },
): Promise<ReportingPackResult> {
  const parsedFilters = reportingFiltersSchema.safeParse({
    preset: rawFilters.preset,
    ownerId: rawFilters.owner,
    horizonDays: rawFilters.horizon ?? 30,
    issueType: rawFilters.issueType,
    severity: rawFilters.severity,
    statusFocus: rawFilters.statusFocus ?? rawFilters.status ?? "all",
    savedViewId: rawFilters.view,
  });

  const savedViewRows = await getSavedViews(profile);
  const savedViewById = new Map(savedViewRows.map((view) => [view.id, view]));
  const baseFilters: EffectiveFilters = parsedFilters.success
    ? {
        preset: parsedFilters.data.preset,
        ownerId: parsedFilters.data.ownerId ?? "",
        horizonDays: parsedFilters.data.horizonDays,
        issueType: parsedFilters.data.issueType ?? "",
        severity: parsedFilters.data.severity ?? "",
        statusFocus: parsedFilters.data.statusFocus,
        savedViewId: parsedFilters.data.savedViewId ?? "",
      }
    : {
        preset: "management",
        ownerId: "",
        horizonDays: 30,
        issueType: "",
        severity: "",
        statusFocus: "all",
        savedViewId: "",
      };

  const effectiveFilters = baseFilters.savedViewId && savedViewById.has(baseFilters.savedViewId)
    ? buildSavedViewFilters(savedViewById.get(baseFilters.savedViewId)!)
    : baseFilters;

  const rows = await fetchReportingRows(profile);
  const ownerById = new Map(rows.owners.map((owner) => [owner.id, ownerLabel(owner)]));
  const ownerOptions = rows.owners.map((owner) => ({ id: owner.id, label: ownerLabel(owner) }));
  const savedViews = mapSavedViews(
    savedViewRows,
    ownerById,
    new Set(reportingPresetValueOptions),
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizonIso = isoDateOffset(effectiveFilters.horizonDays);

  const risks = rows.risks
    .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
    .filter((row) => severityMatches(row.level, effectiveFilters.severity))
    .filter((row) => riskMatchesStatusFocus(row, effectiveFilters.statusFocus, todayIso));

  const issues = rows.issues
    .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
    .filter((row) => issueTypeMatches(row.issue_type, effectiveFilters.issueType))
    .filter((row) => severityMatches(row.severity, effectiveFilters.severity))
    .filter((row) => issueMatchesStatusFocus(row, effectiveFilters.statusFocus, todayIso));

  const actions = rows.actions
    .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
    .filter((row) => actionMatchesStatusFocus(row, effectiveFilters.statusFocus, todayIso));

  const findings = rows.findings
    .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
    .filter((row) => severityMatches(row.severity, effectiveFilters.severity))
    .filter((row) => findingMatchesStatusFocus(row, effectiveFilters.statusFocus, todayIso));

  const thirdParties = rows.thirdParties
    .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
    .filter((row) => {
      if (effectiveFilters.severity.length === 0) {
        return true;
      }

      return (
        row.criticality === effectiveFilters.severity ||
        row.inherent_risk === effectiveFilters.severity
      );
    })
    .filter((row) => vendorMatchesStatusFocus(row, effectiveFilters.statusFocus, todayIso, horizonIso));

  const policyOwnerFiltered = rows.policies.filter((row) =>
    effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true,
  );

  const controlFindingsByControlId = new Map<string, FindingRow[]>();
  for (const finding of findings) {
    const bucket = controlFindingsByControlId.get(finding.control_id) ?? [];
    bucket.push(finding);
    controlFindingsByControlId.set(finding.control_id, bucket);
  }

  const latestTestByControlId = new Map<string, ControlTestRow>();
  for (const test of rows.controlTests) {
    if (!latestTestByControlId.has(test.control_id)) {
      latestTestByControlId.set(test.control_id, test);
    }
  }

  const attestationsByControlId = new Map<string, ControlAttestationRow[]>();
  for (const attestation of rows.controlAttestations) {
    const bucket = attestationsByControlId.get(attestation.control_id) ?? [];
    bucket.push(attestation);
    attestationsByControlId.set(attestation.control_id, bucket);
  }

  const evidenceRequestsByControlId = new Map<string, ControlEvidenceRequestRow[]>();
  for (const request of rows.controlEvidenceRequests) {
    const bucket = evidenceRequestsByControlId.get(request.control_id) ?? [];
    bucket.push(request);
    evidenceRequestsByControlId.set(request.control_id, bucket);
  }

  const controlHealth = rows.controls
    .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
    .map<ControlHealthItem>((control) => {
      const overdueAttestations = (attestationsByControlId.get(control.id) ?? []).filter(
        (attestation) => attestation.status === "pending" && isPastDate(attestation.due_date, todayIso),
      ).length;
      const overdueEvidenceRequests = (evidenceRequestsByControlId.get(control.id) ?? []).filter(
        (request) => isOpenEvidenceRequest(request.status) && isPastDate(request.due_date, todayIso),
      ).length;
      const openFindings = (controlFindingsByControlId.get(control.id) ?? []).filter((finding) =>
        isFindingOpen(finding.status),
      ).length;
      const latestTest = latestTestByControlId.get(control.id) ?? null;
      const health = deriveControlAssuranceHealth({
        overdueAttestations,
        overdueEvidenceRequests,
        openFindings,
        latestTestResult: latestTest?.result ?? null,
        effectivenessStatus: control.effectiveness_status,
      });

      return {
        id: control.id,
        code: control.code,
        title: control.title,
        ownerLabel: valueOrFallback(ownerById.get(control.owner_profile_id ?? "")),
        health,
        effectivenessStatus: control.effectiveness_status,
        latestTestResult: latestTest?.result ?? null,
        openFindings,
        overdueAttestations,
        overdueEvidenceRequests,
        nextReviewDate: control.next_review_date,
        href: `/dashboard/controls/${control.id}`,
      };
    })
    .filter((item) => {
      if (effectiveFilters.statusFocus === "all") {
        return true;
      }
      if (effectiveFilters.statusFocus === "attention_required") {
        return item.health === "at_risk";
      }
      if (effectiveFilters.statusFocus === "overdue") {
        return (
          item.overdueAttestations > 0 ||
          item.overdueEvidenceRequests > 0 ||
          isPastDate(item.nextReviewDate, todayIso)
        );
      }
      return item.health === "healthy";
    });

  const activeProfiles = rows.owners.filter((owner) => owner.status !== "deactivated" && owner.status !== "invited");
  const activeProfileIds = new Set(activeProfiles.map((owner) => owner.id));
  const campaignsByPolicyId = new Map<string, PolicyCampaignRow[]>();
  for (const campaign of rows.policyCampaigns) {
    const bucket = campaignsByPolicyId.get(campaign.policy_id) ?? [];
    bucket.push(campaign);
    campaignsByPolicyId.set(campaign.policy_id, bucket);
  }
  const targetsByCampaignId = new Map<string, PolicyTargetRow[]>();
  for (const target of rows.policyTargets) {
    const bucket = targetsByCampaignId.get(target.campaign_id) ?? [];
    bucket.push(target);
    targetsByCampaignId.set(target.campaign_id, bucket);
  }

  const policyCoverage = policyOwnerFiltered
    .filter((policy) => policy.status === "active")
    .map<PolicyCoverageItem>((policy) => {
      const latestCampaign =
        (campaignsByPolicyId.get(policy.id) ?? []).sort((left, right) =>
          right.created_at.localeCompare(left.created_at),
        )[0] ?? null;
      const targets = latestCampaign
        ? (targetsByCampaignId.get(latestCampaign.id) ?? []).filter((target) =>
            activeProfileIds.has(target.profile_id),
          )
        : [];
      const acknowledged = targets.filter((target) => target.status === "acknowledged").length;
      const overdue = targets.filter(
        (target) => target.status === "overdue" || (target.status === "pending" && target.due_date < todayIso),
      ).length;
      const pending = Math.max(targets.length - acknowledged - overdue, 0);
      const coverageRate = targets.length > 0 ? Math.round((acknowledged / targets.length) * 100) : 0;

      return {
        id: policy.id,
        title: policy.title,
        version: policy.version,
        latestCampaignName: latestCampaign?.name ?? null,
        campaignDueDate: latestCampaign?.due_date ?? null,
        acknowledged,
        pending,
        overdue,
        totalAudience: targets.length,
        coverageRate,
        href: `/dashboard/policies/${policy.id}`,
      };
    })
    .filter((item) => {
      if (effectiveFilters.statusFocus === "overdue") {
        return item.overdue > 0;
      }
      if (effectiveFilters.statusFocus === "attention_required") {
        return item.overdue > 0 || item.pending > 0 || item.totalAudience === 0;
      }
      if (effectiveFilters.statusFocus === "resolved") {
        return item.totalAudience > 0 && item.pending === 0 && item.overdue === 0;
      }
      return true;
    })
    .sort((left, right) =>
      right.overdue - left.overdue ||
      right.pending - left.pending ||
      left.title.localeCompare(right.title),
    );

  const requirementById = new Map(rows.requirements.map((requirement) => [requirement.id, requirement]));
  const frameworkTotals = new Map<string, { total: number; assessed: number; gaps: number }>();
  for (const requirement of rows.requirements) {
    const bucket = frameworkTotals.get(requirement.framework_id) ?? { total: 0, assessed: 0, gaps: 0 };
    bucket.total += 1;
    frameworkTotals.set(requirement.framework_id, bucket);
  }
  for (const assessment of rows.assessments) {
    const requirement = requirementById.get(assessment.framework_requirement_id);
    if (!requirement) {
      continue;
    }
    const bucket = frameworkTotals.get(requirement.framework_id) ?? { total: 0, assessed: 0, gaps: 0 };
    bucket.assessed += 1;
    if (assessment.status === "gap") {
      bucket.gaps += 1;
    }
    frameworkTotals.set(requirement.framework_id, bucket);
  }
  const frameworkSummary = rows.frameworks
    .map<FrameworkSummaryItem>((framework) => {
      const stats = frameworkTotals.get(framework.id) ?? { total: 0, assessed: 0, gaps: 0 };
      const coverageRate = stats.total > 0 ? Math.round((stats.assessed / stats.total) * 100) : 0;
      const gapRate = stats.total > 0 ? Math.round((stats.gaps / stats.total) * 100) : 0;
      return {
        id: framework.id,
        code: framework.code,
        name: framework.name,
        version: framework.version,
        assessed: stats.assessed,
        total: stats.total,
        coverageRate,
        gapCount: stats.gaps,
        gapRate,
      };
    })
    .filter((item) => {
      if (effectiveFilters.statusFocus === "overdue") {
        return item.gapCount > 0;
      }
      if (effectiveFilters.statusFocus === "attention_required") {
        return item.gapCount > 0 || item.coverageRate < 100;
      }
      if (effectiveFilters.statusFocus === "resolved") {
        return item.gapCount === 0 && item.coverageRate === 100;
      }
      return true;
    })
    .sort((left, right) => right.gapCount - left.gapCount || right.gapRate - left.gapRate);

  const auditPlans = rows.auditPlans.filter((plan) =>
    effectiveFilters.ownerId ? plan.owner_profile_id === effectiveFilters.ownerId : true,
  );
  const auditPlanById = new Map(auditPlans.map((plan) => [plan.id, plan]));
  const auditPlanItems = rows.auditPlanItems.filter((item) => auditPlanById.has(item.audit_plan_id));
  const auditPlanItemById = new Map(auditPlanItems.map((item) => [item.id, item]));
  const auditEngagements = rows.auditEngagements
    .filter((engagement) => auditPlanItemById.has(engagement.audit_plan_item_id))
    .filter((engagement) => auditEngagementMatchesStatusFocus(engagement, effectiveFilters.statusFocus, todayIso));

  const totalGapCount = frameworkSummary.reduce((total, framework) => total + framework.gapCount, 0);
  const criticalVendorCount = thirdParties.filter(
    (vendor) =>
      vendor.criticality === "critical" ||
      vendor.tier === "tier_1" ||
      vendor.assessment_status === "critical" ||
      isPastDate(vendor.next_review_date, todayIso),
  ).length;
  const atRiskControlCount = controlHealth.filter((control) => control.health === "at_risk").length;
  const policyCoverageWithGaps = policyCoverage.filter(
    (policy) => policy.totalAudience === 0 || policy.pending > 0 || policy.overdue > 0,
  );

  const summaryCounts: Record<SummaryCardId, number> = {
    open_risks: risks.filter((risk) => !["closed", "mitigated"].includes(risk.status)).length,
    high_critical_risks: risks.filter(
      (risk) =>
        !["closed", "mitigated"].includes(risk.status) &&
        ["high", "critical"].includes(risk.level),
    ).length,
    open_issues: issues.filter((issue) => isAttentionIssueStatus(issue.status)).length,
    critical_open_issues: issues.filter(
      (issue) =>
        isAttentionIssueStatus(issue.status) &&
        ["high", "critical"].includes(issue.severity),
    ).length,
    overdue_actions: actions.filter(
      (action) => isActionOpen(action.status) && action.target_date < todayIso,
    ).length,
    at_risk_controls: atRiskControlCount,
    framework_gaps: totalGapCount,
    critical_vendors: criticalVendorCount,
    policy_attestation_missing: policyCoverageWithGaps.length,
    policy_attestation_overdue: policyCoverage.reduce((total, item) => total + item.overdue, 0),
    active_audit_engagements: auditEngagements.filter((engagement) =>
      ["planned", "fieldwork", "reporting"].includes(engagement.status),
    ).length,
    open_audit_plan_items: auditPlanItems.filter((item) =>
      ["planned", "in_progress", "deferred"].includes(item.status),
    ).length,
  };

  const config = presetConfig[effectiveFilters.preset];

  const topRisks = [...risks]
    .sort((left, right) => {
      const levelDelta = (riskLevelRank[right.level] ?? 0) - (riskLevelRank[left.level] ?? 0);
      if (levelDelta !== 0) {
        return levelDelta;
      }
      return right.score - left.score || compareOptionalDate(left.due_date, right.due_date);
    })
    .slice(0, 8)
    .map<ReportListItem>((risk) => ({
      id: risk.id,
      title: risk.title,
      meta: `${risk.level} | score ${risk.score} | ${risk.status} | owner ${valueOrFallback(ownerById.get(risk.owner_profile_id ?? ""))} | due ${valueOrFallback(risk.due_date)}`,
      href: `/dashboard/risks/${risk.id}`,
    }));

  const openIssues = [...issues]
    .sort((left, right) => {
      const severityDelta = (riskLevelRank[right.severity] ?? 0) - (riskLevelRank[left.severity] ?? 0);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return compareOptionalDate(left.due_date, right.due_date);
    })
    .slice(0, 8)
    .map<ReportListItem>((issue) => ({
      id: issue.id,
      title: issue.title,
      meta: `${toLabel(issue.issue_type)} | ${issue.severity} | ${issue.status} | owner ${valueOrFallback(ownerById.get(issue.owner_profile_id ?? ""))} | due ${valueOrFallback(issue.due_date)}`,
      href: `/dashboard/issues/${issue.id}`,
    }));

  const overdueActions = [...actions]
    .filter((action) => isActionOpen(action.status) && action.target_date < todayIso)
    .sort((left, right) => left.target_date.localeCompare(right.target_date))
    .slice(0, 8)
    .map<ReportListItem>((action) => ({
      id: action.id,
      title: action.title,
      meta: `${action.priority} priority | ${action.status} | target ${action.target_date} | owner ${valueOrFallback(ownerById.get(action.owner_profile_id ?? ""))}`,
      href: `/dashboard/actions/${action.id}`,
    }));

  const vendorWatchlist = [...thirdParties]
    .filter(
      (vendor) =>
        vendor.criticality === "critical" ||
        vendor.tier === "tier_1" ||
        vendor.assessment_status === "critical" ||
        (vendor.next_review_date !== null && vendor.next_review_date <= horizonIso) ||
        isPastDate(vendor.renewal_date, todayIso),
    )
    .sort((left, right) => {
      const criticalityDelta =
        (vendorCriticalityRank[right.criticality] ?? 0) -
        (vendorCriticalityRank[left.criticality] ?? 0);
      if (criticalityDelta !== 0) {
        return criticalityDelta;
      }
      return compareOptionalDate(left.next_review_date, right.next_review_date);
    })
    .slice(0, 8)
    .map<ReportListItem>((vendor) => ({
      id: vendor.id,
      title: vendor.name,
      meta: `${vendor.service} | ${vendor.criticality} | tier ${toLabel(vendor.tier)} | ${vendor.assessment_status}/${vendor.assessment_score} | next review ${valueOrFallback(vendor.next_review_date)}`,
      href: `/dashboard/third-parties/${vendor.id}`,
    }));

  const auditStatusCards: AuditStatusCard[] = [
    {
      id: "plans",
      label: "Plans in execution",
      value: auditPlans.filter((plan) => ["approved", "in_progress"].includes(plan.status)).length,
      helper: "Approved or active audit plans.",
    },
    {
      id: "plan_items",
      label: "Open plan items",
      value: auditPlanItems.filter((item) => ["planned", "in_progress", "deferred"].includes(item.status)).length,
      helper: "Plan items not yet completed.",
    },
    {
      id: "engagements",
      label: "Active engagements",
      value: auditEngagements.filter((engagement) => ["planned", "fieldwork", "reporting"].includes(engagement.status)).length,
      helper: "Engagements still in flight.",
    },
    {
      id: "overdue",
      label: "Overdue engagements",
      value: auditEngagements.filter((engagement) => ["planned", "fieldwork", "reporting"].includes(engagement.status) && engagement.planned_end_date < todayIso).length,
      helper: "Engagements past planned end date.",
    },
  ];

  const auditEngagementItems = [...auditEngagements]
    .sort((left, right) => compareOptionalDate(left.planned_end_date, right.planned_end_date))
    .slice(0, 8)
    .map<ReportListItem>((engagement) => {
      const planItem = auditPlanItemById.get(engagement.audit_plan_item_id) ?? null;
      const plan = planItem ? auditPlanById.get(planItem.audit_plan_id) ?? null : null;
      return {
        id: engagement.id,
        title: engagement.title,
        meta: `${engagement.status} | ${engagement.planned_start_date} to ${engagement.planned_end_date} | ${plan ? `${plan.title} ${plan.plan_year}` : "No plan"} | lead ${valueOrFallback(ownerById.get(engagement.lead_auditor_profile_id ?? ""))}`,
        href: `/dashboard/audits/engagements/${engagement.id}`,
      };
    });

  const summaryCards = config.summaryCards.map((cardId) => ({
    id: cardId,
    label: summaryCardMetadata[cardId].label,
    value: summaryCounts[cardId],
    helper: summaryCardMetadata[cardId].helper,
  }));

  const pack: ReportPack = {
    preset: effectiveFilters.preset,
    title: config.title,
    description: config.description,
    generatedAt: new Date().toISOString(),
    horizonDays: effectiveFilters.horizonDays,
    ownerLabel: effectiveFilters.ownerId ? ownerById.get(effectiveFilters.ownerId) ?? null : null,
    issueTypeLabel: effectiveFilters.issueType ? toLabel(effectiveFilters.issueType) : null,
    severityLabel: effectiveFilters.severity ? toLabel(effectiveFilters.severity) : null,
    statusFocusLabel: toLabel(effectiveFilters.statusFocus),
    summaryCards,
    sections: config.sections,
    topRisks,
    openIssues,
    overdueActions,
    controlHealth: [...controlHealth]
      .sort((left, right) => {
        if (left.health !== right.health) {
          return left.health === "at_risk" ? -1 : 1;
        }
        return right.openFindings - left.openFindings || left.code.localeCompare(right.code);
      })
      .slice(0, 10),
    frameworkSummary: frameworkSummary.slice(0, 8),
    vendorWatchlist,
    policyCoverage: policyCoverage.slice(0, 8),
    auditStatusCards,
    auditEngagements: auditEngagementItems,
  };

  const datasets: Record<Exclude<ReportingExportType, "report_pack">, ReportingExportRow[]> = {
    risks: risks.map((risk) => ({
      id: risk.id,
      title: risk.title,
      category: risk.category,
      owner: valueOrFallback(ownerById.get(risk.owner_profile_id ?? "")),
      status: risk.status,
      level: risk.level,
      score: risk.score,
      due_date: risk.due_date,
      updated_at: risk.updated_at,
    })),
    issues: issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      issue_type: issue.issue_type,
      severity: issue.severity,
      status: issue.status,
      owner: valueOrFallback(ownerById.get(issue.owner_profile_id ?? "")),
      due_date: issue.due_date,
      updated_at: issue.updated_at,
    })),
    actions: actions.map((action) => ({
      id: action.id,
      title: action.title,
      priority: action.priority,
      status: action.status,
      owner: valueOrFallback(ownerById.get(action.owner_profile_id ?? "")),
      target_date: action.target_date,
      updated_at: action.updated_at,
    })),
    findings: findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      owner: valueOrFallback(ownerById.get(finding.owner_profile_id ?? "")),
      due_date: finding.due_date,
      control_id: finding.control_id,
      updated_at: finding.updated_at,
    })),
    controls: rows.controls
      .filter((row) => (effectiveFilters.ownerId ? row.owner_profile_id === effectiveFilters.ownerId : true))
      .map((control) => ({
        id: control.id,
        code: control.code,
        title: control.title,
        owner: valueOrFallback(ownerById.get(control.owner_profile_id ?? "")),
        effectiveness_status: control.effectiveness_status,
        next_review_date: control.next_review_date,
        updated_at: control.updated_at,
      })),
    control_health: controlHealth.map((control) => ({
      id: control.id,
      code: control.code,
      title: control.title,
      owner: control.ownerLabel,
      health: control.health,
      effectiveness_status: control.effectivenessStatus,
      latest_test_result: control.latestTestResult,
      open_findings: control.openFindings,
      overdue_attestations: control.overdueAttestations,
      overdue_evidence_requests: control.overdueEvidenceRequests,
      next_review_date: control.nextReviewDate,
    })),
    framework_gaps: frameworkSummary.map((framework) => ({
      id: framework.id,
      code: framework.code,
      name: framework.name,
      version: framework.version,
      assessed: framework.assessed,
      total: framework.total,
      coverage_rate: framework.coverageRate,
      gap_count: framework.gapCount,
      gap_rate: framework.gapRate,
    })),
    vendors: thirdParties.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      service: vendor.service,
      criticality: vendor.criticality,
      tier: vendor.tier,
      inherent_risk: vendor.inherent_risk,
      assessment_status: vendor.assessment_status,
      assessment_score: vendor.assessment_score,
      owner: valueOrFallback(ownerById.get(vendor.owner_profile_id ?? "")),
      next_review_date: vendor.next_review_date,
      renewal_date: vendor.renewal_date,
      updated_at: vendor.updated_at,
    })),
    policy_coverage: policyCoverage.map((policy) => ({
      id: policy.id,
      title: policy.title,
      version: policy.version,
      latest_campaign: policy.latestCampaignName,
      campaign_due_date: policy.campaignDueDate,
      acknowledged: policy.acknowledged,
      pending: policy.pending,
      overdue: policy.overdue,
      total_audience: policy.totalAudience,
      coverage_rate: policy.coverageRate,
    })),
    audits: auditEngagements.map((engagement) => {
      const planItem = auditPlanItemById.get(engagement.audit_plan_item_id) ?? null;
      const plan = planItem ? auditPlanById.get(planItem.audit_plan_id) ?? null : null;
      return {
        id: engagement.id,
        title: engagement.title,
        status: engagement.status,
        planned_start_date: engagement.planned_start_date,
        planned_end_date: engagement.planned_end_date,
        lead_auditor: valueOrFallback(ownerById.get(engagement.lead_auditor_profile_id ?? "")),
        plan_title: plan?.title ?? null,
        plan_year: plan?.plan_year ?? null,
        plan_cycle: plan?.cycle ?? null,
        plan_item_topic: planItem?.topic ?? null,
      };
    }),
  };

  return {
    filters: effectiveFilters,
    ownerOptions,
    savedViews,
    pack,
    datasets,
  };
}

export function isReportingExportType(value: string | null | undefined): value is ReportingExportType {
  return Boolean(value && reportingExportTypeOptions.includes(value as ReportingExportType));
}
