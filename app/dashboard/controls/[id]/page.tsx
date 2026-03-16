import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createControlAttestationAction,
  createControlEvidenceRequestAction,
  updateControlAttestationAction,
  updateControlEvidenceRequestAction,
} from "@/app/dashboard/control-assurance/actions";
import { archiveControlAction } from "@/app/dashboard/controls/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { LinkedAuditableEntitiesSection } from "@/components/auditable-entities/linked-auditable-entities-section";
import {
  ControlAssuranceHistorySection,
} from "@/components/controls/control-assurance-history-section";
import {
  ControlAssuranceOverview,
} from "@/components/controls/control-assurance-overview";
import {
  ControlAttestationsSection,
} from "@/components/controls/control-attestations-section";
import {
  ControlEvidenceRequestsSection,
} from "@/components/controls/control-evidence-requests-section";
import { ControlMetadataGrid } from "@/components/controls/control-metadata-grid";
import { ControlReviewsSection } from "@/components/controls/control-reviews-section";
import { LinkedRisksSection } from "@/components/controls/linked-risks-section";
import { EvidenceListSection } from "@/components/evidence/evidence-list-section";
import { ControlFrameworkMappingsSection } from "@/components/frameworks/control-framework-mappings-section";
import { CommentsSection, type CommentItem } from "@/components/comments/comments-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditableEntitiesForControl } from "@/lib/auditable-entities/links";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import {
  deriveControlAssuranceHealth,
  evidenceRequestDisplayStatus,
  isOpenEvidenceRequest,
  isPastDate,
  toLabel,
} from "@/lib/control-assurance/health";
import { getEvidenceSignedUrlById } from "@/lib/evidence/signed-url";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ControlDetail = {
  id: string;
  code: string;
  title: string;
  description: string;
  control_type: string;
  review_frequency: string;
  effectiveness_status: string;
  next_review_date: string | null;
  owner_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type LinkedRiskRow = {
  rationale: string | null;
  risks: {
    id: string;
    title: string;
    status: string;
    level: string;
    score: number;
    deleted_at: string | null;
  } | null;
};

type EvidenceRow = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
};

type EvidenceOptionRow = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
};

type MappingRow = {
  framework_requirement_id: string;
};

type RequirementRow = {
  id: string;
  framework_id: string;
  reference_code: string;
  title: string;
};

