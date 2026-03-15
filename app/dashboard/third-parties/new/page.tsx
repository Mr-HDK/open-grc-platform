import { z } from "zod";

import { createThirdPartyAction } from "@/app/dashboard/third-parties/actions";
import { ThirdPartyForm } from "@/components/third-parties/third-party-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const uuidSchema = z.string().uuid();

export default async function NewThirdPartyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; riskId?: string; controlId?: string; actionId?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: owners }, { data: risks }, { data: controls }, { data: actions }] = await Promise.all([
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
  ]);

  const selectedRiskIds = uuidSchema.safeParse(params.riskId).success ? [params.riskId!] : [];
  const selectedControlIds = uuidSchema.safeParse(params.controlId).success ? [params.controlId!] : [];
  const selectedActionIds = uuidSchema.safeParse(params.actionId).success ? [params.actionId!] : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New third-party</h1>
        <p className="text-sm text-muted-foreground">
          Register a vendor and capture its current risk posture.
        </p>
      </div>

      <ThirdPartyForm
        mode="create"
        action={createThirdPartyAction}
        owners={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        riskOptions={(risks ?? []).map((risk) => ({
          id: risk.id,
          title: risk.title,
          status: risk.status,
          score: risk.score,
        }))}
        controlOptions={(controls ?? []).map((control) => ({
          id: control.id,
          code: control.code,
          title: control.title,
          effectivenessStatus: control.effectiveness_status,
        }))}
        actionOptions={(actions ?? []).map((actionItem) => ({
          id: actionItem.id,
          title: actionItem.title,
          status: actionItem.status,
          priority: actionItem.priority,
        }))}
        defaults={{
          criticality: "medium",
          tier: "tier_2",
          inherentRisk: "medium",
          onboardingStatus: "in_progress",
          assessmentStatus: "monitoring",
          assessmentScore: 50,
          reassessmentIntervalDays: 90,
          ownerProfileId: profile.id,
          contractOwnerProfileId: profile.id,
          selectedRiskIds,
          selectedControlIds,
          selectedActionIds,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
