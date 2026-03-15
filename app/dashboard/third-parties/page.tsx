import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isThirdPartyAssessmentStatus,
  isThirdPartyCriticality,
  isThirdPartyTier,
  thirdPartyAssessmentStatusOptions,
  thirdPartyTierOptions,
} from "@/lib/validators/third-party";
import { assetCriticalityOptions } from "@/lib/validators/asset";
import { cn } from "@/lib/utils/cn";

type ThirdPartyRow = {
  id: string;
  name: string;
  service: string;
  tier: string;
  criticality: string;
  assessment_status: string;
  assessment_score: number;
  owner_profile_id: string | null;
  renewal_date: string | null;
  next_review_date: string | null;
  updated_at: string;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

const renewalHorizonOptions = ["overdue", "next_30_days", "next_90_days", "missing"] as const;
type RenewalHorizon = (typeof renewalHorizonOptions)[number];

function isRenewalHorizon(value: string | undefined): value is RenewalHorizon {
  return Boolean(value && renewalHorizonOptions.includes(value as RenewalHorizon));
}

export default async function ThirdPartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    criticality?: string;
    tier?: string;
    owner?: string;
    renewal?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = isThirdPartyAssessmentStatus(params.status) ? params.status : "";
  const criticality = isThirdPartyCriticality(params.criticality) ? params.criticality : "";
  const tier = isThirdPartyTier(params.tier) ? params.tier : "";
  const owner = z.string().uuid().safeParse(params.owner).success ? (params.owner ?? "") : "";
  const renewal = isRenewalHorizon(params.renewal) ? params.renewal : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("third_parties")
    .select(
      "id, name, service, tier, criticality, assessment_status, assessment_score, owner_profile_id, renewal_date, next_review_date, updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,service.ilike.%${q}%`);
  }

  if (status) {
    query = query.eq("assessment_status", status);
  }

  if (criticality) {
    query = query.eq("criticality", criticality);
  }

  if (tier) {
    query = query.eq("tier", tier);
  }

  if (owner) {
    query = query.eq("owner_profile_id", owner);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const next30Iso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const next90Iso = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  if (renewal === "overdue") {
    query = query.not("renewal_date", "is", null).lt("renewal_date", todayIso);
  }

  if (renewal === "next_30_days") {
    query = query
      .not("renewal_date", "is", null)
      .gte("renewal_date", todayIso)
      .lte("renewal_date", next30Iso);
  }

  if (renewal === "next_90_days") {
    query = query
      .not("renewal_date", "is", null)
      .gte("renewal_date", todayIso)
      .lte("renewal_date", next90Iso);
  }

  if (renewal === "missing") {
    query = query.is("renewal_date", null);
  }

  const [{ data: thirdParties, error }, { data: owners }] = await Promise.all([
    query.returns<ThirdPartyRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("organization_id", profile.organizationId)
      .order("email")
      .returns<OwnerRow[]>(),
  ]);

  const ownerById = new Map(
    (owners ?? []).map((item) => [item.id, item.full_name ? `${item.full_name} (${item.email})` : item.email]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Third-party risk</h1>
          <p className="text-sm text-muted-foreground">
            Track vendor posture, review status, renewal horizon, and linked entities.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/third-parties/new" className={buttonVariants()}>
            New vendor
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-7">
        <Input name="q" placeholder="Search by vendor or service" defaultValue={q} />

        <select
          name="tier"
          aria-label="Filter by tier"
          defaultValue={tier}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All tiers</option>
          {thirdPartyTierOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="status"
          aria-label="Filter by review status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All review statuses</option>
          {thirdPartyAssessmentStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="criticality"
          aria-label="Filter by criticality"
          defaultValue={criticality}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All criticalities</option>
          {assetCriticalityOptions.map((option) => (
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

        <select
          name="renewal"
          aria-label="Filter by renewal horizon"
          defaultValue={renewal}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All renewal horizons</option>
          <option value="overdue">Overdue</option>
          <option value="next_30_days">Next 30 days</option>
          <option value="next_90_days">Next 90 days</option>
          <option value="missing">Missing renewal date</option>
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <caption className="sr-only">Third-party register results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Vendor
              </th>
              <th scope="col" className="px-4 py-3">
                Service
              </th>
              <th scope="col" className="px-4 py-3">
                Tier / Criticality
              </th>
              <th scope="col" className="px-4 py-3">
                Review posture
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Renewal
              </th>
              <th scope="col" className="px-4 py-3">
                Next review
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {(thirdParties ?? []).map((thirdParty) => (
              <tr key={thirdParty.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/third-parties/${thirdParty.id}`} className="font-medium hover:underline">
                    {thirdParty.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{thirdParty.service}</td>
                <td className="px-4 py-3">
                  {thirdParty.tier} / {thirdParty.criticality}
                </td>
                <td className="px-4 py-3">
                  {thirdParty.assessment_status} / {thirdParty.assessment_score}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {thirdParty.owner_profile_id ? ownerById.get(thirdParty.owner_profile_id) ?? "Unknown" : "-"}
                </td>
                <td className={`px-4 py-3 ${thirdParty.renewal_date && thirdParty.renewal_date < todayIso ? "text-rose-600" : "text-muted-foreground"}`}>
                  {thirdParty.renewal_date ?? "-"}
                </td>
                <td className={`px-4 py-3 ${thirdParty.next_review_date && thirdParty.next_review_date < todayIso ? "text-rose-600" : "text-muted-foreground"}`}>
                  {thirdParty.next_review_date ?? "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(thirdParty.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (thirdParties?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                  No vendors found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