type FrameworkRow = {
  id: string;
  code: string;
  version: string;
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

type ControlReviewRow = {
  id: string;
  status: string;
  target_date: string;
  completed_at: string | null;
};

type ControlTestRow = {
  id: string;
  result: string;
  test_period_start: string;
  test_period_end: string;
  updated_at: string;
};

type FindingRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  due_date: string | null;
  updated_at: string;
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

type ControlAttestationRow = {
  id: string;
  cycle_name: string;
  due_date: string;
  status: "pending" | "submitted" | "reviewed";
  owner_profile_id: string | null;
  attested_effectiveness_status: string | null;
  owner_comment: string | null;
  review_comment: string | null;
  attested_at: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type ControlEvidenceRequestRow = {
  id: string;
  control_attestation_id: string | null;
  title: string;
  description: string | null;
  status: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  owner_profile_id: string | null;
  due_date: string;
  evidence_id: string | null;
  response_notes: string | null;
  review_comment: string | null;
  updated_at: string;
};

function formatProfile(profile: ProfileRow | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email;
}

async function getControlById(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("controls")
    .select(
      "id, code, title, description, control_type, review_frequency, effectiveness_status, next_review_date, owner_profile_id, created_at, updated_at",
    )
    .eq("id", controlId)
    .is("deleted_at", null)
    .maybeSingle<ControlDetail>();

  return data;
}

async function getProfiles(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", organizationId)
    .order("email")
    .returns<ProfileRow[]>();

  return data ?? [];
}

async function getLinkedRisks(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risk_controls")
    .select("rationale, risks(id, title, status, level, score, deleted_at)")
    .eq("control_id", controlId)
    .returns<LinkedRiskRow[]>();

  return (data ?? [])
    .filter((row) => row.risks && !row.risks.deleted_at)
    .map((row) => ({
      id: row.risks!.id,
      title: row.risks!.title,
      status: row.risks!.status,
      level: row.risks!.level,
      score: row.risks!.score,
      rationale: row.rationale,
    }));
}

async function getControlEvidence(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name, file_path, file_size, created_at")
    .eq("control_id", controlId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<EvidenceRow[]>();

  return data ?? [];
}

async function getEvidenceOptions(organizationId: string, controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name, file_path")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .or(`control_id.eq.${controlId},control_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(120)
    .returns<EvidenceOptionRow[]>();

  return data ?? [];
}

async function getFrameworkMappings(controlId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: mappings } = await supabase
    .from("control_framework_mappings")
    .select("framework_requirement_id")
    .eq("control_id", controlId)
    .returns<MappingRow[]>();

  const requirementIds = (mappings ?? []).map((row) => row.framework_requirement_id);

  if (requirementIds.length === 0) {
    return [];
  }

  const { data: requirements } = await supabase
    .from("framework_requirements")
    .select("id, framework_id, reference_code, title")
    .in("id", requirementIds)
    .returns<RequirementRow[]>();

  const frameworkIds = Array.from(
    new Set((requirements ?? []).map((requirement) => requirement.framework_id)),
  );

  const { data: frameworks } = frameworkIds.length
    ? await supabase
        .from("frameworks")
        .select("id, code, version")
        .in("id", frameworkIds)
        .returns<FrameworkRow[]>()
    : { data: [] as FrameworkRow[] };

  const frameworkById = new Map((frameworks ?? []).map((framework) => [framework.id, framework]));

  return (requirements ?? [])
    .map((requirement) => {
      const framework = frameworkById.get(requirement.framework_id);

      return framework
        ? {
            requirementId: requirement.id,
            frameworkCode: framework.code,
            frameworkVersion: framework.version,
            referenceCode: requirement.reference_code,
            title: requirement.title,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function getControlComments(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("comments")
    .select("id, body, created_at, profiles(email, full_name)")
    .eq("entity_type", "control")
    .eq("entity_id", controlId)
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

async function getControlReviews(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_reviews")
    .select("id, status, target_date, completed_at")
    .eq("control_id", controlId)
    .is("deleted_at", null)
    .order("target_date", { ascending: true })
    .returns<ControlReviewRow[]>();

  return data ?? [];
}

async function getControlTests(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_tests")
    .select("id, result, test_period_start, test_period_end, updated_at")
    .eq("control_id", controlId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5)
    .returns<ControlTestRow[]>();

  return data ?? [];
}

async function getControlFindings(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("findings")
    .select("id, title, status, severity, due_date, updated_at")
    .eq("control_id", controlId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5)
    .returns<FindingRow[]>();

  return data ?? [];
}

async function getLinkedAssets(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("asset_controls")
    .select("assets(id, name, asset_type, criticality, status, deleted_at)")
    .eq("control_id", controlId)
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

async function getControlAttestations(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_attestations")
    .select(
      "id, cycle_name, due_date, status, owner_profile_id, attested_effectiveness_status, owner_comment, review_comment, attested_at, reviewed_at, created_at",
    )
    .eq("control_id", controlId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<ControlAttestationRow[]>();

  return data ?? [];
}

async function getControlEvidenceRequests(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("control_evidence_requests")
    .select(
      "id, control_attestation_id, title, description, status, owner_profile_id, due_date, evidence_id, response_notes, review_comment, updated_at",
    )
    .eq("control_id", controlId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .returns<ControlEvidenceRequestRow[]>();

  return data ?? [];
}

export default async function ControlDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const canArchive = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;

  const control = await getControlById(id);

  if (!control) {
    notFound();
  }

  const [
    profiles,
    linkedRisks,
    linkedAssets,
    linkedAuditableEntities,
    evidence,
    evidenceOptions,
    frameworkMappings,
    auditEntries,
    comments,
    reviews,
    controlTests,
    findings,
    attestations,
    evidenceRequests,
  ] = await Promise.all([
    getProfiles(profile.organizationId),
    getLinkedRisks(control.id),
    getLinkedAssets(control.id),
    getAuditableEntitiesForControl(control.id),
    getControlEvidence(control.id),
    getEvidenceOptions(profile.organizationId, control.id),
    getFrameworkMappings(control.id),
    getAuditEntries("control", control.id),
    getControlComments(control.id),
    getControlReviews(control.id),
    getControlTests(control.id),
    getControlFindings(control.id),
    getControlAttestations(control.id),
    getControlEvidenceRequests(control.id),
  ]);

  const evidenceDownloadUrls = await getEvidenceSignedUrlById([
    ...evidence,
    ...evidenceOptions.filter((item) => !evidence.some((existing) => existing.id === item.id)),
  ]);

  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const evidenceById = new Map(evidenceOptions.map((item) => [item.id, item]));
  const attestationById = new Map(attestations.map((item) => [item.id, item]));
  const owner = control.owner_profile_id ? profileById.get(control.owner_profile_id) ?? null : null;

  const overdueAttestations = attestations.filter(
    (item) => item.status === "pending" && isPastDate(item.due_date),
  ).length;
  const openEvidenceRequests = evidenceRequests.filter((item) => isOpenEvidenceRequest(item.status)).length;
  const overdueEvidenceRequests = evidenceRequests.filter(
    (item) => isOpenEvidenceRequest(item.status) && isPastDate(item.due_date),
  ).length;
  const health = deriveControlAssuranceHealth({
    overdueAttestations,
    overdueEvidenceRequests,
    openFindings: findings.filter((item) => item.status !== "closed").length,
    latestTestResult: controlTests[0]?.result ?? null,
    effectivenessStatus: control.effectiveness_status,
  });

  const assuranceHistoryItems = [
    ...attestations.map((item) => ({
      id: `attestation-${item.id}`,
      sortDate: item.reviewed_at ?? item.attested_at ?? item.created_at,
      typeLabel: "Attestation",
      title: item.cycle_name,
      dateLabel: new Date(item.reviewed_at ?? item.attested_at ?? item.created_at).toLocaleString(),
      href: null,
      detail: `status ${toLabel(item.status)} | due ${item.due_date}${item.attested_effectiveness_status ? ` | declared ${toLabel(item.attested_effectiveness_status)}` : ""}`,
    })),
    ...evidenceRequests.map((item) => ({
      id: `evidence-request-${item.id}`,
      sortDate: item.updated_at,
      typeLabel: "Evidence request",
      title: item.title,
      dateLabel: new Date(item.updated_at).toLocaleString(),
      href: null,
      detail: `status ${toLabel(evidenceRequestDisplayStatus({ status: item.status, dueDate: item.due_date }))} | due ${item.due_date}${item.evidence_id ? " | evidence linked" : ""}`,
    })),
    ...controlTests.map((item) => ({
      id: `control-test-${item.id}`,
      sortDate: item.updated_at,
      typeLabel: "Control test",
      title: `${toLabel(item.result)} test`,
      dateLabel: new Date(item.updated_at).toLocaleString(),
      href: `/dashboard/control-tests/${item.id}`,
      detail: `${item.test_period_start} to ${item.test_period_end}`,
    })),
    ...findings.map((item) => ({
      id: `finding-${item.id}`,
      sortDate: item.updated_at,
      typeLabel: "Finding",
      title: item.title,
      dateLabel: new Date(item.updated_at).toLocaleString(),
      href: `/dashboard/findings/${item.id}`,
      detail: `${toLabel(item.status)} | ${toLabel(item.severity)}${item.due_date ? ` | due ${item.due_date}` : ""}`,
    })),
  ]
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
    .map((item) => ({
      id: item.id,
      typeLabel: item.typeLabel,
      title: item.title,
      dateLabel: item.dateLabel,
      href: item.href,
      detail: item.detail,
    }));

  const successMessageByCode: Record<string, string> = {
    comment: "Comment posted.",
    attestation_created: "Attestation cycle created.",
    attestation_updated: "Attestation updated.",
    evidence_request_created: "Evidence request created.",
    evidence_request_updated: "Evidence request updated.",
    evidence_uploaded: "Evidence uploaded and linked to the request.",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {control.code}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{control.title}</h1>
        </div>

        {canEdit || canArchive ? (
          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/dashboard/controls/${control.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                Edit
              </Link>
            ) : null}

            {canArchive ? (
              <form action={archiveControlAction}>
                <input type="hidden" name="controlId" value={control.id} />
                <button type="submit" className={buttonVariants({ variant: "outline" })}>
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}
      {query.success ? (
        <FeedbackAlert
          variant="success"
          message={successMessageByCode[query.success] ?? "Saved."}
        />
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{control.description}</p>
      </div>

      <ControlMetadataGrid control={control} owner={owner} />

      <ControlAssuranceOverview
        health={health}
        overdueAttestations={overdueAttestations}
        openEvidenceRequests={openEvidenceRequests}
        overdueEvidenceRequests={overdueEvidenceRequests}
        openFindings={findings.filter((item) => item.status !== "closed").length}
        latestTestResult={controlTests[0]?.result ?? null}
      />

      <LinkedRisksSection items={linkedRisks} />

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Linked assets</h2>
          {canEdit ? (
            <Link
              href={`/dashboard/assets/new?controlId=${control.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Link asset
            </Link>
          ) : null}
        </div>

        {linkedAssets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No assets linked to this control.</p>
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

      <LinkedAuditableEntitiesSection
        title="Linked auditable entities"
        items={linkedAuditableEntities}
        emptyMessage="No auditable entities linked to this control."
        canCreate={canEdit}
        createHref={`/dashboard/auditable-entities/new?controlId=${control.id}`}
      />

      <ControlFrameworkMappingsSection items={frameworkMappings} />

      <ControlAttestationsSection
        canEdit={canEdit}
        controlId={control.id}
        defaultOwnerProfileId={control.owner_profile_id}
        profiles={profiles.map((item) => ({
          id: item.id,
          label: formatProfile(item),
        }))}
        attestations={attestations.map((item) => ({
          id: item.id,
          cycleName: item.cycle_name,
          dueDate: item.due_date,
          status: item.status,
          ownerProfileId: item.owner_profile_id,
          ownerLabel: formatProfile(item.owner_profile_id ? profileById.get(item.owner_profile_id) : null),
          attestedEffectivenessStatus: item.attested_effectiveness_status,
          ownerComment: item.owner_comment,
          reviewComment: item.review_comment,
          attestedAt: item.attested_at,
          reviewedAt: item.reviewed_at,
        }))}
        createAction={createControlAttestationAction}
        updateAction={updateControlAttestationAction}
      />

      <ControlEvidenceRequestsSection
        canEdit={canEdit}
        controlId={control.id}
        defaultOwnerProfileId={control.owner_profile_id}
        profiles={profiles.map((item) => ({
          id: item.id,
          label: formatProfile(item),
        }))}
        attestations={attestations.map((item) => ({
          id: item.id,
          label: `${item.cycle_name} (${toLabel(item.status)})`,
        }))}
        evidenceOptions={evidenceOptions.map((item) => ({
          id: item.id,
          label: `${item.title} (${item.file_name})`,
        }))}
        requests={evidenceRequests.map((item) => {
          const linkedEvidence = item.evidence_id ? evidenceById.get(item.evidence_id) ?? null : null;
          const linkedAttestation = item.control_attestation_id
            ? attestationById.get(item.control_attestation_id) ?? null
            : null;

          return {
            id: item.id,
            title: item.title,
            description: item.description,
            status: item.status,
            dueDate: item.due_date,
            ownerProfileId: item.owner_profile_id,
            ownerLabel: formatProfile(item.owner_profile_id ? profileById.get(item.owner_profile_id) : null),
            controlAttestationId: item.control_attestation_id,
            controlAttestationLabel: linkedAttestation
              ? `${linkedAttestation.cycle_name} (${toLabel(linkedAttestation.status)})`
              : null,
            evidenceId: item.evidence_id,
            evidenceLabel: linkedEvidence ? `${linkedEvidence.title} (${linkedEvidence.file_name})` : null,
            responseNotes: item.response_notes,
            reviewComment: item.review_comment,
            evidenceDownloadUrl: item.evidence_id ? evidenceDownloadUrls.get(item.evidence_id) ?? null : null,
          };
        })}
        createAction={createControlEvidenceRequestAction}
        updateAction={updateControlEvidenceRequestAction}
      />

      <ControlReviewsSection
        reviews={reviews.map((review) => ({
          id: review.id,
          status: review.status,
          targetDate: review.target_date,
          completedAt: review.completed_at,
        }))}
        controlId={control.id}
        canEdit={canEdit}
      />

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Control tests</h2>
          {canEdit ? (
            <Link
              href={`/dashboard/control-tests/new?controlId=${control.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              New test
            </Link>
          ) : null}
        </div>

        {controlTests.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No control tests yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {controlTests.map((test) => (
              <li key={test.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/control-tests/${test.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {test.result} test
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {test.test_period_start} to {test.test_period_end}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Findings</h2>
          {canEdit ? (
            <Link
              href={`/dashboard/findings/new?controlId=${control.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              New finding
            </Link>
          ) : null}
        </div>

        {findings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No findings linked to this control.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {findings.map((finding) => (
              <li key={finding.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/findings/${finding.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {finding.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {finding.status} / {finding.severity}
                  {finding.due_date ? ` / due ${finding.due_date}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ControlAssuranceHistorySection items={assuranceHistoryItems} />

      <EvidenceListSection
        title="Evidence"
        emptyMessage="No evidence linked to this control."
        items={evidence.map((item) => ({
          ...item,
          download_url: evidenceDownloadUrls.get(item.id) ?? null,
        }))}
        createHref={`/dashboard/evidence/new?controlId=${control.id}`}
        canCreate={canEdit}
      />

      <CommentsSection
        entityType="control"
        entityId={control.id}
        items={comments}
        canCreate={canEdit}
      />

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
