import { type SessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const reportPresetOptions = [
  {
    id: "management",
    label: "Management review",
    description: "Operational risk, remediation, and control health for regular leadership reviews.",
  },
  {
    id: "audit_committee",
    label: "Audit committee",
    description: "High-exposure items, findings, and governance signals for committee oversight.",
  },
  {
    id: "compliance",
    label: "Compliance review",
    description: "Framework gaps, attestations, and evidence-adjacent readiness indicators.",
  },
] as const;

export const reportingHorizonOptions = [30, 60, 90] as const;

export type ReportPreset = (typeof reportPresetOptions)[number]["id"];

export type ReportSectionId =
  | "top_risks"
  | "overdue_actions"
  | "control_watchlist"
  | "open_findings"
  | "framework_summary"
  | "vendor_watchlist"
  | "policy_coverage"
  | "risk_acceptances";

type SummaryCardId =
  | "open_risks"
  | "high_critical_risks"
  | "overdue_actions"
  | "open_findings"
  | "critical_open_findings"
  | "controls_due_soon"
  | "framework_gaps"
  | "critical_vendors"
  | "policy_attestation_gaps"
  | "expiring_acceptances";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string | null;
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
  assessment_status: string;
  assessment_score: number;
  owner_profile_id: string | null;
  next_review_date: string | null;
  updated_at: string;
};

type PolicyRow = {
  id: string;
  title: string;
  version: string;
  status: string;
  effective_date: string;
  owner_profile_id: string | null;
  updated_at: string;
};

type PolicyAttestationRow = {
  policy_id: string;
  profile_id: string;
};

type RiskAcceptanceRow = {
  id: string;
  risk_id: string;
  expiration_date: string;
  status: string;
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
  acknowledged: number;
  missing: number;
  totalAudience: number;
  href: string;
};

export type OwnerOption = {
  id: string;
  label: string;
};

export type ReportPack = {
  preset: ReportPreset;
  title: string;
  description: string;
  generatedAt: string;
  horizonDays: number;
  ownerLabel: string | null;
  summaryCards: ReportSummaryCard[];
  sections: ReportSectionId[];
  topRisks: ReportListItem[];
  overdueActions: ReportListItem[];
  controlWatchlist: ReportListItem[];
  openFindings: ReportListItem[];
  frameworkSummary: FrameworkSummaryItem[];
  vendorWatchlist: ReportListItem[];
  policyCoverage: PolicyCoverageItem[];
  riskAcceptances: ReportListItem[];
};

export type ReportingPackResult = {
  filters: {
    preset: ReportPreset;
    ownerId: string;
    horizonDays: number;
  };
  ownerOptions: OwnerOption[];
  pack: ReportPack;
};

const presetConfig: Record<
  ReportPreset,
  {
    title: string;
    description: string;
    summaryCards: SummaryCardId[];
    sections: ReportSectionId[];
  }
> = {
  management: {
    title: "Management review pack",
    description: "Live operating view of risk exposure, remediation pressure, and control execution.",
    summaryCards: [
      "open_risks",
      "high_critical_risks",
      "overdue_actions",
      "open_findings",
      "controls_due_soon",
      "critical_vendors",
    ],
    sections: [
      "top_risks",
      "overdue_actions",
      "control_watchlist",
      "open_findings",
      "framework_summary",
      "vendor_watchlist",
    ],
  },
  audit_committee: {
    title: "Audit committee pack",
    description: "High-severity governance issues and oversight signals for committee meetings.",
    summaryCards: [
      "high_critical_risks",
      "overdue_actions",
      "critical_open_findings",
      "framework_gaps",
      "critical_vendors",
      "expiring_acceptances",
    ],
    sections: [
      "top_risks",
      "open_findings",
      "framework_summary",
      "vendor_watchlist",
      "risk_acceptances",
      "policy_coverage",
    ],
  },
  compliance: {
    title: "Compliance review pack",
    description: "Coverage, policy acknowledgement, and review-cycle indicators for compliance operations.",
    summaryCards: [
      "framework_gaps",
      "policy_attestation_gaps",
      "controls_due_soon",
      "critical_vendors",
      "expiring_acceptances",
      "overdue_actions",
    ],
    sections: [
      "framework_summary",
      "policy_coverage",
      "control_watchlist",
      "vendor_watchlist",
      "risk_acceptances",
    ],
  },
};

