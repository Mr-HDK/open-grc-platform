import { z } from "zod";

import { createAssetAction } from "@/app/dashboard/assets/actions";
import { AssetForm } from "@/components/assets/asset-form";
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

const uuidSchema = z.string().uuid();

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; riskId?: string; controlId?: string }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: owners }, { data: risks }, { data: controls }] = await Promise.all([
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
  ]);

  const selectedRiskIds = uuidSchema.safeParse(params.riskId).success ? [params.riskId!] : [];
  const selectedControlIds = uuidSchema.safeParse(params.controlId).success ? [params.controlId!] : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New asset</h1>
        <p className="text-sm text-muted-foreground">
          Register an asset and link it to related risks and controls.
        </p>
      </div>

      <AssetForm
        mode="create"
        action={createAssetAction}
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
        defaults={{
          criticality: "medium",
          status: "active",
          ownerProfileId: profile.id,
          selectedRiskIds,
          selectedControlIds,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
