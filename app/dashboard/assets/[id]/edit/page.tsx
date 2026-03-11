import { notFound } from "next/navigation";

import { updateAssetAction } from "@/app/dashboard/assets/actions";
import { AssetForm } from "@/components/assets/asset-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isAssetCriticality,
  isAssetStatus,
  type AssetCriticality,
  type AssetStatus,
} from "@/lib/validators/asset";

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
  criticality: string;
  status: string;
  owner_profile_id: string | null;
  description: string | null;
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

type AssetRiskRow = {
  risk_id: string;
};

type AssetControlRow = {
  control_id: string;
};

async function getAsset(assetId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assets")
    .select("id, name, asset_type, criticality, status, owner_profile_id, description")
    .eq("id", assetId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<AssetRow>();

  return data;
}

export default async function EditAssetPage({
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

  const [asset, ownersResult, risksResult, controlsResult, assetRisksResult, assetControlsResult] =
    await Promise.all([
      getAsset(id, profile.organizationId),
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
      supabase.from("asset_risks").select("risk_id").eq("asset_id", id).returns<AssetRiskRow[]>(),
      supabase
        .from("asset_controls")
        .select("control_id")
        .eq("asset_id", id)
        .returns<AssetControlRow[]>(),
    ]);

  if (!asset) {
    notFound();
  }

  const criticality: AssetCriticality = isAssetCriticality(asset.criticality)
    ? asset.criticality
    : "medium";

  const status: AssetStatus = isAssetStatus(asset.status) ? asset.status : "active";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit asset</h1>
        <p className="text-sm text-muted-foreground">Update metadata and asset links.</p>
      </div>

      <AssetForm
        mode="edit"
        action={updateAssetAction}
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
        defaults={{
          assetId: asset.id,
          name: asset.name,
          assetType: asset.asset_type,
          criticality,
          status,
          ownerProfileId: asset.owner_profile_id,
          description: asset.description,
          selectedRiskIds: (assetRisksResult.data ?? []).map((row) => row.risk_id),
          selectedControlIds: (assetControlsResult.data ?? []).map((row) => row.control_id),
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
