import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FeedbackAlert } from "@/components/ui/feedback-alert";
import { Input } from "@/components/ui/input";
import { requireSessionProfile } from "@/lib/auth/profile";
import { hasRole } from "@/lib/permissions/roles";
import { riskLevelOptions, riskStatusOptions } from "@/lib/scoring/risk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import { isRiskLevel, isRiskStatus } from "@/lib/validators/risk";

type RiskListItem = {
  id: string;
  title: string;
  category: string;
  impact: number;
  likelihood: number;
  score: number;
  level: string;
  status: string;
  due_date: string | null;
  updated_at: string;
};

export default async function RisksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; level?: string; error?: string }>;
}) {
  const profile = await requireSessionProfile("viewer");
  const canEdit = hasRole("contributor", profile.role);

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = isRiskStatus(params.status) ? params.status : "";
  const level = isRiskLevel(params.level) ? params.level : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("risks")
    .select("id, title, category, impact, likelihood, score, level, status, due_date, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (level) {
    query = query.eq("level", level);
  }

  const { data, error } = await query.returns<RiskListItem[]>();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk register</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and maintain the current risk inventory.
          </p>
        </div>
        {canEdit ? (
          <Link href="/dashboard/risks/new" className={buttonVariants()}>
            New risk
          </Link>
        ) : null}
      </div>

      {params.error ? <FeedbackAlert message={decodeURIComponent(params.error)} /> : null}

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input name="q" placeholder="Search by title" defaultValue={q} />

        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {riskStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="level"
          aria-label="Filter by level"
          defaultValue={level}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">All levels</option>
          {riskLevelOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Apply filters
        </button>
      </form>

      {error ? <FeedbackAlert message={error.message} /> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[780px] text-left text-sm">
          <caption className="sr-only">Risk register results</caption>
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Category
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Score
              </th>
              <th scope="col" className="px-4 py-3">
                Level
              </th>
              <th scope="col" className="px-4 py-3">
                Due date
              </th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((risk) => (
              <tr key={risk.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/risks/${risk.id}`} className="font-medium hover:underline">
                    {risk.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{risk.category}</td>
                <td className="px-4 py-3">{risk.status}</td>
                <td className="px-4 py-3">{risk.score}</td>
                <td className="px-4 py-3 capitalize">{risk.level}</td>
                <td className="px-4 py-3 text-muted-foreground">{risk.due_date ?? "-"}</td>
              </tr>
            ))}

            {!error && (data?.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No risks found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
