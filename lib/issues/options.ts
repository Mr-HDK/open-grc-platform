import { createSupabaseServerClient } from "@/lib/supabase/server";

export type IssueOption = {
  id: string;
  label: string;
};

type ProfileRow = { id: string; email: string; full_name: string | null };
type FindingRow = { id: string; title: string; status: string; severity: string };
type RiskAcceptanceRow = { id: string; risk_id: string; expiration_date: string; status: string };
type RiskRow = { id: string; title: string };
type ControlRow = { id: string; code: string; title: string };
type ActionPlanRow = { id: string; title: string; status: string };
type IncidentRow = { id: string; title: string; status: string };
type PolicyRow = { id: string; title: string; version: string; status: string };
type ThirdPartyRow = { id: string; name: string; assessment_status: string };
type AuditEngagementRow = { id: string; title: string; status: string };

export async function getIssueFormOptions(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [
    { data: owners },
    { data: findings },
    { data: riskAcceptances },
    { data: risks },
    { data: controls },
    { data: actionPlans },
    { data: incidents },
    { data: policies },
    { data: thirdParties },
    { data: auditEngagements },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    supabase
      .from("findings")
      .select("id, title, status, severity")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<FindingRow[]>(),
    supabase
      .from("risk_acceptances")
      .select("id, risk_id, expiration_date, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<RiskAcceptanceRow[]>(),
    supabase
      .from("risks")
      .select("id, title")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<RiskRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<ControlRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<ActionPlanRow[]>(),
    supabase
      .from("incidents")
      .select("id, title, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<IncidentRow[]>(),
    supabase
      .from("policies")
      .select("id, title, version, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<PolicyRow[]>(),
    supabase
      .from("third_parties")
      .select("id, name, assessment_status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<ThirdPartyRow[]>(),
    supabase
      .from("audit_engagements")
      .select("id, title, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80)
      .returns<AuditEngagementRow[]>(),
  ]);

  const riskLabelById = new Map((risks ?? []).map((risk) => [risk.id, risk.title]));

  return {
    ownerOptions: (owners ?? []).map((owner) => ({
      id: owner.id,
      label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
    })),
    findingOptions: (findings ?? []).map((finding) => ({
      id: finding.id,
      label: `${finding.title} (${finding.severity} / ${finding.status})`,
    })),
    riskAcceptanceOptions: (riskAcceptances ?? []).map((acceptance) => ({
      id: acceptance.id,
      label: `${riskLabelById.get(acceptance.risk_id) ?? acceptance.risk_id} (${acceptance.status}, exp ${acceptance.expiration_date})`,
    })),
    riskOptions: (risks ?? []).map((risk) => ({
      id: risk.id,
      label: risk.title,
    })),
    controlOptions: (controls ?? []).map((control) => ({
      id: control.id,
      label: `${control.code} - ${control.title}`,
    })),
    actionPlanOptions: (actionPlans ?? []).map((actionPlan) => ({
      id: actionPlan.id,
      label: `${actionPlan.title} (${actionPlan.status})`,
    })),
    incidentOptions: (incidents ?? []).map((incident) => ({
      id: incident.id,
      label: `${incident.title} (${incident.status})`,
    })),
    policyOptions: (policies ?? []).map((policy) => ({
      id: policy.id,
      label: `${policy.title} v${policy.version} (${policy.status})`,
    })),
    thirdPartyOptions: (thirdParties ?? []).map((thirdParty) => ({
      id: thirdParty.id,
      label: `${thirdParty.name} (${thirdParty.assessment_status})`,
    })),
    auditEngagementOptions: (auditEngagements ?? []).map((engagement) => ({
      id: engagement.id,
      label: `${engagement.title} (${engagement.status})`,
    })),
  };
}
