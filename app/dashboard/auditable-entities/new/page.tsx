import { z } from "zod";

import { createAuditableEntityAction } from "@/app/dashboard/auditable-entities/actions";
import { AuditableEntityForm } from "@/components/auditable-entities/auditable-entity-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type ParentRow = {
  id: string;
  name: string;
  entity_type: string;
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

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
  criticality: string;
};

type ThirdPartyRow = {
  id: string;
  name: string;
  service: string;
  assessment_status: string;
};

const uuidSchema = z.string().uuid();

export default async function NewAuditableEntityPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    riskId?: string;
    controlId?: string;
    assetId?: string;
    thirdPartyId?: string;
    parentId?: string;
  }>;
}) {
  const profile = await requireSessionProfile("contributor");
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: owners }, { data: parents }, { data: risks }, { data: controls }, { data: assets }, { data: thirdParties }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("organization_id", profile.organizationId)
        .order("email")
        .returns<OwnerRow[]>(),
      supabase
        .from("auditable_entities")
        .select("id, name, entity_type")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .order("name")
        .returns<ParentRow[]>(),
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
        .from("assets")
        .select("id, name, asset_type, criticality")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(60)
        .returns<AssetRow[]>(),
      supabase
        .from("third_parties")
        .select("id, name, service, assessment_status")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(60)
        .returns<ThirdPartyRow[]>(),
    ]);

  const selectedRiskIds = uuidSchema.safeParse(params.riskId).success ? [params.riskId!] : [];
  const selectedControlIds = uuidSchema.safeParse(params.controlId).success ? [params.controlId!] : [];
  const selectedAssetIds = uuidSchema.safeParse(params.assetId).success ? [params.assetId!] : [];
  const selectedThirdPartyIds = uuidSchema.safeParse(params.thirdPartyId).success
    ? [params.thirdPartyId!]
    : [];
  const selectedParentId = uuidSchema.safeParse(params.parentId).success ? params.parentId! : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New auditable entity</h1>
        <p className="text-sm text-muted-foreground">
          Register scope boundaries and connect them to operational records.
        </p>
      </div>

      <AuditableEntityForm
        mode="create"
        action={createAuditableEntityAction}
        owners={(owners ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        parentOptions={(parents ?? []).map((parent) => ({
          id: parent.id,
          name: parent.name,
          entityType: parent.entity_type,
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
        assetOptions={(assets ?? []).map((asset) => ({
          id: asset.id,
          name: asset.name,
          assetType: asset.asset_type,
          criticality: asset.criticality,
        }))}
        thirdPartyOptions={(thirdParties ?? []).map((thirdParty) => ({
          id: thirdParty.id,
          name: thirdParty.name,
          service: thirdParty.service,
          assessmentStatus: thirdParty.assessment_status,
        }))}
        defaults={{
          entityType: "process",
          status: "active",
          ownerProfileId: profile.id,
          parentEntityId: selectedParentId,
          selectedRiskIds,
          selectedControlIds,
          selectedAssetIds,
          selectedThirdPartyIds,
        }}
        error={params.error ? decodeURIComponent(params.error) : null}
      />
    </div>
  );
}
