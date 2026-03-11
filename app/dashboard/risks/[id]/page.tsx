import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveRiskAction } from "@/app/dashboard/risks/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { CommentsSection, type CommentItem } from "@/components/comments/comments-section";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { buttonVariants } from "@/components/ui/button";
import { EvidenceListSection } from "@/components/evidence/evidence-list-section";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { getEvidenceSignedUrlById } from "@/lib/evidence/signed-url";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RiskDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  owner_profile_id: string | null;
  impact: number;
  likelihood: number;
  score: number;
  level: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type LinkedControlRow = {
  rationale: string | null;
  controls: {
    id: string;
    code: string;
    title: string;
    effectiveness_status: string;
    deleted_at: string | null;
  } | null;
};

type LinkedActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  target_date: string;
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

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
};

type RiskAcceptanceRow = {
  id: string;
  expiration_date: string;
  status: "active" | "expired" | "revoked";
};

async function getRiskById(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risks")
    .select(
      "id, title, description, category, owner_profile_id, impact, likelihood, score, level, status, due_date, created_at, updated_at",
    )
    .eq("id", riskId)
    .is("deleted_at", null)
    .maybeSingle<RiskDetail>();

  return data;
}

async function getRiskEvidence(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name, file_path, file_size, created_at")
    .eq("risk_id", riskId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<EvidenceRow[]>();

  return data ?? [];
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

async function getLinkedControls(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risk_controls")
    .select("rationale, controls(id, code, title, effectiveness_status, deleted_at)")
    .eq("risk_id", riskId)
    .returns<LinkedControlRow[]>();

  return (data ?? [])
    .filter((row) => row.controls && !row.controls.deleted_at)
    .map((row) => ({
      id: row.controls!.id,
      code: row.controls!.code,
      title: row.controls!.title,
      effectivenessStatus: row.controls!.effectiveness_status,
      rationale: row.rationale,
    }));
}

async function getLinkedActionPlans(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("action_plans")
    .select("id, title, status, priority, target_date")
    .eq("risk_id", riskId)
    .is("deleted_at", null)
    .order("target_date", { ascending: true })
    .returns<LinkedActionRow[]>();

  return data ?? [];
}

async function getLinkedAssets(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("asset_risks")
    .select("assets(id, name, asset_type, criticality, status, deleted_at)")
    .eq("risk_id", riskId)
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

async function getRiskComments(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("comments")
    .select("id, body, created_at, profiles(email, full_name)")
    .eq("entity_type", "risk")
    .eq("entity_id", riskId)
    .order("created_at", { ascending: false })
    .returns<CommentRow[]>();

  return (data ?? []).map<CommentItem>((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.created_at,
    authorLabel: comment.profiles
      ? comment.profiles.full_name
        ? `${comment.profiles.full_name} (${comment.profiles.email})`
        : comment.profiles.email
      : "Unknown user",
  }));
}

async function getRiskAcceptances(riskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risk_acceptances")
    .select("id, expiration_date, status")
    .eq("risk_id", riskId)
    .is("deleted_at", null)
    .order("expiration_date", { ascending: true })
    .limit(5)
    .returns<RiskAcceptanceRow[]>();

  return data ?? [];
}

export default async function RiskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);
  const canManageAcceptances = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;
  const risk = await getRiskById(id);

  if (!risk) {
    notFound();
  }

  const [owner, linkedControls, linkedAssets, linkedActionPlans, evidence, auditEntries, comments, riskAcceptances] = await Promise.all([
    getOwner(risk.owner_profile_id),
    getLinkedControls(risk.id),
    getLinkedAssets(risk.id),
    getLinkedActionPlans(risk.id),
    getRiskEvidence(risk.id),
    getAuditEntries("risk", risk.id),
    getRiskComments(risk.id),
    getRiskAcceptances(risk.id),
  ]);
  const evidenceDownloadUrls = await getEvidenceSignedUrlById(evidence);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{risk.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{risk.category}</p>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/risks/${risk.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveRiskAction}>
                <input type="hidden" name="riskId" value={risk.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}
      {query.success === "comment" ? (
        <FeedbackAlert variant="success" message="Comment posted." />
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{risk.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{risk.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Impact x Likelihood</p>
          <p className="mt-1 text-sm font-medium">
            {risk.impact} x {risk.likelihood}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Score / Level</p>
          <p className="mt-1 text-sm font-medium">
            {risk.score} / {risk.level}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
          <p className="mt-1 text-sm font-medium">{risk.due_date ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{new Date(risk.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(risk.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Risk acceptances</h2>
          {canManageAcceptances ? (
            <Link
              href={`/dashboard/risk-acceptances/new?riskId=${risk.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              New acceptance
            </Link>
          ) : null}
        </div>

        {riskAcceptances.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No risk acceptances linked to this risk.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {riskAcceptances.map((acceptance) => (
              <li key={acceptance.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/risk-acceptances/${acceptance.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {acceptance.status} acceptance
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  expires {acceptance.expiration_date}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked controls</h2>

        {linkedControls.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No controls linked to this risk.</p>
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
                {control.rationale ? (
                  <p className="mt-2 text-xs text-muted-foreground">{control.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Linked assets</h2>
          {canEdit ? (
            <Link
              href={`/dashboard/assets/new?riskId=${risk.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Link asset
            </Link>
          ) : null}
        </div>

        {linkedAssets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No assets linked to this risk.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedAssets.map((asset) => (
              <li key={asset.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/assets/${asset.id}`}
                  className="text-sm font-medium hover:underline"
                >
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
        <h2 className="text-lg font-semibold tracking-tight">Linked action plans</h2>

        {linkedActionPlans.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No action plans linked to this risk.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedActionPlans.map((actionPlan) => (
              <li key={actionPlan.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/actions/${actionPlan.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {actionPlan.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {actionPlan.status} | {actionPlan.priority} | target {actionPlan.target_date}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EvidenceListSection
        title="Evidence"
        emptyMessage="No evidence linked to this risk."
        items={evidence.map((item) => ({
          ...item,
          download_url: evidenceDownloadUrls.get(item.id) ?? null,
        }))}
        createHref={`/dashboard/evidence/new?riskId=${risk.id}`}
        canCreate={canEdit}
      />

      <CommentsSection
        entityType="risk"
        entityId={risk.id}
        items={comments}
        canCreate={canEdit}
      />

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
