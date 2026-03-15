import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveAuditableEntityAction } from "@/app/dashboard/auditable-entities/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { LinkedAuditableEntitiesSection } from "@/components/auditable-entities/linked-auditable-entities-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditableEntityDetail = {
  id: string;
  name: string;
  entity_type: string;
  status: string;
  owner_profile_id: string | null;
  parent_entity_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type ChildRow = {
  id: string;
  name: string;
  entity_type: string;
  status: string;
};

type LinkedRiskRow = {
  risks: {
    id: string;
    title: string;
    status: string;
    level: string;
    score: number;
    deleted_at: string | null;
  } | null;
};

type LinkedControlRow = {
  controls: {
    id: string;
    code: string;
    title: string;
    effectiveness_status: string;
    deleted_at: string | null;
  } | null;
};

type LinkedAssetRow = {
  assets: {
    id: string;
    name: string;
    asset_type: string;
    criticality: string;
    status: string;
    deleted_at: string | null;
  } | null;
};

type LinkedThirdPartyRow = {
  third_parties: {
    id: string;
    name: string;
    service: string;
    assessment_status: string;
    deleted_at: string | null;
  } | null;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

async function getAuditableEntityById(entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select(
      "id, name, entity_type, status, owner_profile_id, parent_entity_id, description, created_at, updated_at",
    )
    .eq("id", entityId)
    .is("deleted_at", null)
    .maybeSingle<AuditableEntityDetail>();

  return data;
}

async function getOwner(ownerId: string | null) {
  if (!ownerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ownerId)
    .maybeSingle<ProfileRow>();

  return data;
}

async function getParent(parentId: string | null) {
  if (!parentId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select("id, name, entity_type, status")
    .eq("id", parentId)
    .is("deleted_at", null)
    .maybeSingle<ChildRow>();

  return data;
}

async function getChildren(entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entities")
    .select("id, name, entity_type, status")
    .eq("parent_entity_id", entityId)
    .is("deleted_at", null)
    .order("name")
    .returns<ChildRow[]>();

  return (data ?? []).map((child) => ({
    id: child.id,
    name: child.name,
    entityType: child.entity_type,
    status: child.status,
  }));
}

async function getLinkedRisks(entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_risks")
    .select("risks(id, title, status, level, score, deleted_at)")
    .eq("auditable_entity_id", entityId)
    .returns<LinkedRiskRow[]>();

  return (data ?? [])
    .filter((row) => row.risks && !row.risks.deleted_at)
    .map((row) => ({
      id: row.risks!.id,
      title: row.risks!.title,
      status: row.risks!.status,
      level: row.risks!.level,
      score: row.risks!.score,
    }));
}

async function getLinkedControls(entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_controls")
    .select("controls(id, code, title, effectiveness_status, deleted_at)")
    .eq("auditable_entity_id", entityId)
    .returns<LinkedControlRow[]>();

  return (data ?? [])
    .filter((row) => row.controls && !row.controls.deleted_at)
    .map((row) => ({
      id: row.controls!.id,
      code: row.controls!.code,
      title: row.controls!.title,
      effectivenessStatus: row.controls!.effectiveness_status,
    }));
}

async function getLinkedAssets(entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_assets")
    .select("assets(id, name, asset_type, criticality, status, deleted_at)")
    .eq("auditable_entity_id", entityId)
    .returns<LinkedAssetRow[]>();

  return (data ?? [])
    .filter((row) => row.assets && !row.assets.deleted_at)
    .map((row) => ({
      id: row.assets!.id,
      name: row.assets!.name,
      assetType: row.assets!.asset_type,
      criticality: row.assets!.criticality,
      status: row.assets!.status,
    }));
}

async function getLinkedThirdParties(entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("auditable_entity_third_parties")
    .select("third_parties(id, name, service, assessment_status, deleted_at)")
    .eq("auditable_entity_id", entityId)
    .returns<LinkedThirdPartyRow[]>();

  return (data ?? [])
    .filter((row) => row.third_parties && !row.third_parties.deleted_at)
    .map((row) => ({
      id: row.third_parties!.id,
      name: row.third_parties!.name,
      service: row.third_parties!.service,
      assessmentStatus: row.third_parties!.assessment_status,
    }));
}

export default async function AuditableEntityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;

  const entity = await getAuditableEntityById(id);

  if (!entity) {
    notFound();
  }

  const [owner, parent, children, linkedRisks, linkedControls, linkedAssets, linkedThirdParties, auditEntries] =
    await Promise.all([
      getOwner(entity.owner_profile_id),
      getParent(entity.parent_entity_id),
      getChildren(entity.id),
      getLinkedRisks(entity.id),
      getLinkedControls(entity.id),
      getLinkedAssets(entity.id),
      getLinkedThirdParties(entity.id),
      getAuditEntries("auditable_entity", entity.id),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{entity.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatLabel(entity.entity_type)} | {entity.status}
          </p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/auditable-entities/${entity.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveAuditableEntityAction}>
                <input type="hidden" name="auditableEntityId" value={entity.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{entity.description ?? "-"}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
          <p className="mt-1 text-sm font-medium">{formatLabel(entity.entity_type)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{entity.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Parent</p>
          <p className="mt-1 text-sm font-medium">
            {parent ? `${parent.name} (${formatLabel(parent.entity_type)})` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(entity.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(entity.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <LinkedAuditableEntitiesSection
        title="Child entities"
        items={children}
        emptyMessage="No child entities linked to this record."
        canCreate={canEdit}
        createHref={`/dashboard/auditable-entities/new?parentId=${entity.id}`}
        createLabel="Add child"
      />

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked risks</h2>

        {linkedRisks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No risks linked to this entity.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedRisks.map((risk) => (
              <li key={risk.id} className="rounded-lg border p-3">
                <Link href={`/dashboard/risks/${risk.id}`} className="text-sm font-medium hover:underline">
                  {risk.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {risk.status} / {risk.level} / score {risk.score}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked controls</h2>

        {linkedControls.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No controls linked to this entity.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedControls.map((control) => (
              <li key={control.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/controls/${control.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {control.code} - {control.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  effectiveness {control.effectivenessStatus}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked assets</h2>

        {linkedAssets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No assets linked to this entity.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedAssets.map((asset) => (
              <li key={asset.id} className="rounded-lg border p-3">
                <Link href={`/dashboard/assets/${asset.id}`} className="text-sm font-medium hover:underline">
                  {asset.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {asset.assetType} | {asset.criticality} | {asset.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked third parties</h2>

        {linkedThirdParties.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No third parties linked to this entity.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedThirdParties.map((thirdParty) => (
              <li key={thirdParty.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/third-parties/${thirdParty.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {thirdParty.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {thirdParty.service} | {thirdParty.assessmentStatus}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
