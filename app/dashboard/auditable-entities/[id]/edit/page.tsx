import { notFound } from "next/navigation";

import { updateAuditableEntityAction } from "@/app/dashboard/auditable-entities/actions";
import { AuditableEntityForm } from "@/components/auditable-entities/auditable-entity-form";
import { requireSessionProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isAuditableEntityStatus,
  isAuditableEntityType,
  type AuditableEntityStatus,
  type AuditableEntityType,
} from "@/lib/validators/auditable-entity";

type AuditableEntityRow = {
  id: string;
  name: string;
  entity_type: string;
  status: string;
  owner_profile_id: string | null;
  parent_entity_id: string | null;
  description: string | null;
};

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

type EntityRiskRow = {
  risk_id: string;
};

type EntityControlRow = {
  control_id: string;
};

type EntityAssetRow = {
  asset_id: string;
};

type EntityThirdPartyRow = {
  third_party_id: string;
};

async function getAuditableEntity(entityId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select("id, name, entity_type, status, owner_profile_id, parent_entity_id, description")
    .eq("id", entityId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<AuditableEntityRow>();

  return data;
}

export default async function EditAuditableEntityPage({
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
    entity,
    ownersResult,
    parentsResult,
    risksResult,
    controlsResult,
    assetsResult,
    thirdPartiesResult,
    entityRisksResult,
    entityControlsResult,
    entityAssetsResult,
    entityThirdPartiesResult,
  ] = await Promise.all([
    getAuditableEntity(id, profile.organizationId),
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
      .neq("id", id)
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
    supabase
      .from("auditable_entity_risks")
      .select("risk_id")
      .eq("auditable_entity_id", id)
      .returns<EntityRiskRow[]>(),
    supabase
      .from("auditable_entity_controls")
      .select("control_id")
      .eq("auditable_entity_id", id)
      .returns<EntityControlRow[]>(),
    supabase
      .from("auditable_entity_assets")
      .select("asset_id")
      .eq("auditable_entity_id", id)
      .returns<EntityAssetRow[]>(),
    supabase
      .from("auditable_entity_third_parties")
      .select("third_party_id")
      .eq("auditable_entity_id", id)
      .returns<EntityThirdPartyRow[]>(),
  ]);

  if (!entity) {
    notFound();
  }

  const entityType: AuditableEntityType = isAuditableEntityType(entity.entity_type)
    ? entity.entity_type
    : "process";
  const status: AuditableEntityStatus = isAuditableEntityStatus(entity.status)
    ? entity.status
    : "active";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit auditable entity</h1>
        <p className="text-sm text-muted-foreground">
          Update scope metadata and linked operational records.
        </p>
      </div>

      <AuditableEntityForm
        mode="edit"
        action={updateAuditableEntityAction}
        owners={(ownersResult.data ?? []).map((owner) => ({
          id: owner.id,
          label: owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email,
        }))}
        parentOptions={(parentsResult.data ?? []).map((parent) => ({
          id: parent.id,
          name: parent.name,
          entityType: parent.entity_type,
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
        assetOptions={(assetsResult.data ?? []).map((asset) => ({
          id: asset.id,
          name: asset.name,
          assetType: asset.asset_type,
          criticality: asset.criticality,
        }))}
        thirdPartyOptions={(thirdPartiesResult.data ?? []).map((thirdParty) => ({
          id: thirdParty.id,
          name: thirdParty.name,
          service: thirdParty.service,
          assessmentStatus: thirdParty.assessment_status,
        }))}
        defaults={{
          auditableEntityId: entity.id,
          name: entity.name,
          entityType,
          status,
          ownerProfileId: entity.owner_profile_id,
          parentEntityId: entity.parent_entity_id,
          description: entity.description,
          selectedRiskIds: (entityRisksResult.data ?? []).map((row) => row.risk_id),
          selectedControlIds: (entityControlsResult.data ?? []).map((row) => row.control_id),
          selectedAssetIds: (entityAssetsResult.data ?? []).map((row) => row.asset_id),
          selectedThirdPartyIds: (entityThirdPartiesResult.data ?? []).map((row) => row.third_party_id),
        }}
        error={query.error ? decodeURIComponent(query.error) : null}
      />
    </div>
  );
}
