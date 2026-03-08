import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditEntityType = "risk" | "control" | "action_plan";
export type AuditAction = "create" | "update" | "soft_delete";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  actorLabel: string;
  createdAt: string;
  summary: Record<string, unknown>;
};

type AuditRow = {
  id: string;
  action: AuditAction;
  actor_profile_id: string | null;
  change_summary: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export async function recordAuditEvent(input: {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorProfileId: string;
  organizationId: string;
  summary?: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("audit_log").insert({
    organization_id: input.organizationId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    actor_profile_id: input.actorProfileId,
    change_summary: input.summary ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getAuditEntries(entityType: AuditEntityType, entityId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, action, actor_profile_id, change_summary, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<AuditRow[]>();

  const actorIds = Array.from(
    new Set((rows ?? []).map((row) => row.actor_profile_id).filter(Boolean)),
  ) as string[];

  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", actorIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] };

  const actorById = new Map(
    (actors ?? []).map((actor) => [
      actor.id,
      actor.full_name ? `${actor.full_name} (${actor.email})` : actor.email,
    ]),
  );

  return (rows ?? []).map((row): AuditEntry => ({
    id: row.id,
    action: row.action,
    actorLabel: row.actor_profile_id ? (actorById.get(row.actor_profile_id) ?? "Unknown user") : "System",
    createdAt: row.created_at,
    summary: row.change_summary ?? {},
  }));
}
