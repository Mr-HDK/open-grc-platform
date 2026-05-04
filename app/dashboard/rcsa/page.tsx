import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRcsaCampaignStatus,
  isRcsaResult,
  rcsaCampaignStatusOptions,
  rcsaResultOptions,
  type RcsaCampaignStatus,
  type RcsaResult,
} from "@/lib/validators/rcsa";
import { cn } from "@/lib/utils/cn";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type RcsaCampaignListRow = {
  id: string;
  title: string;
  status: RcsaCampaignStatus;
  owner_profile_id: string | null;
  period_start_date: string | null;
  period_end_date: string | null;
  due_date: string | null;
  score: number | null;
  result: RcsaResult | null;
  updated_at: string;
  auditable_entities: { name: string } | null;
  risks: { title: string } | null;
  controls: { code: string; title: string } | null;
  owner: ProfileRow | null;
};

type RcsaPeriodRow = {
  period_start_date: string | null;
  period_end_date: string | null;
};

function formatProfile(profile: ProfileRow | null) {
  if (!profile) {
    return "-";
  }

  return profile.full_name
    ? `${profile.full_name} (${profile.email})`
    : profile.email;
}

function formatPeriod(
  campaign: Pick<RcsaCampaignListRow, "period_start_date" | "period_end_date">,
) {
  if (!campaign.period_start_date && !campaign.period_end_date) {
    return "-";
  }

  return `${campaign.period_start_date ?? "unspecified"} to ${campaign.period_end_date ?? "unspecified"}`;
}

function formatScope(campaign: RcsaCampaignListRow) {
  const parts = [
    campaign.auditable_entities?.name,
    campaign.risks?.title,
    campaign.controls
      ? `${campaign.controls.code} - ${campaign.controls.title}`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Owner-scoped";
}

export default async function RcsaPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    owner?: string;
    period?: string;
    score?: string;
    error?: string;
  }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canManage = hasRole("manager", profile.role);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const status = isRcsaCampaignStatus(params.status) ? params.status : "";
  const score = isRcsaResult(params.score) ? params.score : "";
  const owner = z.string().uuid().safeParse(params.owner).success
    ? (params.owner ?? "")
    : "";
  const period = /^\d{4}$/.test(params.period ?? "")
    ? (params.period ?? "")
    : "";

  let query = supabase
    .from("rcsa_campaigns")
    .select(
      "id, title, status, owner_profile_id, period_start_date, period_end_date, due_date, score, result, updated_at, auditable_entities(name), risks(title), controls(code, title), owner:profiles!rcsa_campaigns_owner_profile_id_fkey(id, email, full_name)",
    )
    .eq("organization_id", profile.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (owner) {
    query = query.eq("owner_profile_id", owner);
  }

  if (period) {
    query = query
      .gte("period_start_date", `${period}-01-01`)
      .lte("period_start_date", `${period}-12-31`);
  }

  if (score) {
    query = query.eq("result", score);
  }

  const [{ data: campaigns, error }, { data: owners }, { data: periods }] =
    await Promise.all([
      query.returns<RcsaCampaignListRow[]>(),
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("organization_id", profile.organizationId)
        .order("email")
        .returns<ProfileRow[]>(),
      supabase
        .from("rcsa_campaigns")
        .select("period_start_date, period_end_date")
        .eq("organization_id", profile.organizationId)
        .is("deleted_at", null)
        .returns<RcsaPeriodRow[]>(),
    ]);

  const periodYears = Array.from(
    new Set(
      (periods ?? [])
        .flatMap((item) => [item.period_start_date, item.period_end_date])
        .filter((value): value is string => Boolean(value))
        .map((value) => value.slice(0, 4)),
    ),
  ).sort((left, right) => Number(right) - Number(left));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Risk control self-assessments
          </h1>
          <p className="text-sm text-muted-foreground">
            Launch scoped RCSA campaigns, collect owner responses, and turn weak
            results into issues or action plans.
          </p>
        </div>

        {canManage ? (
          <Link href="/dashboard/rcsa/new" className={buttonVariants()}>
            New campaign
          </Link>
        ) : null}
      </div>

      {params.error ? (
        <FeedbackAlert message={decodeURIComponent(params.error)} />
      ) : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <select
          name="status"
          aria-label="Filter RCSA by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {rcsaCampaignStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="owner"
          aria-label="Filter RCSA by owner"
          defaultValue={owner}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All owners</option>
          {(owners ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {formatProfile(item)}
            </option>
          ))}
        </select>

        <select
          name="period"
          aria-label="Filter RCSA by period"
          defaultValue={period}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All periods</option>
          {periodYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          name="score"
          aria-label="Filter RCSA by score"
          defaultValue={score}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All scores</option>
          {rcsaResultOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
          <caption className="sr-only">RCSA campaign results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Campaign
              </th>
              <th scope="col" className="px-4 py-3">
                Scope
              </th>
              <th scope="col" className="px-4 py-3">
                Owner
              </th>
              <th scope="col" className="px-4 py-3">
                Period
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Score
              </th>
              <th scope="col" className="px-4 py-3">
                Due
              </th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((campaign) => (
              <tr key={campaign.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/rcsa/${campaign.id}`}
                    className="font-medium hover:underline"
                  >
                    {campaign.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(campaign.updated_at).toLocaleDateString()}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatScope(campaign)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatProfile(campaign.owner)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatPeriod(campaign)}
                </td>
                <td className="px-4 py-3">{campaign.status}</td>
                <td className="px-4 py-3">
                  {campaign.score === null
                    ? "-"
                    : `${campaign.score} (${campaign.result ?? "unscored"})`}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {campaign.due_date ?? "-"}
                </td>
              </tr>
            ))}

            {!error && (campaigns?.length ?? 0) === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={7}
                >
                  No RCSA campaigns found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