const summaryCardMetadata: Record<
  SummaryCardId,
  { label: string; helper: string }
> = {
  open_risks: {
    label: "Open risks",
    helper: "Risks still in draft, open, or accepted state.",
  },
  high_critical_risks: {
    label: "High / critical risks",
    helper: "Active risks with elevated inherent score.",
  },
  overdue_actions: {
    label: "Overdue actions",
    helper: "Action plans past target date and still not closed.",
  },
  open_findings: {
    label: "Open findings",
    helper: "Findings that remain open or in progress.",
  },
  critical_open_findings: {
    label: "High / critical findings",
    helper: "Open findings with the highest severity bands.",
  },
  controls_due_soon: {
    label: "Controls due soon",
    helper: "Controls needing review within the selected horizon.",
  },
  framework_gaps: {
    label: "Framework gaps",
    helper: "Requirement assessments currently marked as gap.",
  },
  critical_vendors: {
    label: "Critical vendors",
    helper: "Vendors with critical tiering or posture requiring attention.",
  },
  policy_attestation_gaps: {
    label: "Policies missing attestations",
    helper: "Active policies with incomplete user acknowledgement coverage.",
  },
  expiring_acceptances: {
    label: "Acceptances expiring",
    helper: "Risk acceptances expiring or already expired in the next 14 days.",
  },
};

const riskLevelRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const findingSeverityRank: Record<string, number> = {
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

function normalizePreset(value: string | undefined): ReportPreset {
  return reportPresetOptions.some((option) => option.id === value)
    ? (value as ReportPreset)
    : "management";
}

function normalizeHorizonDays(value: string | undefined) {
  const parsed = Number(value);
  return reportingHorizonOptions.includes(parsed as (typeof reportingHorizonOptions)[number])
    ? parsed
    : 30;
}

function isoDateOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function ownerLabel(owner: OwnerRow) {
  return owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email;
}

function valueOrFallback(value: string | null | undefined, fallback = "-") {
  return value && value.length > 0 ? value : fallback;
}

function applyOwnerFilter<T extends { owner_profile_id: string | null }>(rows: T[], ownerId: string) {
  if (!ownerId) {
    return rows;
  }

  return rows.filter((row) => row.owner_profile_id === ownerId);
}

function compareOptionalDate(left: string | null, right: string | null) {
  return (left ?? "9999-12-31").localeCompare(right ?? "9999-12-31");
}

export async function getReportingPack(
  profile: SessionProfile,
  rawFilters: { preset?: string; owner?: string; horizon?: string },
): Promise<ReportingPackResult> {
  const preset = normalizePreset(rawFilters.preset);
  const horizonDays = normalizeHorizonDays(rawFilters.horizon);

  const supabase = await createSupabaseServerClient();
  const [
    ownersResult,
    risksResult,
    actionsResult,
    controlsResult,
    findingsResult,
    frameworksResult,
    requirementsResult,
    assessmentsResult,
    thirdPartiesResult,
    policiesResult,
    attestationsResult,
    acceptancesResult,
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
    supabase.from("frameworks").select("id, code, name, version").order("code").returns<FrameworkRow[]>(),
    supabase
      .from("framework_requirements")
      .select("id, framework_id")
      .returns<FrameworkRequirementRow[]>(),
    supabase
      .from("framework_requirement_assessments")
      .select("framework_requirement_id, status")
      .eq("organization_id", profile.organizationId)
      .returns<FrameworkAssessmentRow[]>(),
    supabase
      .from("third_parties")
      .select("id, name, service, criticality, assessment_status, assessment_score, owner_profile_id, next_review_date, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<ThirdPartyRow[]>(),
    supabase
      .from("policies")
      .select("id, title, version, status, effective_date, owner_profile_id, updated_at")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<PolicyRow[]>(),
    supabase
      .from("policy_attestations")
      .select("policy_id, profile_id")
      .eq("organization_id", profile.organizationId)
      .returns<PolicyAttestationRow[]>(),
    supabase
      .from("risk_acceptances")
      .select("id, risk_id, expiration_date, status")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .returns<RiskAcceptanceRow[]>(),
  ]);

  const owners = ownersResult.data ?? [];
  const ownerOptions = owners.map((owner) => ({ id: owner.id, label: ownerLabel(owner) }));
  const ownerId = ownerOptions.some((owner) => owner.id === rawFilters.owner) ? (rawFilters.owner ?? "") : "";
  const ownerById = new Map(owners.map((owner) => [owner.id, ownerLabel(owner)]));

  const allRisks = applyOwnerFilter(risksResult.data ?? [], ownerId);
  const allActions = applyOwnerFilter(actionsResult.data ?? [], ownerId);
  const allControls = applyOwnerFilter(controlsResult.data ?? [], ownerId);
  const allFindings = applyOwnerFilter(findingsResult.data ?? [], ownerId);
  const allThirdParties = applyOwnerFilter(thirdPartiesResult.data ?? [], ownerId);
  const allPolicies = applyOwnerFilter(policiesResult.data ?? [], ownerId);

  const riskById = new Map(allRisks.map((risk) => [risk.id, risk]));
  const activeProfiles = owners.filter((owner) => owner.status !== "deactivated");
  const activeProfileIds = new Set(activeProfiles.map((owner) => owner.id));
  const totalPolicyAudience = activeProfiles.length;

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizonIso = isoDateOffset(horizonDays);
  const acceptanceHorizonIso = isoDateOffset(14);

  const activeRisks = allRisks.filter((risk) => !["closed", "mitigated"].includes(risk.status));
  const highCriticalRisks = activeRisks.filter((risk) =>
    risk.level === "high" || risk.level === "critical",
  );
  const overdueActions = allActions.filter(
    (action) => !["done", "cancelled"].includes(action.status) && action.target_date < todayIso,
  );
  const openFindings = allFindings.filter((finding) => finding.status !== "closed");
  const criticalOpenFindings = openFindings.filter(
    (finding) => finding.severity === "high" || finding.severity === "critical",
  );
  const controlsDueSoon = allControls.filter(
    (control) => control.next_review_date && control.next_review_date <= horizonIso,
  );
  const controlWatchlist = allControls.filter(
    (control) =>
      (control.next_review_date && control.next_review_date <= horizonIso) ||
      ["ineffective", "partially_effective"].includes(control.effectiveness_status),
  );
  const criticalVendors = allThirdParties.filter(
    (vendor) => vendor.criticality === "critical" || vendor.assessment_status === "critical",
  );

  const filteredAcceptances = (acceptancesResult.data ?? []).filter((acceptance) => {
    if (!["active", "expired"].includes(acceptance.status)) {
      return false;
    }

    if (acceptance.expiration_date > acceptanceHorizonIso) {
      return false;
    }

    if (!ownerId) {
      return true;
    }

    const linkedRisk = riskById.get(acceptance.risk_id);
    return linkedRisk?.owner_profile_id === ownerId;
  });

  const policyCoverage = allPolicies
    .filter((policy) => policy.status === "active")
    .map((policy): PolicyCoverageItem => {
      const acknowledged = (attestationsResult.data ?? []).filter(
        (attestation) =>
          attestation.policy_id === policy.id && activeProfileIds.has(attestation.profile_id),
      ).length;
      const missing = Math.max(totalPolicyAudience - acknowledged, 0);

      return {
        id: policy.id,
        title: policy.title,
        version: policy.version,
        acknowledged,
        missing,
        totalAudience: totalPolicyAudience,
        href: `/dashboard/policies/${policy.id}`,
      };
    })
    .sort((left, right) => right.missing - left.missing || left.title.localeCompare(right.title));

  const policyAttestationGaps = policyCoverage.filter((policy) => policy.missing > 0);

  const requirementById = new Map(
    (requirementsResult.data ?? []).map((requirement) => [requirement.id, requirement]),
  );
  const totalByFramework = new Map<string, number>();
  const assessedByFramework = new Map<string, number>();
  const gapByFramework = new Map<string, number>();

  for (const requirement of requirementsResult.data ?? []) {
    totalByFramework.set(
      requirement.framework_id,
      (totalByFramework.get(requirement.framework_id) ?? 0) + 1,
    );
  }

  for (const assessment of assessmentsResult.data ?? []) {
    const requirement = requirementById.get(assessment.framework_requirement_id);

    if (!requirement) {
      continue;
    }

    assessedByFramework.set(
      requirement.framework_id,
      (assessedByFramework.get(requirement.framework_id) ?? 0) + 1,
    );

    if (assessment.status === "gap") {
      gapByFramework.set(
        requirement.framework_id,
        (gapByFramework.get(requirement.framework_id) ?? 0) + 1,
      );
    }
  }

  const frameworkSummary = (frameworksResult.data ?? [])
    .map((framework): FrameworkSummaryItem => {
      const total = totalByFramework.get(framework.id) ?? 0;
      const assessed = assessedByFramework.get(framework.id) ?? 0;
      const gapCount = gapByFramework.get(framework.id) ?? 0;
      const coverageRate = total > 0 ? Math.round((assessed / total) * 100) : 0;
      const gapRate = total > 0 ? Math.round((gapCount / total) * 100) : 0;

      return {
        id: framework.id,
        code: framework.code,
        name: framework.name,
        version: framework.version,
        assessed,
        total,
        coverageRate,
        gapCount,
        gapRate,
      };
    })
    .sort((left, right) => right.gapRate - left.gapRate || right.coverageRate - left.coverageRate);

  const summaryCounts: Record<SummaryCardId, number> = {
    open_risks: activeRisks.length,
    high_critical_risks: highCriticalRisks.length,
    overdue_actions: overdueActions.length,
    open_findings: openFindings.length,
    critical_open_findings: criticalOpenFindings.length,
    controls_due_soon: controlsDueSoon.length,
    framework_gaps: (assessmentsResult.data ?? []).filter((assessment) => assessment.status === "gap").length,
    critical_vendors: criticalVendors.length,
    policy_attestation_gaps: policyAttestationGaps.length,
    expiring_acceptances: filteredAcceptances.length,
  };

  const config = presetConfig[preset];

  const topRisks = [...activeRisks]
    .sort((left, right) => {
      const levelDelta = (riskLevelRank[right.level] ?? 0) - (riskLevelRank[left.level] ?? 0);
      if (levelDelta !== 0) {
        return levelDelta;
      }

      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return compareOptionalDate(left.due_date, right.due_date);
    })
    .slice(0, 8)
    .map((risk): ReportListItem => ({
      id: risk.id,
      title: risk.title,
      meta: `${risk.level} | score ${risk.score} | owner ${valueOrFallback(ownerById.get(risk.owner_profile_id ?? ""))} | due ${valueOrFallback(risk.due_date)}`,
      href: `/dashboard/risks/${risk.id}`,
    }));

  const overdueActionItems = [...overdueActions]
    .sort((left, right) => left.target_date.localeCompare(right.target_date))
    .slice(0, 8)
    .map((action): ReportListItem => ({
      id: action.id,
      title: action.title,
      meta: `${action.priority} priority | ${action.status} | target ${action.target_date} | owner ${valueOrFallback(ownerById.get(action.owner_profile_id ?? ""))}`,
      href: `/dashboard/actions/${action.id}`,
    }));

  const controlWatchlistItems = [...controlWatchlist]
    .sort((left, right) => compareOptionalDate(left.next_review_date, right.next_review_date))
    .slice(0, 8)
    .map((control): ReportListItem => ({
      id: control.id,
      title: `${control.code} - ${control.title}`,
      meta: `review ${valueOrFallback(control.next_review_date)} | ${control.effectiveness_status} | owner ${valueOrFallback(ownerById.get(control.owner_profile_id ?? ""))}`,
      href: `/dashboard/controls/${control.id}`,
    }));

  const openFindingItems = [...openFindings]
    .sort((left, right) => {
      const severityDelta =
        (findingSeverityRank[right.severity] ?? 0) - (findingSeverityRank[left.severity] ?? 0);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return compareOptionalDate(left.due_date, right.due_date);
    })
    .slice(0, 8)
    .map((finding): ReportListItem => ({
      id: finding.id,
      title: finding.title,
      meta: `${finding.severity} | ${finding.status} | due ${valueOrFallback(finding.due_date)} | owner ${valueOrFallback(ownerById.get(finding.owner_profile_id ?? ""))}`,
      href: `/dashboard/findings/${finding.id}`,
    }));

  const vendorWatchlist = [...allThirdParties]
    .filter(
      (vendor) =>
        vendor.criticality === "critical" ||
        vendor.assessment_status === "critical" ||
        (vendor.next_review_date && vendor.next_review_date <= horizonIso),
    )
    .sort((left, right) => {
      const criticalityDelta =
        (vendorCriticalityRank[right.criticality] ?? 0) - (vendorCriticalityRank[left.criticality] ?? 0);
      if (criticalityDelta !== 0) {
        return criticalityDelta;
      }

      return compareOptionalDate(left.next_review_date, right.next_review_date);
    })
    .slice(0, 8)
    .map((vendor): ReportListItem => ({
      id: vendor.id,
      title: vendor.name,
      meta: `${vendor.service} | ${vendor.criticality} | ${vendor.assessment_status}/${vendor.assessment_score} | next review ${valueOrFallback(vendor.next_review_date)}`,
      href: `/dashboard/third-parties/${vendor.id}`,
    }));

  const riskAcceptanceItems = [...filteredAcceptances]
    .sort((left, right) => left.expiration_date.localeCompare(right.expiration_date))
    .slice(0, 8)
    .map((acceptance): ReportListItem => ({
      id: acceptance.id,
      title: riskById.get(acceptance.risk_id)?.title ?? "Risk acceptance",
      meta: `${acceptance.status} | expires ${acceptance.expiration_date}`,
      href: `/dashboard/risk-acceptances/${acceptance.id}`,
    }));

  const summaryCards = config.summaryCards.map((cardId) => ({
    id: cardId,
    label: summaryCardMetadata[cardId].label,
    value: summaryCounts[cardId],
    helper: summaryCardMetadata[cardId].helper,
  }));

  return {
    filters: {
      preset,
      ownerId,
      horizonDays,
    },
    ownerOptions,
    pack: {
      preset,
      title: config.title,
      description: config.description,
      generatedAt: new Date().toISOString(),
      horizonDays,
      ownerLabel: ownerId ? (ownerById.get(ownerId) ?? null) : null,
      summaryCards,
      sections: config.sections,
      topRisks,
      overdueActions: overdueActionItems,
      controlWatchlist: controlWatchlistItems,
      openFindings: openFindingItems,
      frameworkSummary,
      vendorWatchlist,
      policyCoverage: policyCoverage.slice(0, 8),
      riskAcceptances: riskAcceptanceItems,
    },
  };
}
