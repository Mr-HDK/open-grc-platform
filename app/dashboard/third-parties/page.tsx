import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assetCriticalityOptions } from "@/lib/validators/asset";
import {
  isThirdPartyAssessmentStatus,
  isThirdPartyCriticality,
  thirdPartyAssessmentStatusOptions,
} from "@/lib/validators/third-party";
import { cn } from "@/lib/utils/cn";

type ThirdPartyRow = {
  id: string;
  name: string;
  service: string;
  criticality: string;
  assessment_status: string;
  assessment_score: number;
  owner_profile_id: string | null;
  next_review_date: string | null;
  updated_at: string;
};

type OwnerRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export default async function ThirdPartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    criticality?: string;
    owner?: string;
    due?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = isThirdPartyAssessmentStatus(params.status) ? params.status : "";
  const criticality = isThirdPartyCriticality(params.criticality) ? params.criticality : "";
  const owner = z.string().uuid().safeParse(params.owner).success ? (params.owner ?? "") : "";
  const due = params.due === "overdue" || params.due === "next_30_days" ? params.due : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("third_parties")
    .select("id, name, service, criticality, assessment_status, assessment_score, owner_profile_id, next_review_date, updated_at")
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

  if (owner) {
    query = query.eq("owner_profile_id", owner);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const next30Iso = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  if (due === "overdue") {
    query = query.not("next_review_date", "is", null).lt("next_review_date", todayIso);
  }

  if (due === "next_30_days") {
    query = query
      .not("next_review_date", "is", null)
      .gte("next_review_date", todayIso)
      .lte("next_review_date", next30Iso);
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
            Track vendor risk posture, linked entities, and review cycles.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/third-parties/new" className={buttonVariants()}>
            New vendor
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6">
        <Input name="q" placeholder="Search by vendor or service" defaultValue={q} />

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
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
          name="due"
          aria-label="Filter by review due"
          defaultValue={due}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All review windows</option>
          <option value="overdue">Overdue</option>
          <option value="next_30_days">Next 30 days</option>
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}> 
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
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
                Criticality
              </th>
              <th scope="col" className="px-4 py-3">
                Status / Score
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
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
                  <Link
                    href={`/dashboard/third-parties/${thirdParty.id}`}
                    className="font-medium hover:underline"
                  >
                    {thirdParty.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{thirdParty.service}</td>
                <td className="px-4 py-3">{thirdParty.criticality}</td>
                <td className="px-4 py-3">
                  {thirdParty.assessment_status} / {thirdParty.assessment_score}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {thirdParty.owner_profile_id ? ownerById.get(thirdParty.owner_profile_id) ?? "Unknown" : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{thirdParty.next_review_date ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(thirdParty.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}

            {!error && (thirdParties?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
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
