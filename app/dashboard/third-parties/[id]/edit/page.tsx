import { notFound } from "next/navigation";

import { updateThirdPartyAction } from "@/app/dashboard/third-parties/actions";
import { ThirdPartyForm } from "@/components/third-parties/third-party-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isThirdPartyAssessmentStatus,
  isThirdPartyInherentRisk,
  isThirdPartyOnboardingStatus,
  isThirdPartyTier,
  type ThirdPartyAssessmentStatus,
  type ThirdPartyInherentRisk,
  type ThirdPartyOnboardingStatus,
  type ThirdPartyTier,
} from "@/lib/validators/third-party";
import { isAssetCriticality, type AssetCriticality } from "@/lib/validators/asset";

type ThirdPartyRow = {
  id: string;
  name: string;
  service: string;
  criticality: string;
  tier: string;
  inherent_risk: string;
  onboarding_status: string;
  assessment_status: string;
  assessment_score: number;
  next_review_date: string | null;
  renewal_date: string | null;
  reassessment_interval_days: number;
  owner_profile_id: string | null;
  contract_owner_profile_id: string | null;
  notes: string | null;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type RiskRow = {
  id: string;
  title: string;
  status: string;
  score: number;
};

type ControlRow = {
  id: string;
  code: string;
  title: string;
  effectiveness_status: string;
};

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

type ThirdPartyRiskRow = {
  risk_id: string;
};

type ThirdPartyControlRow = {
  control_id: string;
};

type ThirdPartyActionRow = {
  action_plan_id: string;
};

async function getThirdParty(thirdPartyId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("third_parties")
    .select(
      "id, name, service, criticality, tier, inherent_risk, onboarding_status, assessment_status, assessment_score, next_review_date, renewal_date, reassessment_interval_days, owner_profile_id, contract_owner_profile_id, notes",
    )
    .eq("id", thirdPartyId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<ThirdPartyRow>();

  return data;
}

export default async function EditThirdPartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    thirdParty,
    ownersResult,
    risksResult,
    controlsResult,
    actionsResult,
    linkedRisksResult,
    linkedControlsResult,
    linkedActionsResult,
  ] = await Promise.all([
    getThirdParty(id, profile.organizationId),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
    supabase
      .from("risks")
      .select("id, title, status, score")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(60)
      .returns<RiskRow[]>(),
    supabase
      .from("controls")
      .select("id, code, title, effectiveness_status")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(60)
      .returns<ControlRow[]>(),
    supabase
      .from("action_plans")
      .select("id, title, status, priority")
      .eq("organization_id", profile.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(60)
      .returns<ActionRow[]>(),
    supabase
      .from("third_party_risks")
      .select("risk_id")
      .eq("third_party_id", id)
      .returns<ThirdPartyRiskRow[]>(),
    supabase
      .from("third_party_controls")
      .select("control_id")
      .eq("third_party_id", id)
      .returns<ThirdPartyControlRow[]>(),
    supabase
      .from("third_party_actions")
      .select("action_plan_id")
      .eq("third_party_id", id)
      .returns<ThirdPartyActionRow[]>(),
  ]);

  if (!thirdParty) {
    notFound();
  }

  const criticality: AssetCriticality = isAssetCriticality(thirdParty.criticality)
    ? thirdParty.criticality
    : "medium";

  const assessmentStatus: ThirdPartyAssessmentStatus = isThirdPartyAssessmentStatus(
    thirdParty.assessment_status,
  )
    ? thirdParty.assessment_status
    : "monitoring";
  const tier: ThirdPartyTier = isThirdPartyTier(thirdParty.tier) ? thirdParty.tier : "tier_2";
  const inherentRisk: ThirdPartyInherentRisk = isThirdPartyInherentRisk(thirdParty.inherent_risk)
    ? thirdParty.inherent_risk
    : "medium";
  const onboardingStatus: ThirdPartyOnboardingStatus = isThirdPartyOnboardingStatus(
    thirdParty.onboarding_status,
  )
    ? thirdParty.onboarding_status
    : "in_progress";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit third-party</h1>
        <p className="text-sm text-muted-foreground">Update vendor profile and linked entities.</p>
      </div>

      <ThirdPartyForm
        mode="edit"
        action={updateThirdPartyAction}
        owners={(ownersResult.data ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        riskOptions={(risksResult.data ?? []).map((risk) => ({
          id: risk.id,
          title: risk.title,
          status: risk.status,
          score: risk.score,
        }))}
        controlOptions={(controlsResult.data ?? []).map((control) => ({
          id: control.id,
          code: control.code,
          title: control.title,
          effectivenessStatus: control.effectiveness_status,
        }))}
        actionOptions={(actionsResult.data ?? []).map((actionItem) => ({
          id: actionItem.id,
          title: actionItem.title,
          status: actionItem.status,
          priority: actionItem.priority,
        }))}
        defaults={{
          thirdPartyId: thirdParty.id,
          name: thirdParty.name,
          service: thirdParty.service,
          criticality,
          tier,
          inherentRisk,
          onboardingStatus,
          assessmentStatus,
          assessmentScore: thirdParty.assessment_score,
          nextReviewDate: thirdParty.next_review_date,
          renewalDate: thirdParty.renewal_date,
          reassessmentIntervalDays: thirdParty.reassessment_interval_days,
          ownerProfileId: thirdParty.owner_profile_id,
          contractOwnerProfileId: thirdParty.contract_owner_profile_id,
          notes: thirdParty.notes,
          selectedRiskIds: (linkedRisksResult.data ?? []).map((row) => row.risk_id),
          selectedControlIds: (linkedControlsResult.data ?? []).map((row) => row.control_id),
          selectedActionIds: (linkedActionsResult.data ?? []).map((row) => row.action_plan_id),
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
