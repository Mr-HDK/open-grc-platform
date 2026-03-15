import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveAssetAction } from "@/app/dashboard/assets/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { LinkedAuditableEntitiesSection } from "@/components/auditable-entities/linked-auditable-entities-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditableEntitiesForAsset } from "@/lib/auditable-entities/links";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AssetDetail = {
  id: string;
  name: string;
  asset_type: string;
  criticality: string;
  status: string;
  owner_profile_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
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

async function getAssetById(assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assets")
    .select("id, name, asset_type, criticality, status, owner_profile_id, description, created_at, updated_at")
    .eq("id", assetId)
    .is("deleted_at", null)
    .maybeSingle<AssetDetail>();

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
    .maybeSingle<OwnerRow>();

  return data;
}

async function getLinkedRisks(assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("asset_risks")
    .select("risks(id, title, status, level, score, deleted_at)")
    .eq("asset_id", assetId)
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

async function getLinkedControls(assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("asset_controls")
    .select("controls(id, code, title, effectiveness_status, deleted_at)")
    .eq("asset_id", assetId)
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

export default async function AssetDetailPage({
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

  const asset = await getAssetById(id);

  if (!asset) {
    notFound();
  }

  const [owner, linkedRisks, linkedControls, linkedAuditableEntities, auditEntries] = await Promise.all([
    getOwner(asset.owner_profile_id),
    getLinkedRisks(asset.id),
    getLinkedControls(asset.id),
    getAuditableEntitiesForAsset(asset.id),
    getAuditEntries("asset", asset.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{asset.asset_type}</p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/assets/${asset.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveAssetAction}>
                <input type="hidden" name="assetId" value={asset.id} />
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
        <p className="mt-2 whitespace-pre-line text-sm">{asset.description ?? "-"}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Criticality</p>
          <p className="mt-1 text-sm font-medium">{asset.criticality}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{asset.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(asset.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(asset.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked risks</h2>

        {linkedRisks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No risks linked to this asset.</p>
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
          <p className="mt-3 text-sm text-muted-foreground">No controls linked to this asset.</p>
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

      <LinkedAuditableEntitiesSection
        title="Linked auditable entities"
        items={linkedAuditableEntities}
        emptyMessage="No auditable entities linked to this asset."
        canCreate={canEdit}
        createHref={`/dashboard/auditable-entities/new?assetId=${asset.id}`}
      />

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
