import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPolicyStatus, policyStatusOptions } from "@/lib/validators/policy";
import { cn } from "@/lib/utils/cn";

type PolicyRow = {
  id: string;
  title: string;
  version: string;
  status: string;
  effective_date: string;
  owner_profile_id: string | null;
  published_at: string | null;
  updated_at: string;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string | null;
};

type AttestationRow = {
  policy_id: string;
  profile_id: string;
};

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; owner?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = isPolicyStatus(params.status) ? params.status : "";
  const owner = z.string().uuid().safeParse(params.owner).success ? (params.owner ?? "") : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("policies")
    .select("id, title, version, status, effective_date, owner_profile_id, published_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,version.ilike.%${q}%`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (owner) {
    query = query.eq("owner_profile_id", owner);
  }

  const [{ data: policies, error }, { data: owners }, { data: attestations }] = await Promise.all([
    query.returns<PolicyRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name, status")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
    supabase
      .from("policy_attestations")
      .select("policy_id, profile_id")
      .eq("organization_id", profile.organizationId)
      .returns<AttestationRow[]>(),
  ]);

  const ownerById = new Map(
    (owners ?? []).map((item) => [item.id, item.full_name ? `${item.full_name} (${item.email})` : item.email]),
  );

  const activeProfiles = (owners ?? []).filter((item) => item.status !== "deactivated");
  const audienceProfileIds = new Set(activeProfiles.map((item) => item.id));
  const totalAudience = activeProfiles.length;

  const attestationCountByPolicy = new Map<string, number>();

  for (const attestation of attestations ?? []) {
    if (!audienceProfileIds.has(attestation.profile_id)) {
      continue;
    }

    attestationCountByPolicy.set(
      attestation.policy_id,
      (attestationCountByPolicy.get(attestation.policy_id) ?? 0) + 1,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Manage policy versions and track user attestation coverage.
          </p>
        </div>
        {canManage ? (
          <Link href="/dashboard/policies/new" className={buttonVariants()}>
            New policy
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input name="q" placeholder="Search by title or version" defaultValue={q} />

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {policyStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="owner"
          aria-label="Filter by owner"
          defaultValue={owner}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All owners</option>
          {(owners ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name ? `${item.full_name} (${item.email})` : item.email}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <caption className="sr-only">Policy register results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Version
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Effective date
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Attestations
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(policies ?? []).map((policy) => {
              const attestationCount = attestationCountByPolicy.get(policy.id) ?? 0;
              return (
                <tr key={policy.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/policies/${policy.id}`} className="font-medium hover:underline">
                      {policy.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{policy.version}</td>
                  <td className="px-4 py-3">{policy.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">{policy.effective_date}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {policy.owner_profile_id ? ownerById.get(policy.owner_profile_id) ?? "Unknown" : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {attestationCount}/{totalAudience}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(policy.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}

            {!error && (policies?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No policies found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
