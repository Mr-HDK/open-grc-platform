import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveControlAction } from "@/app/dashboard/controls/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { EvidenceListSection } from "@/components/evidence/evidence-list-section";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
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

type OwnerDetail = {
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
  file_size: number;
  created_at: string;
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

async function getOwner(ownerId: string | null) {
  if (!ownerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ownerId)
    .maybeSingle<OwnerDetail>();

  return data;
}

async function getLinkedRisks(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("risk_controls")
    .select("rationale, risks(id, title, status, level, score, deleted_at)")
    .eq("control_id", controlId)
    .returns<LinkedRiskRow[]>();

  return (data ?? []).filter((row) => row.risks && !row.risks.deleted_at);
}

async function getControlEvidence(controlId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evidence")
    .select("id, title, file_name, file_size, created_at")
    .eq("control_id", controlId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<EvidenceRow[]>();

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

export default async function ControlDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionProfile("viewer");

  const { id } = await params;
  const query = await searchParams;

  const control = await getControlById(id);

  if (!control) {
    notFound();
  }

  const [owner, linkedRisks, evidence, frameworkMappings, auditEntries] = await Promise.all([
    getOwner(control.owner_profile_id),
    getLinkedRisks(control.id),
    getControlEvidence(control.id),
    getFrameworkMappings(control.id),
    getAuditEntries("control", control.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {control.code}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{control.title}</h1>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard/controls/${control.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit
          </Link>

          <form action={archiveControlAction}>
            <input type="hidden" name="controlId" value={control.id} />
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Archive
            </button>
          </form>
        </div>
      </div>

      {query.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(query.error)}
        </p>
      ) : null}

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Description</p>
        <p className="mt-2 whitespace-pre-line text-sm">{control.description}</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
          <p className="mt-1 text-sm font-medium">{control.control_type}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Effectiveness</p>
          <p className="mt-1 text-sm font-medium">{control.effectiveness_status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Review frequency</p>
          <p className="mt-1 text-sm font-medium">{control.review_frequency}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next review</p>
          <p className="mt-1 text-sm font-medium">{control.next_review_date ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(control.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Linked risks</h2>

        {linkedRisks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No risks linked to this control.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {linkedRisks.map((link) => (
              <li key={link.risks?.id} className="rounded-lg border p-3">
                <Link
                  href={`/dashboard/risks/${link.risks?.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {link.risks?.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {link.risks?.status} | {link.risks?.level} | score {link.risks?.score}
                </p>
                {link.rationale ? (
                  <p className="mt-2 text-xs text-muted-foreground">{link.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Framework mappings</h2>

        {frameworkMappings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No framework requirements mapped.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {frameworkMappings.map((mapping) => (
              <li key={mapping.requirementId} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {mapping.frameworkCode} {mapping.referenceCode}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{mapping.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Version {mapping.frameworkVersion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EvidenceListSection
        title="Evidence"
        emptyMessage="No evidence linked to this control."
        items={evidence}
        createHref={`/dashboard/evidence/new?controlId=${control.id}`}
      />

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
