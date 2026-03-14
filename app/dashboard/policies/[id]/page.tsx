import Link from "next/link";
import { notFound } from "next/navigation";

import {
  acknowledgePolicyAction,
  archivePolicyAction,
  publishPolicyAction,
} from "@/app/dashboard/policies/actions";
import { AuditLogSection } from "@/components/audit/audit-log-section";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { getAuditEntries } from "@/lib/audit/log";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PolicyDetail = {
  id: string;
  title: string;
  version: string;
  status: string;
  effective_date: string;
  owner_profile_id: string | null;
  content: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string | null;
};

type AttestationRow = {
  id: string;
  profile_id: string;
  acknowledged_at: string;
};

async function getPolicyById(policyId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("policies")
    .select("id, title, version, status, effective_date, owner_profile_id, content, published_at, created_at, updated_at")
    .eq("id", policyId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<PolicyDetail>();

  return data;
}

async function getOwner(ownerId: string | null, organizationId: string) {
  if (!ownerId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, status")
    .eq("id", ownerId)
    .eq("organization_id", organizationId)
    .maybeSingle<ProfileRow>();

  return data;
}

export default async function PolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);

  const { id } = await params;
  const query = await searchParams;

  const policy = await getPolicyById(id, profile.organizationId);

  if (!policy) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const [owner, allProfilesResult, attestationsResult, auditEntries] = await Promise.all([
    getOwner(policy.owner_profile_id, profile.organizationId),
    supabase
      .from("profiles")
      .select("id, email, full_name, status")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<ProfileRow[]>(),
    supabase
      .from("policy_attestations")
      .select("id, profile_id, acknowledged_at")
      .eq("organization_id", profile.organizationId)
      .eq("policy_id", policy.id)
      .returns<AttestationRow[]>(),
    getAuditEntries("policy", policy.id),
  ]);

  const allProfiles = allProfilesResult.data ?? [];
  const attestations = attestationsResult.data ?? [];

  const audienceProfiles = allProfiles.filter(
    (item) => item.status !== "deactivated" && item.status !== "invited",
  );

  const attestationByProfileId = new Map(attestations.map((attestation) => [attestation.profile_id, attestation]));

  const confirmedProfiles = audienceProfiles.filter((item) => attestationByProfileId.has(item.id));
  const missingProfiles = audienceProfiles.filter((item) => !attestationByProfileId.has(item.id));

  const ownAttestation = attestationByProfileId.get(profile.id) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{policy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Version {policy.version}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Link href={`/dashboard/policies/${policy.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              Edit
            </Link>
          ) : null}

          {canManage && policy.status !== "active" ? (
            <form action={publishPolicyAction}>
              <input type="hidden" name="policyId" value={policy.id} />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Publish
              </button>
            </form>
          ) : null}

          {canManage && policy.status !== "archived" ? (
            <form action={archivePolicyAction}>
              <input type="hidden" name="policyId" value={policy.id} />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Archive
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {query.error ? <FeedbackAlert message={decodeURIComponent(query.error)} /> : null}
      {query.success === "published" ? (
        <FeedbackAlert variant="success" message="Policy published as active version." />
      ) : null}
      {query.success === "archived" ? (
        <FeedbackAlert variant="success" message="Policy archived." />
      ) : null}
      {query.success === "acknowledged" ? (
        <FeedbackAlert variant="success" message="Attestation recorded." />
      ) : null}

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">{policy.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Effective date</p>
          <p className="mt-1 text-sm font-medium">{policy.effective_date}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 text-sm font-medium">
            {owner ? (owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Published at</p>
          <p className="mt-1 text-sm font-medium">
            {policy.published_at ? new Date(policy.published_at).toLocaleString() : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
          <p className="mt-1 text-sm font-medium">{new Date(policy.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Attestation</h2>
          {policy.status === "active" ? (
            <form action={acknowledgePolicyAction}>
              <input type="hidden" name="policyId" value={policy.id} />
              <button type="submit" className={buttonVariants()}>
                Acknowledge policy
              </button>
            </form>
          ) : null}
        </div>

        {ownAttestation ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You acknowledged this policy on {new Date(ownAttestation.acknowledged_at).toLocaleString()}.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {policy.status === "active"
              ? "You have not acknowledged this policy yet."
              : "Policy must be active before acknowledgements are allowed."}
          </p>
        )}

        {canManage ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Audience</p>
                <p className="text-lg font-semibold">{audienceProfiles.length}</p>
              </article>
              <article className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Confirmed</p>
                <p className="text-lg font-semibold">{confirmedProfiles.length}</p>
              </article>
              <article className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Missing</p>
                <p className="text-lg font-semibold">{missingProfiles.length}</p>
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Confirmed users</h3>
                {confirmedProfiles.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No attestations yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-xs">
                    {confirmedProfiles.map((item) => (
                      <li key={item.id} className="rounded border px-2 py-1">
                        {item.full_name ? `${item.full_name} (${item.email})` : item.email}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Missing users</h3>
                {missingProfiles.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Full coverage reached.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-xs">
                    {missingProfiles.map((item) => (
                      <li key={item.id} className="rounded border px-2 py-1">
                        {item.full_name ? `${item.full_name} (${item.email})` : item.email}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Content</h2>
        <p className="mt-3 whitespace-pre-line text-sm">{policy.content ?? "-"}</p>
      </section>

      <AuditLogSection items={auditEntries} />
    </div>
  );
}
