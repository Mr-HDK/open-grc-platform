import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LinkedAuditableEntity = {
  id: string;
  name: string;
  entityType: string;
  status: string;
};

type AuditableEntityRow = {
  auditable_entities: {
    id: string;
    name: string;
    entity_type: string;
    status: string;
    deleted_at: string | null;
  } | null;
};

function mapLinkedAuditableEntities(rows: AuditableEntityRow[]) {
  return rows
    .filter((row) => row.auditable_entities && !row.auditable_entities.deleted_at)
    .map((row) => ({
      id: row.auditable_entities!.id,
      name: row.auditable_entities!.name,
      entityType: row.auditable_entities!.entity_type,
      status: row.auditable_entities!.status,
    }));
}

export async function getAuditableEntitiesForRisk(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_risks")
    .select("auditable_entities(id, name, entity_type, status, deleted_at)")
    .eq("risk_id", riskId)
    .returns<AuditableEntityRow[]>();

  return mapLinkedAuditableEntities(data ?? []);
}

export async function getAuditableEntitiesForControl(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_controls")
    .select("auditable_entities(id, name, entity_type, status, deleted_at)")
    .eq("control_id", controlId)
    .returns<AuditableEntityRow[]>();

  return mapLinkedAuditableEntities(data ?? []);
}

export async function getAuditableEntitiesForAsset(assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_assets")
    .select("auditable_entities(id, name, entity_type, status, deleted_at)")
    .eq("asset_id", assetId)
    .returns<AuditableEntityRow[]>();

  return mapLinkedAuditableEntities(data ?? []);
}

export async function getAuditableEntitiesForThirdParty(thirdPartyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_third_parties")
    .select("auditable_entities(id, name, entity_type, status, deleted_at)")
    .eq("third_party_id", thirdPartyId)
    .returns<AuditableEntityRow[]>();

  return mapLinkedAuditableEntities(data ?? []);
}
